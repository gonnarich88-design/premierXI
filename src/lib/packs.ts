import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InsufficientFundsError, applyExp, levelReward } from "@/lib/economy";
import type { Currency } from "@/lib/constants";
import { bumpMission } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";

export type PackTier = "Bronze" | "Silver" | "Gold";

/** การ์ดพิเศษที่สุ่มการันตีได้ในซอง Evolution/Royal Prime */
export type SpecialConfig = {
  category: string; // "evolution" | "royalprime"
  bonusChance: number; // โอกาสได้โบนัสใบที่ 2 จากพูลเดียวกัน
};

export type PackConfig = {
  id: string;
  name: string;
  currency: Currency;
  cost: number;
  desc: string;
  /** เรตของใบที่สุ่มจากพูล normal (ทุกใบสำหรับ Standard, ใบที่เหลือหลังการันตีสำหรับ Evolution/Royal Prime) */
  fillerRates: Record<PackTier, number>;
  special?: SpecialConfig;
};

export const CARDS_PER_OPEN = 5;

export const PACKS: Record<string, PackConfig> = {
  standard: {
    id: "standard",
    name: "Standard Pack",
    currency: "silver",
    cost: 300,
    desc: `เปิดที ${CARDS_PER_OPEN} ใบ จากนักเตะพรีเมียร์ลีก (OVR ไม่เกิน 90)`,
    fillerRates: { Bronze: 0.25, Silver: 0.5, Gold: 0.25 },
  },
  evolution: {
    id: "evolution",
    name: "Evolution Pack",
    currency: "gold",
    cost: 10,
    desc: `การันตีการ์ด Evolution 1 ใบ (10% ลุ้นใบที่ 2) + การ์ดปกติอีก ${CARDS_PER_OPEN - 1} ใบ`,
    fillerRates: { Bronze: 0.1, Silver: 0.5, Gold: 0.4 },
    special: { category: "evolution", bonusChance: 0.1 },
  },
  royalprime: {
    id: "royalprime",
    name: "Royal Prime Pack",
    currency: "gold",
    cost: 20,
    desc: `การันตีการ์ด Royal Prime 1 ใบ (12% ลุ้นใบที่ 2) + การ์ดปกติอีก ${CARDS_PER_OPEN - 1} ใบ`,
    fillerRates: { Bronze: 0.1, Silver: 0.5, Gold: 0.4 },
    special: { category: "royalprime", bonusChance: 0.12 },
  },
};

/** แลก Shard เป็นการเปิดซองฟรี 1 ครั้ง — แยก pool ตามที่มา กันเอา shard ถูกไปแลกซองแพง */
export const SHARD_EXCHANGE: Record<
  string,
  { packId: string; field: "shards" | "evoShards" | "primeShards"; cost: number }
> = {
  standard: { packId: "standard", field: "shards", cost: 500 },
  evolution: { packId: "evolution", field: "evoShards", cost: 500 },
  royalprime: { packId: "royalprime", field: "primeShards", cost: 1000 },
};

/** ค่า Shard ที่ได้จากการ์ดซ้ำ ต่อ tier */
export const SHARD_VALUE: Record<string, number> = {
  Bronze: 5,
  Silver: 15,
  Gold: 50,
  Hero: 100,
  Legend: 250,
};

function shardFieldForTier(tier: string): "shards" | "evoShards" | "primeShards" {
  if (tier === "Hero") return "evoShards";
  if (tier === "Legend") return "primeShards";
  return "shards";
}

const EXP_PER_OPEN = 20;

function rollTier(rates: Record<PackTier, number>): PackTier {
  const r = Math.random();
  let acc = 0;
  for (const tier of ["Gold", "Silver", "Bronze"] as PackTier[]) {
    acc += rates[tier];
    if (r < acc) return tier;
  }
  return "Bronze";
}

type CardRow = Prisma.CardGetPayload<{ include: { player: true } }>;

