import { prisma } from "@/lib/prisma";
import { POSITION_GROUP, type Position } from "@/lib/constants";

// เงิน/ไอเทมแถมตอนเปิด Starter Pack ครั้งแรก (พอเปิด Standard Pack ลองเล่นได้)
const STARTER_SILVER = 300;
const STARTER_TICKET = 1;

// องค์ประกอบทีมเริ่มต้น 11 คน (ตาม GDD): GK1 / DEF4 / MID3 / ATT3
const SLOTS: Record<"GK" | "DEF" | "MID" | "ATT", number> = {
  GK: 1,
  DEF: 4,
  MID: 3,
  ATT: 3,
};

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

/** สุ่มการ์ดสมดุล 11 ตำแหน่งจากพูลเรตต่ำ (Bronze/Silver = OVR < 75) */
async function pickStarterCardIds(
  tx: Pick<typeof prisma, "card">,
): Promise<string[]> {
  const pool = await tx.card.findMany({
    where: { ovr: { lt: 75 }, category: "normal" },
    select: { id: true, position: true },
  });

  const byGroup: Record<"GK" | "DEF" | "MID" | "ATT", string[]> = {
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  };
  for (const c of pool) {
    const g = POSITION_GROUP[c.position as Position] ?? "MID";
    byGroup[g].push(c.id);
  }

  const chosen: string[] = [];
  for (const group of ["GK", "DEF", "MID", "ATT"] as const) {
    const picked = shuffle(byGroup[group]).slice(0, SLOTS[group]);
    chosen.push(...picked);
  }

  // เผื่อบางกลุ่มการ์ดไม่พอ → เติมจากพูลที่เหลือให้ครบ 11
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
        packTicket: { increment: STARTER_TICKET },
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
