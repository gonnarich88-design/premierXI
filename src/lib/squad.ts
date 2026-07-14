import { prisma } from "@/lib/prisma";
import { FORMATIONS, DEFAULT_FORMATION } from "@/lib/formations";

const slotInclude = {
  slots: {
    orderBy: { index: "asc" as const },
    include: { card: { include: { player: true } } },
  },
};

export async function getOrCreateSquad(userId: string) {
  const existing = await prisma.squad.findUnique({
    where: { userId },
    include: slotInclude,
  });
  if (existing) return existing;

  return prisma.squad.create({
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

export async function assignSlot(
  userId: string,
  index: number,
  cardId: string | null,
) {
  if (index < 0 || index > 10) throw new Error("ช่องไม่ถูกต้อง");
  const squad = await getOrCreateSquad(userId);

  if (cardId) {
    const owned = await prisma.userCard.findUnique({
      where: { userId_cardId: { userId, cardId } },
      select: { id: true },
    });
    if (!owned) throw new Error("ไม่ได้เป็นเจ้าของการ์ดนี้");
    // ถ้าการ์ดนี้อยู่ช่องอื่นในทีมแล้ว ย้ายออกก่อน (กันใช้ซ้ำ)
    await prisma.squadSlot.updateMany({
      where: { squadId: squad.id, cardId },
      data: { cardId: null },
    });
  }

  await prisma.squadSlot.update({
    where: { squadId_index: { squadId: squad.id, index } },
    data: { cardId },
  });
}
