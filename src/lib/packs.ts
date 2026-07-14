import { prisma } from "@/lib/prisma";
import { InsufficientFundsError } from "@/lib/economy";
import type { Currency } from "@/lib/constants";

export type PackTier = "Bronze" | "Silver" | "Gold";

export type PackConfig = {
  id: string;
  name: string;
  currency: Currency;
  cost: number;
  rates: Record<PackTier, number>; // รวมกันต้อง = 1
  pityThreshold?: number; // เปิดครบจำนวนนี้โดยไม่ได้ Gold → การันตี Gold
  desc: string;
};

export const PACKS: Record<string, PackConfig> = {
  standard: {
    id: "standard",
    name: "Standard Pack",
    currency: "silver",
    cost: 300,
    rates: { Bronze: 0.55, Silver: 0.38, Gold: 0.07 },
    desc: "ซองพื้นฐาน ได้การ์ด 1 ใบ",
  },
  premium: {
    id: "premium",
    name: "Premium Pack",
    currency: "gold",
    cost: 5,
    rates: { Bronze: 0.1, Silver: 0.5, Gold: 0.4 },
    pityThreshold: 10,
    desc: "โอกาสได้ Gold สูง + การันตี Gold ทุก 10 ครั้ง",
  },
  ticket: {
    id: "ticket",
    name: "Ticket Pack",
    currency: "packTicket",
    cost: 1,
    rates: { Bronze: 0.5, Silver: 0.4, Gold: 0.1 },
    desc: "เปิดฟรีด้วย Pack Ticket",
  },
};

export const SHARD_VALUE: Record<PackTier, number> = {
  Bronze: 5,
  Silver: 15,
  Gold: 50,
};

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

export type OpenResult = {
  card: {
    id: string;
    ovr: number;
    position: string;
    tier: string;
    imageUrl: string | null;
    playerName: string;
    club: string;
  };
  isDuplicate: boolean;
  shardsGained: number;
  pity: number;
};

export async function openPack(
  userId: string,
  packId: string,
): Promise<OpenResult> {
  const config = PACKS[packId];
  if (!config) throw new Error("ไม่พบซองนี้");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        silver: true,
        gold: true,
        packTicket: true,
        shards: true,
        pityCounter: true,
        level: true,
        exp: true,
      },
    });

    const have = (user as unknown as Record<Currency, number>)[config.currency];
    if (have < config.cost)
      throw new InsufficientFundsError(config.currency, have, config.cost);

    // เลือก tier (ใช้ pity ถ้าถึงเกณฑ์)
    const pityHit =
      config.pityThreshold != null &&
      user.pityCounter + 1 >= config.pityThreshold;
    const tier: PackTier = pityHit ? "Gold" : rollTier(config.rates);

    // สุ่มการ์ดใน tier นั้น
    const pool = await tx.card.findMany({
      where: { tier, category: "normal" },
      select: { id: true },
    });
    if (pool.length === 0) throw new Error(`ไม่มีการ์ด tier ${tier}`);
    const cardId = pool[Math.floor(Math.random() * pool.length)].id;

    const card = await tx.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { player: true },
    });

    // เช็คการ์ดซ้ำ
    const owned = await tx.userCard.findUnique({
      where: { userId_cardId: { userId, cardId } },
      select: { id: true },
    });
    const isDuplicate = !!owned;
    const shardsGained = isDuplicate ? SHARD_VALUE[tier] : 0;

    if (!isDuplicate) {
      await tx.userCard.create({ data: { userId, cardId } });
    }

    // pity: Gold → reset, ไม่งั้น +1 (เฉพาะซองที่มี pity)
    const nextPity =
      tier === "Gold" ? 0 : config.pityThreshold != null ? user.pityCounter + 1 : user.pityCounter;

    // exp + level up
    let level = user.level;
    let exp = user.exp + EXP_PER_OPEN;
    while (exp >= level * 100) {
      exp -= level * 100;
      level += 1;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        [config.currency]: { decrement: config.cost },
        shards: { increment: shardsGained },
        pityCounter: nextPity,
        level,
        exp,
      },
    });

    return {
      card: {
        id: card.id,
        ovr: card.ovr,
        position: card.position,
        tier: card.tier,
        imageUrl: card.imageUrl,
        playerName: card.player.name,
        club: card.player.club,
      },
      isDuplicate,
      shardsGained,
      pity: nextPity,
    };
  });
}
