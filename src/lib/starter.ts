import { prisma } from "@/lib/prisma";
import { FORMATIONS, DEFAULT_FORMATION } from "@/lib/formations";

// เงินแถมตอนเปิด Starter Pack ครั้งแรก (พอเปิด Standard Pack ลองเล่นได้)
// เดิมแถม Pack Ticket ด้วย แต่ยกเลิก Ticket Pack แล้ว เลยไม่แจกอีก
const STARTER_SILVER = 300;

// ตำแหน่งที่ต้องการเป๊ะๆ 11 ใบ ตาม formation เริ่มต้น (เช่น 4-3-3: GK,LB,CB,CB,RB,CM,CM,CM,LW,ST,RW)
// การันตีว่าผู้เล่นใหม่จัดทีมเต็ม 11 ตำแหน่งได้ทันทีแบบ fit เป๊ะ (chemistry เต็ม) ไม่ต้องรอเปิดซองเพิ่ม
const DEFAULT_POSITIONS = FORMATIONS[DEFAULT_FORMATION].map((s) => s.pos);

// การันตี Gold (OVR ต่ำสุดของ tier) 2 ใบใน 11 ใบ เพื่อดึงดูดให้เล่นต่อ
// โดยไม่ให้ทีมแรงเกินสมดุล — จำกัดช่วง OVR แคบกว่า Gold เต็ม tier (75-90)
const GOLD_OVR_MIN = 75;
const GOLD_OVR_MAX = 78;
const GOLD_SLOT_COUNT = 2;

export class StarterAlreadyClaimedError extends Error {
  constructor() {
    super("รับ Starter Pack ไปแล้ว");
  }
}

export type StarterCard = {
  id: string;
  ovr: number;
  position: string;
  tier: string;
  imageUrl: string | null;
  playerName: string;
  club: string;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** จัดกลุ่มการ์ดตามตำแหน่งเป๊ะๆ (GK/LB/CB/...) */
function groupByExactPosition(
  cards: { id: string; position: string }[],
): Record<string, string[]> {
  const byPos: Record<string, string[]> = {};
  for (const c of cards) {
    (byPos[c.position] ??= []).push(c.id);
  }
  return byPos;
}

/**
 * แจกการ์ดตรงตำแหน่งเป๊ะตาม formation เริ่มต้นทั้ง 11 ช่อง (Bronze/Silver = OVR < 75)
 * เพื่อให้จัดทีมเต็มสูตรได้ทันทีโดยไม่มีช่องขาด — สุ่ม 2 ช่องให้เป็น Gold OVR ต่ำ (75-78) แทน
 */
async function pickStarterCardIds(
  tx: Pick<typeof prisma, "card">,
): Promise<string[]> {
  const pool = await tx.card.findMany({
    where: { ovr: { lt: 75 }, category: "normal", position: { in: DEFAULT_POSITIONS } },
    select: { id: true, position: true },
  });
  const goldPool = await tx.card.findMany({
    where: {
      category: "normal",
      tier: "Gold",
      ovr: { gte: GOLD_OVR_MIN, lte: GOLD_OVR_MAX },
      position: { in: DEFAULT_POSITIONS },
    },
    select: { id: true, position: true },
  });

  const byPos = groupByExactPosition(pool);
  const goldByPos = groupByExactPosition(goldPool);

  // สุ่มเลือก 2 ช่อง (จาก 11 ตำแหน่งของ formation) ให้เป็น Gold แทนที่ Bronze/Silver
  const goldSlotIdxs = new Set(
    shuffle(DEFAULT_POSITIONS.map((_, i) => i)).slice(0, GOLD_SLOT_COUNT),
  );

  const usedNormal = new Set<string>();
  const usedGold = new Set<string>();
  const chosen: string[] = [];

  DEFAULT_POSITIONS.forEach((pos, i) => {
    if (goldSlotIdxs.has(i)) {
      const candidate = shuffle(goldByPos[pos] ?? []).find(
        (id) => !usedGold.has(id),
      );
      if (candidate) {
        usedGold.add(candidate);
        chosen.push(candidate);
        return;
      }
    }
    const candidate = shuffle(byPos[pos] ?? []).find(
      (id) => !usedNormal.has(id),
    );
    if (candidate) {
      usedNormal.add(candidate);
      chosen.push(candidate);
    }
  });

  // เผื่อบางตำแหน่งการ์ดไม่พอ (ไม่ควรเกิดในทางปฏิบัติ) → เติมจากพูลที่เหลือให้ครบ 11
  if (chosen.length < 11) {
    const remaining = shuffle(
      pool.map((c) => c.id).filter((id) => !chosen.includes(id)),
    );
    chosen.push(...remaining.slice(0, 11 - chosen.length));
  }

  return chosen;
}

/**
 * เปิด Starter Pack ครั้งแรก: แจกการ์ด 11 ใบ + เงินตั้งต้น แล้วคืนรายละเอียด
 * การ์ดทั้ง 11 ใบไปโชว์ reveal บนหน้าเปิดซอง
 */
export async function openStarterPack(
  userId: string,
): Promise<{ cards: StarterCard[] }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { starterClaimed: true },
    });
    if (user.starterClaimed) throw new StarterAlreadyClaimedError();

    const chosen = await pickStarterCardIds(tx);

    await tx.userCard.createMany({
      data: chosen.map((cardId) => ({ userId, cardId })),
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        starterClaimed: true,
        silver: { increment: STARTER_SILVER },
      },
    });

    const cards = await tx.card.findMany({
      where: { id: { in: chosen } },
      include: { player: true },
    });

    return {
      cards: cards.map((c) => ({
        id: c.id,
        ovr: c.ovr,
        position: c.position,
        tier: c.tier,
        imageUrl: c.imageUrl,
        playerName: c.player.name,
        club: c.player.club,
      })),
    };
  });
}
