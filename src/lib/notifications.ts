import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/lib/constants";
import type { LevelUpReward, OpenedCard } from "@/lib/packs";
import { PVP_TIERS, type PvpTierKey } from "@/lib/pvp";

const PACK_NAMES: Record<string, string> = {
  standard: "Standard Pack",
  evolution: "Evolution Pack",
  royalprime: "Royal Prime Pack",
};

const PVP_TIER_LABEL: Record<string, string> = Object.fromEntries(PVP_TIERS.map((t) => [t.key, t.label]));

/** แจ้งเตือน level-up พร้อมรางวัลที่ได้ (silver/gold ทุกเลเวล + ซองฟรีถ้าถึง milestone 5/10/25) */
export async function notifyLevelRewards(
  userId: string,
  level: number,
  levelRewards: LevelUpReward[],
): Promise<void> {
  const totalSilver = levelRewards.reduce((sum, r) => sum + r.silver, 0);
  const totalGold = levelRewards.reduce((sum, r) => sum + r.gold, 0);

  const parts = [`+${totalSilver} Silver`];
  if (totalGold) parts.push(`+${totalGold} Gold`);
  for (const r of levelRewards) {
    if (r.pack) parts.push(`ได้ ${PACK_NAMES[r.pack.packId] ?? r.pack.packId} ฟรี 🎁`);
  }

  await createNotification({
    userId,
    type: "LEVEL_UP",
    title: `เลเวลอัพเป็น Lv.${level}!`,
    body: parts.join(" · "),
    href: "/profile",
  });
}

/** แจ้งเตือนเคลมมิชชั่นสำเร็จ — silver/EXP เสมอ + ซองฟรีถ้ามี (เช่น weekly_login5) */
export async function notifyMissionClaimed(
  userId: string,
  missionLabel: string,
  reward: { silver: number; exp: number },
  pack?: { packId: string; cards: OpenedCard[] },
): Promise<void> {
  const parts = [`+${reward.silver} Silver`];
  if (reward.exp) parts.push(`+${reward.exp} EXP`);
  if (pack) parts.push(`ได้ ${PACK_NAMES[pack.packId] ?? pack.packId} ฟรี`);

  await createNotification({
    userId,
    type: "MISSION_CLAIMED",
    title: `เคลมมิชชั่นสำเร็จ: ${missionLabel}`,
    body: parts.join(" · "),
    href: "/",
  });
}

/** แจ้งเตือนผล PvP — แพ้ชนะ/เสมอ + RP delta + tier change ถ้ามี */
export async function notifyPvpMatch(
  userId: string,
  result: {
    myGoals: number;
    oppGoals: number;
    outcome: "win" | "draw" | "lose";
    rpDelta: number;
    promoted: boolean;
    demoted: boolean;
    tierAfter: PvpTierKey;
  },
): Promise<void> {
  const outcomeLabel = result.outcome === "win" ? "ชนะ" : result.outcome === "draw" ? "เสมอ" : "แพ้";
  const rpText = result.rpDelta >= 0 ? `+${result.rpDelta}` : `${result.rpDelta}`;
  let body = `${outcomeLabel} ${result.myGoals}-${result.oppGoals} · ${rpText} RP`;
  if (result.promoted) body += ` · เลื่อนขั้นเป็น ${PVP_TIER_LABEL[result.tierAfter] ?? result.tierAfter}!`;
  if (result.demoted) body += ` · ตกขั้นเป็น ${PVP_TIER_LABEL[result.tierAfter] ?? result.tierAfter}`;

  await createNotification({
    userId,
    type: "PVP_MATCH",
    title: "ผลการแข่งขัน PvP",
    body,
    href: "/pvp",
  });
}

/** แจ้งเตือนรางวัลจบ season PvP — แจกก่อน hard reset ตาม tier สุดท้ายก่อนขึ้นเดือนใหม่ */
export async function notifyPvpSeasonEnd(
  userId: string,
  reward: { tier: PvpTierKey; silver: number; gold: number; pack?: { packId: string; cards: OpenedCard[] } },
): Promise<void> {
  const parts = [`+${reward.silver} Silver`];
  if (reward.gold) parts.push(`+${reward.gold} Gold`);
  if (reward.pack) parts.push(`ได้ ${PACK_NAMES[reward.pack.packId] ?? reward.pack.packId} ฟรี`);

  await createNotification({
    userId,
    type: "PVP_MATCH",
    title: `จบ Season PvP — Tier ${PVP_TIER_LABEL[reward.tier] ?? reward.tier}`,
    body: parts.join(" · "),
    href: "/pvp",
  });
}

/** แจ้งเตือนปลดล็อก Achievement — silver/gold ถ้ามี + ซองฟรีถ้ามี (เช่น ครบทีม/Big6) */
export async function notifyAchievementUnlocked(
  userId: string,
  achievementLabel: string,
  reward: { silver: number; gold: number },
  pack?: { packId: string; cards: OpenedCard[] },
): Promise<void> {
  const parts: string[] = [];
  if (reward.silver) parts.push(`+${reward.silver} Silver`);
  if (reward.gold) parts.push(`+${reward.gold} Gold`);
  if (pack) parts.push(`ได้ ${PACK_NAMES[pack.packId] ?? pack.packId} ฟรี`);

  await createNotification({
    userId,
    type: "ACHIEVEMENT_UNLOCKED",
    title: `ปลดล็อก Achievement: ${achievementLabel}`,
    body: parts.join(" · "),
    href: "/achievements",
  });
}