async function pickNormalCards(
  tx: Prisma.TransactionClient,
  rates: Record<PackTier, number>,
  count: number,
): Promise<CardRow[]> {
  const poolCache = new Map<PackTier, { id: string }[]>();
  const picks: CardRow[] = [];
  for (let i = 0; i < count; i++) {
    const tier = rollTier(rates);
    let pool = poolCache.get(tier);
    if (!pool) {
      pool = await tx.card.findMany({ where: { tier, category: "normal" }, select: { id: true } });
      poolCache.set(tier, pool);
    }
    if (pool.length === 0) throw new Error(`ไม่มีการ์ด tier ${tier}`);
    const cardId = pool[Math.floor(Math.random() * pool.length)].id;
    picks.push(await tx.card.findUniqueOrThrow({ where: { id: cardId }, include: { player: true } }));
  }
  return picks;
}

async function pickSpecialCard(tx: Prisma.TransactionClient, category: string): Promise<CardRow> {
  const pool = await tx.card.findMany({ where: { category }, select: { id: true } });
  if (pool.length === 0) throw new Error(`ไม่มีการ์ดพิเศษ category ${category}`);
  const cardId = pool[Math.floor(Math.random() * pool.length)].id;
  return tx.card.findUniqueOrThrow({ where: { id: cardId }, include: { player: true } });
}

async function resolvePackCards(tx: Prisma.TransactionClient, config: PackConfig): Promise<CardRow[]> {
  if (!config.special) {
    return pickNormalCards(tx, config.fillerRates, CARDS_PER_OPEN);
  }
  const specials: CardRow[] = [await pickSpecialCard(tx, config.special.category)];
  if (Math.random() < config.special.bonusChance) {
    specials.push(await pickSpecialCard(tx, config.special.category));
  }
  const fillers = await pickNormalCards(tx, config.fillerRates, CARDS_PER_OPEN - specials.length);
  return [...specials, ...fillers];
}

export type OpenedCard = {
  id: string;
  ovr: number;
  position: string;
  tier: string;
  imageUrl: string | null;
  playerName: string;
  club: string;
  isDuplicate: boolean;
  shardsGained: number;
  isSpecial: boolean;
};

/** รางวัล level-up ต่อเลเวลที่ข้ามผ่าน (silver/gold เสมอ, pack เฉพาะเลเวลที่ถึง milestone) */
export type LevelUpReward = {
  level: number;
  silver: number;
  gold: number;
  pack?: { packId: string; cards: OpenedCard[] };
};

export type OpenResult = {
  cards: OpenedCard[];
  leveledUp: boolean;
  level: number;
  levelRewards: LevelUpReward[];
};

async function finalizeOpen(
  tx: Prisma.TransactionClient,
  userId: string,
  picks: CardRow[],
): Promise<OpenResult> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { level: true, exp: true },
  });

  const opened: OpenedCard[] = [];
  const shardDelta: Record<"shards" | "evoShards" | "primeShards", number> = {
    shards: 0,
    evoShards: 0,
    primeShards: 0,
  };

  for (const card of picks) {
    const owned = await tx.userCard.findUnique({
      where: { userId_cardId: { userId, cardId: card.id } },
      select: { id: true },
    });
    const isDuplicate = !!owned;
    const shardsGained = isDuplicate ? (SHARD_VALUE[card.tier] ?? 0) : 0;
    if (isDuplicate) {
      shardDelta[shardFieldForTier(card.tier)] += shardsGained;
    } else {
      await tx.userCard.create({ data: { userId, cardId: card.id } });
    }

    opened.push({
      id: card.id,
      ovr: card.ovr,
      position: card.position,
      tier: card.tier,
      imageUrl: card.imageUrl,
      playerName: card.player.name,
      club: card.player.club,
      isDuplicate,
      shardsGained,
      isSpecial: card.category !== "normal",
    });
  }

  const { level, exp, levelsGained } = applyExp(user.level, user.exp, EXP_PER_OPEN);
  const rewardsByLevel = levelsGained.map((lv) => ({ lv, reward: levelReward(lv) }));
  const silverBonus = rewardsByLevel.reduce((sum, r) => sum + r.reward.silver, 0);
  const goldBonus = rewardsByLevel.reduce((sum, r) => sum + r.reward.gold, 0);

  await tx.user.update({
    where: { id: userId },
    data: {
      shards: { increment: shardDelta.shards },
      evoShards: { increment: shardDelta.evoShards },
      primeShards: { increment: shardDelta.primeShards },
      silver: { increment: silverBonus },
      gold: { increment: goldBonus },
      level,
      exp,
    },
  });

  // แจกซองฟรีของ milestone เลเวล (ถ้ามี) — ทำหลัง update state ปัจจุบันเสร็จ เพื่อให้ finalizeOpen
  // ที่ถูกเรียกซ้อนจาก grantFreePack อ่านค่า level/exp ล่าสุดถูกต้อง (sequential ภายใน tx เดียวกัน)
  const levelRewards: LevelUpReward[] = [];
  let finalLevel = level;
  for (const { lv, reward } of rewardsByLevel) {
    const entry: LevelUpReward = { level: lv, silver: reward.silver, gold: reward.gold };
    if (reward.freePackId) {
      const bonus = await grantFreePack(tx, userId, reward.freePackId);
      entry.pack = { packId: reward.freePackId, cards: bonus.cards };
      levelRewards.push(entry, ...bonus.levelRewards);
      finalLevel = bonus.level; // เผื่อซองโบนัสให้ EXP พอดีข้ามอีกเลเวล ต้องเอา level ล่าสุดจริง ๆ
    } else {
      levelRewards.push(entry);
    }
  }

  return { cards: opened, leveledUp: finalLevel > user.level, level: finalLevel, levelRewards };
}

