import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FORMATIONS, DEFAULT_FORMATION } from "@/lib/formations";
import { bumpMission } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";

const slotInclude = {
  slots: {
    orderBy: { index: "asc" as const },
    include: { card: { include: { player: true } } },
  },
};

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

export async function setFormation(userId: string, formation: string) {
  if (!(formation in FORMATIONS)) throw new Error("ไม่พบ formation นี้");
  const squad = await getOrCreateSquad(userId);
  await prisma.squad.update({ where: { id: squad.id }, data: { formation } });
}

// จัดทีมไม่นับสูตร (setFormation) เป็นมิชชั่น — เฉพาะการวาง/ถอดการ์ดในช่อง (assignSlot) เท่านั้น
export async function assignSlot(
  userId: string,
  index: number,
  cardId: string | null,
) {
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

    await bumpMission(tx, userId, MISSION_KEYS.DAILY_ASSIGN_TEAM, new Date());
  });
}