/** แจ้งเตือนผลคะแนน Fantasy ของ Gameweek ที่เพิ่งปิด — เรียกใน tx เดียวกับ score upsert เสมอ (`withFencedLease`)
 * ใช้ `createNotificationOnce` กัน resume หลัง crash ส่งซ้ำ (ดู idempotencyKey บน Notification model) */
export async function notifyFantasyScore(
  userId: string,
  gameweekId: string,
  gameweekNumber: number,
  points: number,
  rank: number | null,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const rankText = rank ? ` · อันดับ ${rank}` : "";
  await createNotificationOnce(
    {
      userId,
      type: "FANTASY_SCORE",
      title: `ผลคะแนน Fantasy Gameweek ${gameweekNumber}`,
      body: `ได้ ${points} แต้ม${rankText}`,
      href: "/fantasy",
      idempotencyKey: `fantasy:score:${gameweekId}:${userId}`,
    },
    tx,
  );
}

/** แจ้งเตือนรางวัล Fantasy — เรียกใน tx เดียวกับ addCurrency()/grantFreePack() ของรางวัลนั้น (ledger กันแจกซ้ำแล้ว)
 * ใช้ `createNotificationOnce` กัน resume หลัง crash ส่งซ้ำ (ดู idempotencyKey บน Notification model) */
export async function notifyFantasyReward(
  userId: string,
  gameweekId: string,
  gameweekNumber: number,
  reward: { silver?: number; gold?: number; packId?: string },
  tx: Prisma.TransactionClient,
): Promise<void> {
  const parts: string[] = [];
  if (reward.silver) parts.push(`+${reward.silver} Silver`);
  if (reward.gold) parts.push(`+${reward.gold} Gold`);
  if (reward.packId) parts.push(`ได้ ${PACK_NAMES[reward.packId] ?? reward.packId} ฟรี`);

  await createNotificationOnce(
    {
      userId,
      type: "FANTASY_REWARD",
      title: `ได้รับรางวัล Fantasy Gameweek ${gameweekNumber}`,
      body: parts.join(" · "),
      href: "/fantasy",
      idempotencyKey: `fantasy:reward:weekly:${gameweekId}:${userId}`,
    },
    tx,
  );
}

/**
 * สร้างการแจ้งเตือนส่วนตัว — best-effort: ถ้า write พังจะไม่ throw
 * (ไม่ให้ noti ล้มไปทำให้ flow หลัก เช่น เปิดซอง/รับรางวัล พังตาม)
 */
export async function createNotification(
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    href?: string;
  },
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
      },
    });
  } catch (e) {
    console.error("createNotification failed", e);
  }
}

/**
 * สร้างการแจ้งเตือนแบบ idempotent ผ่าน `idempotencyKey` — ใช้เฉพาะจุดที่ผูกกับ resumable operation (เช่น
 * `runScoring` ที่ resume ได้หลัง crash) เรียกซ้ำด้วย key เดิมได้ผลลัพธ์เดียวกันเสมอ ไม่สร้างแถวซ้ำ
 * (`update: {}` กัน retry ไป reset `read`/`createdAt` ของแถวเดิม) ต่างจาก `createNotification` ตรงที่ไม่กลืน
 * error — ต้องเรียกใน `tx` เดียวกับ side effect หลักเสมอ เพื่อให้ transaction ทั้งก้อน rollback ถ้าเขียนไม่สำเร็จ
 */
export async function createNotificationOnce(
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    href?: string;
    idempotencyKey: string;
  },
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.notification.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      idempotencyKey: input.idempotencyKey,
    },
    update: {},
  });
}

/** จำนวนที่ยังไม่อ่าน = noti ส่วนตัวที่ยังไม่อ่าน + ข่าวที่ใหม่กว่าเวลาอ่านล่าสุด */
export async function getUnreadCount(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastReadNewsAt: true },
  });
  const since = user?.lastReadNewsAt ?? new Date(0);

  const [unreadNotifs, unreadNews] = await Promise.all([
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.announcement.count({
      where: { published: true, createdAt: { gt: since } },
    }),
  ]);
  return unreadNotifs + unreadNews;
}

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: Date;
};

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  isNew: boolean;
};

/** ดึงข้อมูลหน้า Notification Center (ข่าว + กิจกรรม) */
export async function getNotificationCenter(userId: string): Promise<{
  news: NewsItem[];
  notifications: NotificationItem[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastReadNewsAt: true },
  });
  const since = user?.lastReadNewsAt ?? new Date(0);

  const [news, notifications] = await Promise.all([
    prisma.announcement.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    news: news.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
      isNew: n.createdAt > since,
    })),
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      read: n.read,
      createdAt: n.createdAt,
    })),
  };
}

/** ทำเครื่องหมายว่าอ่านแล้วทั้งหมด (noti ส่วนตัว + ข่าว) — เฉพาะรายการที่ถูกสร้างไม่เกิน `cutoff`
 * (เวลาที่ capture ไว้ตอนโหลด snapshot ให้ user เห็น) กันรายการที่เพิ่งเกิดขึ้นระหว่างเปิดหน้าโดนนับว่าอ่านแล้วทั้งที่ไม่เคยเห็น
 * ทั้งสอง update อยู่ใน transaction เดียวกันกัน lastReadNewsAt กับสถานะ read ของ notification เพี้ยนไม่ตรงกัน */
export async function markAllRead(userId: string, cutoff: Date = new Date()): Promise<void> {
  await prisma.$transaction([
    prisma.notification.updateMany({
      where: { userId, read: false, createdAt: { lte: cutoff } },
      data: { read: true },
    }),
    prisma.user.updateMany({
      where: { id: userId, OR: [{ lastReadNewsAt: null }, { lastReadNewsAt: { lt: cutoff } }] },
      data: { lastReadNewsAt: cutoff },
    }),
  ]);
}