/** เปิดซองด้วยเงินสกุลของซองนั้น (silver/gold) */
export async function openPack(
  userId: string,
  packId: string,
  now: Date = new Date(),
): Promise<OpenResult> {
  const config = PACKS[packId];
  if (!config) throw new Error("ไม่พบซองนี้");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { [config.currency]: true } as Record<string, true>,
    });
    const have = (user as unknown as Record<Currency, number>)[config.currency];
    if (have < config.cost) throw new InsufficientFundsError(config.currency, have, config.cost);

    await tx.user.update({
      where: { id: userId },
      data: { [config.currency]: { decrement: config.cost } },
    });

    const picks = await resolvePackCards(tx, config);
    const result = await finalizeOpen(tx, userId, picks);
    await bumpMission(tx, userId, MISSION_KEYS.DAILY_OPEN_PACK, now);
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_OPEN_PACK_10, now);
    return result;
  });
}

/**
 * แจกซองฟรีโดยไม่หักเงิน — ใช้กับ milestone/promotion (เช่น login ครบ 15/30 วัน)
 * เรียกภายใน transaction ของผู้เรียก (เช่น claimDaily) เพื่อให้ atomic ร่วมกับ logic อื่น
 */
export async function grantFreePack(
  tx: Prisma.TransactionClient,
  userId: string,
  packId: string,
): Promise<OpenResult> {
  const config = PACKS[packId];
  if (!config) throw new Error("ไม่พบซองนี้");
  const picks = await resolvePackCards(tx, config);
  return finalizeOpen(tx, userId, picks);
}

/** แลก Shard ที่สะสมจากการ์ดซ้ำ เป็นการเปิดซองฟรี 1 ครั้ง (แยก pool ตาม exchangeId) */
export async function openPackWithShards(
  userId: string,
  exchangeId: string,
  now: Date = new Date(),
): Promise<OpenResult> {
  const exchange = SHARD_EXCHANGE[exchangeId];
  if (!exchange) throw new Error("ไม่พบรายการแลกนี้");
  const config = PACKS[exchange.packId];

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { [exchange.field]: true } as Record<string, true>,
    });
    const have = (user as unknown as Record<Currency, number>)[exchange.field];
    if (have < exchange.cost)
      throw new InsufficientFundsError(exchange.field as Currency, have, exchange.cost);

    await tx.user.update({
      where: { id: userId },
      data: { [exchange.field]: { decrement: exchange.cost } },
    });

    const picks = await resolvePackCards(tx, config);
    const result = await finalizeOpen(tx, userId, picks);
    await bumpMission(tx, userId, MISSION_KEYS.DAILY_OPEN_PACK, now);
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_OPEN_PACK_10, now);
    return result;
  });
}
