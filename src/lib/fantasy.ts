// src/lib/fantasy.ts
import { prisma } from "@/lib/prisma";
import { FORMATIONS, DEFAULT_FORMATION } from "@/lib/formations";
import { POSITION_GROUP, type Position } from "@/lib/constants";
import { MAX_BENCH_SIZE } from "@/lib/fantasyConfig";

export type LineupInput = {
  cardId: string;
  slotIndex: number; // 0-14
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type EnrichedEntry = LineupInput & {
  playerId: string;
  positionGroup: "GK" | "DEF" | "MID" | "ATT";
};

/** Validate ทีม Fantasy ทั้งหมดก่อนบันทึก — pure function ไม่แตะ DB
 * ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 1-3 */
export function validateLineup(
  entries: EnrichedEntry[],
  formation: string,
): { ok: true } | { ok: false; error: string } {
  const layout = FORMATIONS[formation];
  if (!layout) return { ok: false, error: "ไม่พบ formation นี้" };

  const maxSlotIndex = layout.length + MAX_BENCH_SIZE - 1;
  if (entries.length > layout.length + MAX_BENCH_SIZE) {
    return { ok: false, error: `ทีมมีผู้เล่นได้ไม่เกิน ${layout.length + MAX_BENCH_SIZE} คน` };
  }

  const seenSlotIndex = new Set<number>();
  const seenCardId = new Set<string>();
  const seenPlayerId = new Set<string>();
  for (const e of entries) {
    if (e.slotIndex < 0 || e.slotIndex > maxSlotIndex) {
      return { ok: false, error: "ช่องไม่ถูกต้อง" };
    }
    if (seenSlotIndex.has(e.slotIndex)) return { ok: false, error: "มีผู้เล่นซ้ำช่องเดียวกัน" };
    seenSlotIndex.add(e.slotIndex);

    if (seenCardId.has(e.cardId)) return { ok: false, error: "ใช้การ์ดใบเดียวกันซ้ำ" };
    seenCardId.add(e.cardId);

    if (seenPlayerId.has(e.playerId)) {
      return { ok: false, error: "ห้ามใช้นักเตะคนเดียวกันซ้ำในทีม (การ์ดคนละ tier ก็นับเป็นคนซ้ำ)" };
    }
    seenPlayerId.add(e.playerId);
  }

  // Starting XI ต้องครบทุก slot ตาม formation และตำแหน่งต้องตรงกลุ่ม
  for (let i = 0; i < layout.length; i++) {
    const entry = entries.find((e) => e.slotIndex === i);
    if (!entry) return { ok: false, error: "จัดผู้เล่นให้ครบ 11 ตัวจริงตาม Formation ก่อน" };
    const requiredGroup = POSITION_GROUP[layout[i].pos as Position];
    if (entry.positionGroup !== requiredGroup) {
      return { ok: false, error: `ช่อง ${layout[i].pos} ต้องใช้การ์ดตำแหน่งกลุ่ม ${requiredGroup}` };
    }
  }

  const benchEntries = entries.filter((e) => e.slotIndex >= layout.length);
  if (benchEntries.length > MAX_BENCH_SIZE) {
    return { ok: false, error: `ตัวสำรองมีได้ไม่เกิน ${MAX_BENCH_SIZE} คน` };
  }

  const starters = entries.filter((e) => e.slotIndex < layout.length);
  const captains = starters.filter((e) => e.isCaptain);
  const viceCaptains = starters.filter((e) => e.isViceCaptain);
  if (captains.length !== 1) return { ok: false, error: "ต้องเลือกกัปตัน 1 คนจากตัวจริง" };
  if (viceCaptains.length !== 1) return { ok: false, error: "ต้องเลือกรองกัปตัน 1 คนจากตัวจริง" };
  if (captains[0].cardId === viceCaptains[0].cardId) {
    return { ok: false, error: "กัปตันและรองกัปตันต้องเป็นคนละคน" };
  }
  if (entries.some((e) => e.slotIndex >= layout.length && (e.isCaptain || e.isViceCaptain))) {
    return { ok: false, error: "ตัวสำรองเป็นกัปตัน/รองกัปตันไม่ได้" };
  }

  return { ok: true };
}

const entryInclude = {
  slots: { orderBy: { slotIndex: "asc" as const } },
};

/** Gameweek ที่ deadline ยังไม่ผ่าน ใกล้ที่สุด — ใช้เป็น "Gameweek ปัจจุบัน" ของหน้าจัดทีม */
export async function getCurrentGameweek(now: Date = new Date()) {
  return prisma.gameweek.findFirst({
    where: { deadline: { gt: now } },
    orderBy: { number: "asc" },
  });
}

/** ทีม Fantasy ของ user สำหรับ Gameweek นี้ — ถ้ายังไม่มี clone จาก entry ล่าสุดของ user เอง (ถ้ามี) */
export async function getOrCreateEntry(userId: string, gameweekId: string) {
  const existing = await prisma.fantasyEntry.findUnique({
    where: { userId_gameweekId: { userId, gameweekId } },
    include: entryInclude,
  });
  if (existing) return existing;

  const latest = await prisma.fantasyEntry.findFirst({
    where: { userId },
    orderBy: { gameweek: { number: "desc" } },
    include: entryInclude,
  });

  return prisma.fantasyEntry.create({
    data: {
      userId,
      gameweekId,
      formation: latest?.formation ?? DEFAULT_FORMATION,
      submittedAt: null,
      slots: latest
        ? {
            create: latest.slots.map((s) => ({
              cardId: s.cardId,
              playerId: s.playerId,
              fantasyPositionGroup: s.fantasyPositionGroup,
              slotIndex: s.slotIndex,
              isStarter: s.isStarter,
              benchPriority: s.benchPriority,
              isCaptain: s.isCaptain,
              isViceCaptain: s.isViceCaptain,
            })),
          }
        : undefined,
    },
    include: entryInclude,
  });
}

/** บันทึกทีม Fantasy ทั้งทีมของ Gameweek นี้ — validate ownership + deadline + เนื้อทีมทั้งหมดก่อนเขียน
 * ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 1-2 */
export async function saveEntry(
  userId: string,
  gameweekId: string,
  formation: string,
  lineup: LineupInput[],
  now: Date = new Date(),
): Promise<void> {
  if (!(formation in FORMATIONS)) throw new Error("ไม่พบ formation นี้");
  const layout = FORMATIONS[formation];

  const gameweek = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) throw new Error("ไม่พบ Gameweek นี้");
  if (now >= gameweek.deadline) throw new Error("พ้นเวลาปิดทีมของ Gameweek นี้แล้ว");

  const cardIds = lineup.map((l) => l.cardId);
  const owned = await prisma.userCard.findMany({
    where: { userId, cardId: { in: cardIds } },
    select: { cardId: true, card: { select: { playerId: true, position: true } } },
  });
  const ownedMap = new Map(owned.map((o) => [o.cardId, o.card]));

  const enriched: EnrichedEntry[] = lineup.map((l) => {
    const card = ownedMap.get(l.cardId);
    if (!card) throw new Error("ไม่ได้เป็นเจ้าของการ์ดบางใบในทีม");
    return {
      ...l,
      playerId: card.playerId,
      positionGroup: POSITION_GROUP[card.position as Position],
    };
  });

  const result = validateLineup(enriched, formation);
  if (!result.ok) throw new Error(result.error);

  await prisma.$transaction(async (tx) => {
    // เช็ค deadline ซ้ำในทรานแซกชัน (defense in depth กันข้อมูลเปลี่ยนระหว่างเช็คครั้งแรกกับตอนเขียนจริง)
    const fresh = await tx.gameweek.findUnique({ where: { id: gameweekId } });
    if (!fresh || now >= fresh.deadline) throw new Error("พ้นเวลาปิดทีมของ Gameweek นี้แล้ว");

    const entry = await tx.fantasyEntry.upsert({
      where: { userId_gameweekId: { userId, gameweekId } },
      update: { formation, submittedAt: now },
      create: { userId, gameweekId, formation, submittedAt: now },
    });

    await tx.fantasyEntrySlot.deleteMany({ where: { entryId: entry.id } });
    await tx.fantasyEntrySlot.createMany({
      data: enriched.map((e) => ({
        entryId: entry.id,
        cardId: e.cardId,
        playerId: e.playerId,
        fantasyPositionGroup: e.positionGroup,
        slotIndex: e.slotIndex,
        isStarter: e.slotIndex < layout.length,
        benchPriority: e.slotIndex >= layout.length ? e.slotIndex - layout.length + 1 : null,
        isCaptain: e.isCaptain,
        isViceCaptain: e.isViceCaptain,
      })),
    });
  });
}
