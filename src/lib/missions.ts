import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MISSIONS, MISSION_KEYS, type MissionKey } from "@/lib/missionConfig";
import { dailyPeriodKey, weeklyPeriodKey } from "@/lib/missionPeriod";

function periodKeyFor(period: "daily" | "weekly", now: Date): string {
  return period === "daily" ? dailyPeriodKey(now) : weeklyPeriodKey(now);
}

/**
 * เพิ่ม progress ของมิชชั่น 1 ตัว — ต้องเรียกใน tx ของ action ที่ trigger เสมอ (ห้ามเรียก prisma top-level ตรงๆ)
 * เพื่อให้ progress อยู่ในทรานแซกชันเดียวกับการกระทำจริงเสมอ (atomic กับ action ที่ trigger มัน)
 */
export async function bumpMission(
  tx: Prisma.TransactionClient,
  userId: string,
  key: MissionKey,
  now: Date,
  amount = 1,
): Promise<void> {
  const periodKey = periodKeyFor(MISSIONS[key].period, now);
  await tx.missionProgress.upsert({
    where: { userId_missionKey_periodKey: { userId, missionKey: key, periodKey } },
    create: { userId, missionKey: key, periodKey, progress: amount },
    update: { progress: { increment: amount } },
  });
}

/**
 * bump DAILY_LOGIN เสมอ + WEEKLY_LOGIN_5 เฉพาะครั้งแรกของวันนี้ (กันนับซ้ำถ้ามีหลาย login/วัน)
 * ต้องเรียกใน tx เดียวกับ claimDaily() เท่านั้น — ดูเหตุผลใน docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md หัวข้อ 3
 */
export async function bumpLoginMissions(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const dailyKey = dailyPeriodKey(now);
  const existing = await tx.missionProgress.findUnique({
    where: {
      userId_missionKey_periodKey: {
        userId,
        missionKey: MISSION_KEYS.DAILY_LOGIN,
        periodKey: dailyKey,
      },
    },
  });
  const isFirstToday = !existing;

  await bumpMission(tx, userId, MISSION_KEYS.DAILY_LOGIN, now);
  if (isFirstToday) {
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_LOGIN_5, now);
  }
}

export type MissionStatus = {
  key: MissionKey;
  label: string;
  period: "daily" | "weekly";
  progress: number;
  target: number;
  claimed: boolean;
  reward: { silver: number; exp: number; freePackId?: string };
};

/** สถานะมิชชั่นทั้งหมด (daily+weekly) ของ user ตอนนี้ — fill ค่า default (progress 0, claimed false) ให้มิชชั่นที่ยังไม่มีแถวใน DB */
export async function getMissionStatus(userId: string, now: Date): Promise<MissionStatus[]> {
  const dailyKey = dailyPeriodKey(now);
  const weeklyKey = weeklyPeriodKey(now);

  const rows = await prisma.missionProgress.findMany({
    where: {
      userId,
      OR: Object.values(MISSIONS).map((config) => ({
        missionKey: config.key,
        periodKey: config.period === "daily" ? dailyKey : weeklyKey,
      })),
    },
  });
  const byKey = new Map(rows.map((r) => [r.missionKey, r]));

  return Object.values(MISSIONS).map((config) => {
    const row = byKey.get(config.key);
    return {
      key: config.key,
      label: config.label,
      period: config.period,
      progress: row?.progress ?? 0,
      target: config.target,
      claimed: row?.claimed ?? false,
      reward: config.reward,
    };
  });
}
