import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addCurrency } from "@/lib/economy";
import { grantFreePack, type LevelUpReward, type OpenedCard } from "@/lib/packs";
import {
  ACHIEVEMENTS,
  type AchievementCategory,
  type AchievementConfig,
  type AchievementReward,
} from "@/lib/achievementConfig";

type Db = Prisma.TransactionClient | typeof prisma;

/** playerId ทั้งหมดที่ user มีการ์ดอย่างน้อย 1 เวอร์ชัน (นับที่ระดับ Player ไม่ใช่ Card — ดูสเปคหัวข้อ 3) */
async function getOwnedPlayerIds(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db.userCard.findMany({
    where: { userId },
    select: { card: { select: { playerId: true } } },
  });
  return new Set(rows.map((r) => r.card.playerId));
}

/**
 * progress สดของ achievement 1 ตัว — ไม่มีการเก็บ progress ในตาราง AchievementProgress เลย (ดูสเปคหัวข้อ 2)
 * cache ใช้ร่วมข้าม achievement หลายตัวในการเรียกครั้งเดียว (getAchievementStatus วน 31 ตัว แต่ query จริงแค่ 3 ครั้ง)
 */
async function computeProgress(
  db: Db,
  userId: string,
  config: AchievementConfig,
  cache: { ownedPlayerIds?: Set<string>; totalPacksOpened?: number; pvpTotalWins?: number } = {},
): Promise<number> {
  if (config.category === "activity") {
    let packs = cache.totalPacksOpened;
    let wins = cache.pvpTotalWins;
    if (packs === undefined || wins === undefined) {
      const user = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { totalPacksOpened: true, pvpTotalWins: true },
      });
      packs = user.totalPacksOpened;
      wins = user.pvpTotalWins;
      cache.totalPacksOpened = packs;
      cache.pvpTotalWins = wins;
    }
    return config.activityType === "packsOpened" ? packs : wins;
  }

  let owned = cache.ownedPlayerIds;
  if (!owned) {
    owned = await getOwnedPlayerIds(db, userId);
    cache.ownedPlayerIds = owned;
  }

  if (config.category === "club") {
    return config.playerIds.filter((id) => owned!.has(id)).length;
  }

  // meta (Big6) — ครบเมื่อ club achievement ที่กำหนดทั้งหมดถึง target ครบทุกตัว ไม่ผูกกับ claimed ของ club (ดูสเปคหัวข้อ 2)
  let completedClubs = 0;
  for (const clubKey of config.requiredClubKeys) {
    const clubConfig = ACHIEVEMENTS[clubKey];
    if (!clubConfig || clubConfig.category !== "club") continue;
    const clubProgress = clubConfig.playerIds.filter((id) => owned!.has(id)).length;
    if (clubProgress >= clubConfig.target) completedClubs++;
  }
  return completedClubs;
}

export type AchievementStatus = {
  key: string;
  category: AchievementCategory;
  label: string;
  progress: number;
  target: number;
  claimed: boolean;
  reward: AchievementReward;
};

/** สถานะ achievement ทั้ง 31 รายการของ user ตอนนี้ — progress คำนวณสดเสมอ (ไม่ได้อ่านจาก DB column ไหนตรงๆ) */
export async function getAchievementStatus(userId: string): Promise<AchievementStatus[]> {
  const [claims, user, ownedPlayerIds] = await Promise.all([
    prisma.achievementProgress.findMany({
      where: { userId },
      select: { achievementKey: true, claimed: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totalPacksOpened: true, pvpTotalWins: true },
    }),
    getOwnedPlayerIds(prisma, userId),
  ]);
  const claimedByKey = new Map(claims.map((c) => [c.achievementKey, c.claimed]));
  const cache = {
    ownedPlayerIds,
    totalPacksOpened: user.totalPacksOpened,
    pvpTotalWins: user.pvpTotalWins,
  };

  const results: AchievementStatus[] = [];
  for (const config of Object.values(ACHIEVEMENTS)) {
    const progress = await computeProgress(prisma, userId, config, cache);
    results.push({
      key: config.key,
      category: config.category,
      label: config.label,
      progress,
      target: config.target,
      claimed: claimedByKey.get(config.key) ?? false,
      reward: config.reward,
    });
  }
  return results;
}

export type ClaimAchievementResult =
  | {
      ok: true;
      reward: { silver: number; gold: number };
      pack?: { packId: string; cards: OpenedCard[] };
      leveledUp: boolean;
      level: number;
      levelRewards: LevelUpReward[];
      achievementLabel: string;
    }
  | { ok: false; error: string };

/**
 * เคลมรางวัล Achievement — atomic เหมือน claimMission() แต่ CAS ต่างกันเล็กน้อย: AchievementProgress
 * ไม่มี "progress row" ที่สร้างไว้ล่วงหน้า (ต่างจาก MissionProgress ที่ bumpMission สร้างตั้งแต่ progress=0)
 * ดังนั้นแค่ create() row (claimed=true ตั้งแต่สร้าง) แล้วปล่อยให้ @@unique([userId, achievementKey])
 * ชนกัน (P2002) เป็นตัวกันเคลมซ้ำแบบ atomic — เหมือน bumpLoginMissions() ตัดสิน "ครั้งแรกของวัน"
 */
export async function claimAchievement(userId: string, achievementKey: string): Promise<ClaimAchievementResult> {
  const config = ACHIEVEMENTS[achievementKey];
  if (!config) return { ok: false, error: "ไม่พบ Achievement นี้" };

  return prisma.$transaction(async (tx) => {
    const progress = await computeProgress(tx, userId, config);
    if (progress < config.target) {
      return { ok: false, error: "ยังทำไม่ครบเงื่อนไข" };
    }

    try {
      await tx.achievementProgress.create({
        data: { userId, achievementKey: config.key, claimed: true, claimedAt: new Date() },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: false, error: "เคลมไปแล้ว" };
      }
      throw err;
    }

    if (config.reward.silver > 0) await addCurrency(userId, "silver", config.reward.silver, tx);
    if (config.reward.gold > 0) await addCurrency(userId, "gold", config.reward.gold, tx);

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } });
    let finalLevel = user.level;
    const levelRewards: LevelUpReward[] = [];
    let pack: { packId: string; cards: OpenedCard[] } | undefined;
    if (config.reward.freePackId) {
      const bonus = await grantFreePack(tx, userId, config.reward.freePackId);
      pack = { packId: config.reward.freePackId, cards: bonus.cards };
      levelRewards.push(...bonus.levelRewards);
      finalLevel = bonus.level;
    }

    return {
      ok: true,
      reward: { silver: config.reward.silver, gold: config.reward.gold },
      pack,
      leveledUp: finalLevel > user.level,
      level: finalLevel,
      levelRewards,
      achievementLabel: config.label,
    };
  });
}
