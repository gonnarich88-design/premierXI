import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FORMATIONS, DEFAULT_FORMATION, type Slot } from "@/lib/formations";
import { computeChemistry, type ChemEntry } from "@/lib/chemistry";
import { bumpMission } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";

const slotInclude = {
  slots: {
    orderBy: { index: "asc" as const },
    include: { card: { include: { player: true } } },
  },
};

type SlotWithCard = {
  card: {
    ovr: number;
    position: string;
    altPositions: string | null;
    player: { name: string; club: string; nation: string };
  } | null;
};

/** สร้าง ChemEntry[] ต่อ slot ตาม formation layout — ใช้ร่วมกันทั้ง refreshCachedRating (ที่นี่)
 * และ findOpponent/playPvpMatch (src/lib/pvp.ts) กันโค้ดเดียวกันกระจาย 3 ที่ */
export function buildChemEntries(slots: SlotWithCard[], layout: Slot[]): (ChemEntry | null)[] {
  return layout.map((slot, i) => {
    const card = slots[i]?.card;
    if (!card) return null;
    return {
      ovr: card.ovr,
      position: card.position,
      altPositions: card.altPositions ? card.altPositions.split(",") : [],
      club: card.player.club,
      nation: card.player.nation,
      slotPos: slot.pos,
    };
  });
}

/** ทีมลงสนามจริงสำหรับจำลองแมตช์ PvP — slotPos คือตำแหน่งที่ถูกจัดลงเล่น ไม่ใช่ card.position ดิบ */
export function buildLineup(
  slots: SlotWithCard[],
  layout: Slot[],
): { name: string; ovr: number; slotPos: string }[] {
  return layout
    .map((slot, i) => {
      const card = slots[i]?.card;
      if (!card) return null;
      return { name: card.player.name, ovr: card.ovr, slotPos: slot.pos };
    })
    .filter((e): e is { name: string; ovr: number; slotPos: string } => e !== null);
}

export async function getOrCreateSquad(userId: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const existing = await db.squad.findUnique({
    where: { userId },
    include: slotInclude,
  });
  if (existing) return existing;

  return db.squad.create({
    data: {
      userId,
      formation: DEFAULT_FORMATION,
      slots: { create: Array.from({ length: 11 }, (_, i) => ({ index: i })) },
    },
    include: slotInclude,
  });
}

/** อัพเดต Squad.cachedRating ให้ตรงกับทีมจริงปัจจุบัน — เป็นแค่ query filter หา PvP matchmaking เท่านั้น
 * (playPvpMatch คำนวณ computeChemistry สดเสมอ ไม่ใช้ค่านี้ตรงๆ — ดู docs/superpowers/specs/2026-07-17-pvp-design.md หัวข้อ 3) */
export async function refreshCachedRating(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const squad = await tx.squad.findUnique({ where: { userId }, include: slotInclude });
  if (!squad) return;

  const layout = FORMATIONS[squad.formation] ?? FORMATIONS["4-3-3"];
  const chem = computeChemistry(buildChemEntries(squad.slots, layout));
  await tx.squad.update({ where: { id: squad.id }, data: { cachedRating: chem.rating } });
}

export async function setFormation(userId: string, formation: string): Promise<void> {
  if (!(formation in FORMATIONS)) throw new Error("ไม่พบ formation นี้");
  await prisma.$transaction(async (tx) => {
    const squad = await getOrCreateSquad(userId, tx);
    await tx.squad.update({ where: { id: squad.id }, data: { formation } });
    await refreshCachedRating(tx, userId);
  });
}

// จัดทีมไม่นับสูตร (setFormation) เป็นมิชชั่น — เฉพาะการวาง/ถอดการ์ดในช่อง (assignSlot) เท่านั้น
export async function assignSlot(
  userId: string,
  index: number,
  cardId: string | null,
  now: Date = new Date(),
): Promise<void> {
  if (index < 0 || index > 10) throw new Error("ช่องไม่ถูกต้อง");

  await prisma.$transaction(async (tx) => {
    const squad = await getOrCreateSquad(userId, tx);

    if (cardId) {
      const owned = await tx.userCard.findUnique({
        where: { userId_cardId: { userId, cardId } },
        select: { id: true },
      });
      if (!owned) throw new Error("ไม่ได้เป็นเจ้าของการ์ดนี้");
      // ถ้าการ์ดนี้อยู่ช่องอื่นในทีมแล้ว ย้ายออกก่อน (กันใช้ซ้ำ)
      await tx.squadSlot.updateMany({
        where: { squadId: squad.id, cardId },
        data: { cardId: null },
      });
    }

    await tx.squadSlot.update({
      where: { squadId_index: { squadId: squad.id, index } },
      data: { cardId },
    });

    await bumpMission(tx, userId, MISSION_KEYS.DAILY_ASSIGN_TEAM, now);
    await refreshCachedRating(tx, userId);
  });
}
