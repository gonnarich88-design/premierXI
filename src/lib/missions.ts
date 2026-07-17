import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MISSIONS, MISSION_KEYS, type MissionKey } from "@/lib/missionConfig";
import { dailyPeriodKey, weeklyPeriodKey } from "@/lib/missionPeriod";
import { applyExp, levelReward } from "@/lib/economy";
import { grantFreePack, type LevelUpReward, type OpenedCard } from "@/lib/packs";

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
 *
 * "ครั้งแรกของวันนี้" ตัดสินจากผล create() ของ DAILY_LOGIN row เอง (unique constraint กันชน)
 * แทนที่จะ findUnique แล้วค่อยตัดสินใจ — เพราะแบบเดิมมี race window ถ้า isolation level ไม่ serialize
 * write ให้ (SQLite ปัจจุบันปลอดภัยเพราะ single-writer แต่ถ้าย้าย DB ในอนาคตจะพังได้)
 */
export async function bumpLoginMissions(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const dailyKey = dailyPeriodKey(now);

  let isFirstToday: boolean;
  try {
    await tx.missionProgress.create({
      data: { userId, missionKey: MISSION_KEYS.DAILY_LOGIN, periodKey: dailyKey, progress: 1 },
    });
    isFirstToday = true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      isFirstToday = false;
      await tx.missionProgress.update({
        where: {
          userId_missionKey_periodKey: {
            userId,
            missionKey: MISSION_KEYS.DAILY_LOGIN,
            periodKey: dailyKey,
          },
        },
        data: { progress: { increment: 1 } },
      });
    } else {
      throw err;
    }
  }

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

export type ClaimMissionResult =
  | {
      ok: true;
      reward: { silver: number; exp: number };
      pack?: { packId: string; cards: OpenedCard[] };
      leveledUp: boolean;
      level: number;
      levelRewards: LevelUpReward[];
      missionLabel: string;
    }
  | { ok: false; error: string };

/**
 * เคลมรางวัลมิชชั่น — atomic compare-and-set (updateMany + เช็ค count) แทนอ่านแล้วค่อยเขียน
 * ไม่ต้องพึ่ง transaction-serialization ของ SQLite เป็น safety net หลัก (สำคัญถ้าย้าย DB ในอนาคต)
 * แจกรางวัลผ่าน applyExp()/levelReward()/grantFreePack() เดิมเท่านั้น — แพทเทิร์นเดียวกับ claimDaily()/finalizeOpen()
 */
export async function claimMission(
  userId: string,
  missionKey: string,
  now: Date,
): Promise<ClaimMissionResult> {
  const config = MISSIONS[missionKey as MissionKey];
  if (!config) return { ok: false, error: "ไม่พบมิชชั่นนี้" };

  return prisma.$transaction(async (tx) => {
    const periodKey = periodKeyFor(config.period, now);

    const claim = await tx.missionProgress.updateMany({
      where: {
        userId,
        missionKey: config.key,
        periodKey,
        claimed: false,
        progress: { gte: config.target },
      },
      data: { claimed: true },
    });
    if (claim.count === 0) {
      const row = await tx.missionProgress.findUnique({
        where: { userId_missionKey_periodKey: { userId, missionKey: config.key, periodKey } },
      });
      return { ok: false, error: row?.claimed ? "เคลมไปแล้ว" : "ยังทำไม่ครบเงื่อนไข" };
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { level: true, exp: true },
    });
    const { level, exp, levelsGained } = applyExp(user.level, user.exp, config.reward.exp);
    const rewardsByLevel = levelsGained.map((lv) => ({ lv, reward: levelReward(lv) }));
    const levelSilverBonus = rewardsByLevel.reduce((sum, r) => sum + r.reward.silver, 0);
    const levelGoldBonus = rewardsByLevel.reduce((sum, r) => sum + r.reward.gold, 0);

    await tx.user.update({
      where: { id: userId },
      data: {
        silver: { increment: config.reward.silver + levelSilverBonus },
        gold: { increment: levelGoldBonus },
        level,
        exp,
      },
    });

    const levelRewards: LevelUpReward[] = [];
    let finalLevel = level;
    for (const { lv, reward } of rewardsByLevel) {
      const entry: LevelUpReward = { level: lv, silver: reward.silver, gold: reward.gold };
      if (reward.freePackId) {
        const bonus = await grantFreePack(tx, userId, reward.freePackId);
        entry.pack = { packId: reward.freePackId, cards: bonus.cards };
        levelRewards.push(entry, ...bonus.levelRewards);
        finalLevel = bonus.level;
      } else {
        levelRewards.push(entry);
      }
    }

    let pack: { packId: string; cards: OpenedCard[] } | undefined;
    if (config.reward.freePackId) {
      const bonus = await grantFreePack(tx, userId, config.reward.freePackId);
      pack = { packId: config.reward.freePackId, cards: bonus.cards };
      levelRewards.push(...bonus.levelRewards);
      finalLevel = Math.max(finalLevel, bonus.level);
    }

    return {
      ok: true,
      reward: { silver: config.reward.silver, exp: config.reward.exp },
      pack,
      leveledUp: finalLevel > user.level,
      level: finalLevel,
      levelRewards,
      missionLabel: config.label,
    };
  });
}
