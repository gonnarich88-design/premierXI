// src/lib/fantasy.ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FORMATIONS, DEFAULT_FORMATION } from "@/lib/formations";
import { POSITION_GROUP, type Position } from "@/lib/constants";
import { MAX_BENCH_SIZE, GAMEWEEK_STATUS, SCORING_STALE_THRESHOLD_MS, type PositionGroup } from "@/lib/fantasyConfig";
import {
  scoreEntry,
  computeRanks,
  rewardTierFor,
  type SubSlot,
  type BenchSlot,
  type MatchStatLine,
} from "@/lib/fantasyScoring";
import { addCurrency } from "@/lib/economy";
import { grantFreePack } from "@/lib/packs";
import { notifyFantasyReward } from "@/lib/notifications";

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

/** ทีม Fantasy ของ user สำหรับ Gameweek นี้ — ถ้ายังไม่มี clone จาก entry ล่าสุดของ user เอง (ถ้ามี)
 * รองรับ concurrent first-load: ถ้า create ชนกับ request คู่ขนาน (unique userId+gameweekId) ให้อ่าน
 * entry ที่ถูกสร้างไปแล้วกลับมาแทนที่จะปล่อย error ทะลุขึ้นไป */
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

  try {
    return await prisma.fantasyEntry.create({
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
  } catch (err) {
    // recover เฉพาะ P2002 ของ constraint (userId, gameweekId) — nested slot create มี unique ของตัวเอง
    // ([entryId, slotIndex], [entryId, cardId]) แต่ entryId เพิ่งถูกสร้างใหม่เสมอในเคสนี้ ชนกันไม่ได้จริง
    // เช็ค target ให้ตรงเป๊ะกันไป mask constraint อื่นที่ไม่เกี่ยวกับ race นี้
    const target = err instanceof Prisma.PrismaClientKnownRequestError ? err.meta?.target : undefined;
    const isEntryRace =
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      Array.isArray(target) &&
      target.includes("userId") &&
      target.includes("gameweekId");
    if (isEntryRace) {
      const winner = await prisma.fantasyEntry.findUnique({
        where: { userId_gameweekId: { userId, gameweekId } },
        include: entryInclude,
      });
      if (winner) return winner;
    }
    throw err;
  }
}

/** บันทึกทีม Fantasy ทั้งทีมของ Gameweek นี้ — validate ownership + deadline + เนื้อทีมทั้งหมดก่อนเขียน
 * ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 1-2
 *
 * `nowOverride` มีไว้สำหรับ test เท่านั้น (ให้ผลลัพธ์ deterministic) — ตอนรันจริงต้อง "อ่านเวลาใหม่" ทั้ง
 * ก่อน precheck และอีกครั้งใน transaction ทันทีก่อน write statement แรก (หลังงาน read/validate ทั้งหมดเสร็จ)
 * ไม่ใช้ค่าที่ capture ไว้ตั้งแต่ต้นฟังก์ชัน เพราะถ้า request ติดคิว/รอ SQLite lock จนเลย deadline จริง การเทียบ
 * กับเวลาเดิมจะไม่กันการเขียนหลัง deadline — เช็คให้ชิด write มากที่สุดเพื่อลด window ให้เหลือน้อยที่สุด */
export async function saveEntry(
  userId: string,
  gameweekId: string,
  formation: string,
  lineup: LineupInput[],
  nowOverride?: Date,
): Promise<void> {
  if (!(formation in FORMATIONS)) throw new Error("ไม่พบ formation นี้");
  const layout = FORMATIONS[formation];

  const precheckNow = nowOverride ?? new Date();
  const gameweek = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) throw new Error("ไม่พบ Gameweek นี้");
  if (precheckNow >= gameweek.deadline) throw new Error("พ้นเวลาปิดทีมของ Gameweek นี้แล้ว");

  const cardIds = lineup.map((l) => l.cardId);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.gameweek.findUnique({ where: { id: gameweekId } });
    if (!fresh) throw new Error("ไม่พบ Gameweek นี้");

    // ตรวจ ownership ในทรานแซกชันเดียวกับที่เขียน กันไม่ให้ ownership เปลี่ยนระหว่างเช็คกับเขียนจริง (TOCTOU)
    const owned = await tx.userCard.findMany({
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

    // เช็ค deadline ครั้งสุดท้ายด้วยเวลาที่อ่านสดตอนนี้ ทันทีก่อน write statement แรก (ชิดจุดเขียนจริงที่สุด
    // เท่าที่ทำได้ หลังงาน read/validate ทั้งหมดเสร็จแล้ว)
    const commitNow = nowOverride ?? new Date();
    if (commitNow >= fresh.deadline) throw new Error("พ้นเวลาปิดทีมของ Gameweek นี้แล้ว");

    const entry = await tx.fantasyEntry.upsert({
      where: { userId_gameweekId: { userId, gameweekId } },
      update: { formation, submittedAt: commitNow },
      create: { userId, gameweekId, formation, submittedAt: commitNow },
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

async function grantOnce(
  tx: Prisma.TransactionClient,
  userId: string,
  periodType: string,
  periodKey: string,
  rewardType: "SILVER" | "GOLD" | "PACK",
  data: { amount?: number; packId?: string },
  apply: () => Promise<void>,
): Promise<boolean> {
  try {
    await tx.fantasyRewardGrant.create({
      data: { userId, periodType, periodKey, rewardType, amount: data.amount ?? null, packId: data.packId ?? null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false; // แจกไปแล้ว ข้าม
    throw err;
  }
  await apply();
  return true;
}

/** แจกรางวัล Weekly ของ user คนเดียว — รับ `tx` จาก caller แทนที่จะเปิด transaction เอง (Codex adversarial review
 * รอบ 5 ชี้ว่าถ้าเปิด transaction แยกจากการ renew/เช็ค lease จะยังมีช่องให้ owner ที่เสีย lease ไปแล้วแจกรางวัลต่อ
 * ได้อยู่ดี — ต้องให้ caller (`withFencedLease`) ผูกการเช็ค lease กับการแจกจริงไว้ใน transaction เดียวกัน) resumable
 * ทีละ rewardType อิสระกัน — ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 7 ข้อ 4 */
async function grantWeeklyReward(
  tx: Prisma.TransactionClient,
  userId: string,
  gameweekId: string,
  gameweekNumber: number,
  reward: { silver?: number; gold?: number; packId?: string },
): Promise<void> {
  let grantedAny = false;
  if (reward.silver) {
    const granted = await grantOnce(tx, userId, "WEEKLY", gameweekId, "SILVER", { amount: reward.silver }, async () => {
      await addCurrency(userId, "silver", reward.silver!, tx);
    });
    grantedAny = grantedAny || granted;
  }
  if (reward.gold) {
    const granted = await grantOnce(tx, userId, "WEEKLY", gameweekId, "GOLD", { amount: reward.gold }, async () => {
      await addCurrency(userId, "gold", reward.gold!, tx);
    });
    grantedAny = grantedAny || granted;
  }
  if (reward.packId) {
    const granted = await grantOnce(tx, userId, "WEEKLY", gameweekId, "PACK", { packId: reward.packId }, async () => {
      await grantFreePack(tx, userId, reward.packId!);
    });
    grantedAny = grantedAny || granted;
  }
  if (grantedAny) await notifyFantasyReward(userId, gameweekNumber, reward, tx);
}

export type CloseGameweekResult =
  | { ok: true; alreadyScored: true }
  | { ok: true; alreadyScored: false; participantCount: number; scoredCount: number }
  | { ok: false; error: string };

/** แหล่งเวลาจริงสำหรับ lease heartbeat เท่านั้น (คนละหน้าที่กับ `now` ที่ต้อง deterministic/inject ได้สำหรับ
 * business logic เช่น `scoredAt`/deadline check) — ดีฟอลต์เป็น async wrapper รอบ `new Date()` ตัวเดียวในทั้งไฟล์
 * (Global Constraint ห้าม `new Date()` ตรงๆ ในฟังก์ชันที่ต้อง inject เวลาได้ — ที่นี่จึง inject ผ่าน parameter
 * เสมอเหมือนกับ `now`, เพียงแต่ default เป็นเวลาจริงที่ต้อง "เดินหน้าไปเรื่อยๆ" ตามเวลาจริง ไม่ใช่ค่าคงที่ตลอด
 * การเรียกครั้งเดียวแบบ `now`) test จึง inject `nowProvider` ปลอมที่จำลอง "เวลาผ่านไปนาน"/"มีคน takeover แทรก" ได้ */
type NowProvider = () => Promise<Date>;
const defaultNowProvider: NowProvider = () => Promise.resolve(new Date());

/** สัญญาณภายในว่า "เสีย lease ไปแล้วระหว่างเขียน" — ใช้ throw ใน `prisma.$transaction` callback เพื่อ rollback
 * ทุกอย่างใน transaction นั้น (ไม่ commit อะไรเลยถ้าเสีย lease) แล้วให้ `withFencedLease` จับไว้แปลงเป็น `null`
 * แทนที่จะปล่อยเป็น error จริง (เสีย lease ไม่ใช่ bug เป็นแค่สัญญาณให้หยุดแล้วตอบ busy) */
class LeaseLostError extends Error {}

/** รัน `fn` (side effect ที่ต้องเขียนจริง เช่น score upsert หรือแจกรางวัล) **ภายใน transaction เดียวกัน** กับการ
 * ต่ออายุ/ยืนยัน lease (CAS บน `scoringStartedAt` เดิมเป๊ะที่เรารู้ว่าเป็นของเราเอง — token) — ถ้า renew ไม่สำเร็จ
 * (มีคน takeover ไปแล้ว) `fn` จะไม่ถูกเรียกเลย (throw ก่อนถึง `fn`) และไม่มีอะไร commit ทั้ง transaction คืน token
 * ใหม่ + ผลลัพธ์ของ `fn` ถ้าสำเร็จ, คืน `null` ถ้าเสีย lease
 *
 * **ต้องผูก renew กับ side effect ไว้ใน transaction เดียวกันเสมอ ห้ามแยกกันเป็น "renew แล้วค่อยเขียนทีหลัง"** —
 * รอบก่อนหน้าเคย renew สำเร็จแล้วค่อยเรียก `grantWeeklyReward`/`fantasyGameweekScore.upsert` แยกเป็นคนละ call
 * ทำให้ยังมีช่องว่างให้คู่แข่ง takeover ระหว่างสองจุดนั้นพอดี แล้ว owner เดิมก็ยังเขียนต่อได้เหมือนเดิม (Codex
 * adversarial review รอบ 5 ชี้ตรงจุดนี้ — renew ที่แยก transaction จาก side effect ไม่ใช่ fencing จริง) เรียกซ้ำ
 * ทุกจุดเขียนสำคัญ (ทุก score upsert ในลูป, ทุก reward grant ในลูป) ไม่ใช่แค่ครั้งเดียวก่อนลูป */
async function withFencedLease<T>(
  gameweekId: string,
  currentToken: Date,
  nowProvider: NowProvider,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<{ token: Date; result: T } | null> {
  const freshNow = await nowProvider();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const renewed = await tx.gameweek.updateMany({
        where: { id: gameweekId, status: GAMEWEEK_STATUS.SCORING, scoringStartedAt: currentToken },
        data: { scoringStartedAt: freshNow },
      });
      if (renewed.count === 0) throw new LeaseLostError();
      return fn(tx);
    });
    return { token: freshNow, result };
  } catch (err) {
    if (err instanceof LeaseLostError) return null;
    throw err;
  }
}

/** คิดคะแนน+freeze rank/rewardTier+แจก Weekly reward ทุก entry ของ Gameweek นี้ — pure ในแง่คำนวณ (เรียก scoreEntry/
 * computeRanks/rewardTierFor ซ้ำได้ผลเดิมเป๊ะ) จึง idempotent โดยธรรมชาติ เรียกกี่ครั้งก็ได้ผลลัพธ์เดียวกัน
 *
 * `leaseToken` คือค่า `scoringStartedAt` ที่ caller (closeGameweek/tryResumeOrBusy) เพิ่งตั้งไว้ตอน CAS/takeover
 * สำเร็จ — ใช้เป็น fencing token ตรวจซ้ำก่อนจุดเขียนสำคัญแต่ละจุด (ไม่ใช่เชื่อว่า "ชนะ takeover ตอนแรกแล้วปลอดภัย
 * ตลอด") เพื่อกัน owner ที่เสีย lease ระหว่างทางเขียนทับ/แจกซ้ำ/ปิดสถานะทับ owner ใหม่ */
async function runScoring(
  gameweekId: string,
  now: Date,
  leaseToken: Date,
  nowProvider: NowProvider,
): Promise<CloseGameweekResult> {
  const gameweek = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });

  const entries = await prisma.fantasyEntry.findMany({
    where: { gameweekId },
    include: { slots: { orderBy: { slotIndex: "asc" } } },
  });
  const matches = await prisma.match.findMany({ where: { gameweekId }, include: { stats: true } });

  const statsByPlayerId = new Map<string, MatchStatLine[]>();
  for (const m of matches) {
    if (m.homeScore === null || m.awayScore === null) continue; // POSTPONED/CANCELLED ไม่มีสกอร์ ข้าม (Blank GW)
    for (const s of m.stats) {
      const goalsConceded = s.clubSide === "HOME" ? m.awayScore : m.homeScore;
      const line: MatchStatLine = {
        playerId: s.playerId,
        minutes: s.minutes,
        goals: s.goals,
        assists: s.assists,
        yellow: s.yellow,
        red: s.red,
        ownGoals: s.ownGoals,
        goalsConceded,
      };
      const arr = statsByPlayerId.get(s.playerId) ?? [];
      arr.push(line);
      statsByPlayerId.set(s.playerId, arr);
    }
  }

  // Draft entries (submittedAt === null, เช่นทีมที่ clone มาจาก getOrCreateEntry แต่ user ไม่เคยกด save จริง)
  // ต้องไม่เข้าสู่ ranking/leaderboard/reward เลย — ไม่ใช่แค่ห้ามรับรางวัล เพราะถ้าปนอยู่ใน computeRanks คะแนน
  // (แม้จะเป็น 0 หรือคำนวณจากทีมที่ไม่สมบูรณ์) ก็ยังไปแทรก/ดัน rank ของคนที่ submit จริงลงได้ จึงกรองทิ้งตั้งแต่ต้น
  // ก่อนคำนวณอะไรทั้งสิ้น ไม่สร้าง FantasyGameweekScore ให้ draft เลยสักแถว (ไม่ใช่ rank: null เพราะ getLeaderboard
  // sort ด้วย `rank: "asc"` และ SQLite เรียง NULL มาก่อนเสมอ — แถว rank:null จะโผล่บนสุดของ leaderboard ผิดที่)
  const submittedEntries = entries.filter((entry) => entry.submittedAt !== null);

  const scored = submittedEntries.map((entry) => {
    const starters: SubSlot[] = entry.slots
      .filter((s) => s.isStarter)
      .map((s) => ({ slotIndex: s.slotIndex, playerId: s.playerId, positionGroup: s.fantasyPositionGroup as PositionGroup }));
    const bench: BenchSlot[] = entry.slots
      .filter((s) => !s.isStarter)
      .map((s) => ({ benchPriority: s.benchPriority!, playerId: s.playerId, positionGroup: s.fantasyPositionGroup as PositionGroup }));
    const captainSlot = entry.slots.find((s) => s.isCaptain);
    const viceSlot = entry.slots.find((s) => s.isViceCaptain);
    if (!captainSlot || !viceSlot || starters.length === 0) {
      // submitted แล้วแต่ไม่มี captain/vice ไม่ควรเกิดจริง (saveEntry validate ก่อนเสมอ) — ป้องกันไว้เฉยๆ ไม่ error
      return { userId: entry.userId, points: 0 };
    }
    const result = scoreEntry(starters, bench, captainSlot.playerId, viceSlot.playerId, statsByPlayerId);
    return { userId: entry.userId, points: result.totalPoints };
  });

  const ranked = computeRanks(scored.map((s) => ({ userId: s.userId, points: s.points })));
  const participantCount = scored.length;

  // 1) Freeze คะแนน/อันดับ/rewardTier ทุก entry ที่ submit แล้วก่อน (idempotent — เขียนทับด้วยผลคำนวณเดิมเป๊ะทุกครั้ง)
  // ผูก renew lease กับ upsert แต่ละแถวไว้ใน transaction เดียวกันเสมอ (`withFencedLease`) ไม่ใช่ renew ครั้งเดียว
  // ก่อนลูปทั้งก้อน — ไม่งั้นยังมีช่องให้คู่แข่ง takeover ระหว่างทางแล้วเราเขียนทับต่อได้อยู่ดี (Codex adversarial
  // review รอบ 5 ชี้ตรงจุดนี้)
  let token: Date = leaseToken;
  for (const r of ranked) {
    const reward = rewardTierFor(r.rank, r.points, participantCount, "WEEKLY");
    const outcome = await withFencedLease(gameweekId, token, nowProvider, (tx) =>
      tx.fantasyGameweekScore.upsert({
        where: { userId_gameweekId: { userId: r.userId, gameweekId } },
        create: { userId: r.userId, gameweekId, points: r.points, rank: r.rank, rewardTier: reward?.key ?? null },
        update: { points: r.points, rank: r.rank, rewardTier: reward?.key ?? null },
      }),
    );
    if (!outcome) return { ok: false, error: "Gameweek นี้ถูก process อื่น resume ไปแล้วระหว่างที่ยังคำนวณคะแนนอยู่ ลองใหม่อีกครั้ง" };
    token = outcome.token;
  }

  // 2) แจกรางวัลทีละ recipient — ผูก renew lease กับการแจกจริง (ledger create + addCurrency/grantFreePack +
  // notification) ไว้ใน transaction เดียวกันเสมอเช่นเดียวกับ phase 1 (ledger unique ยังกันแจกซ้ำต่อ rewardType
  // เป็นอีกชั้นซ้อนอยู่ แต่ fencing ตรงนี้คือสิ่งที่ทำให้ owner ที่เสีย lease ไปแล้ว "ไม่มีทางเรียก grant ได้เลย"
  // ไม่ใช่แค่ "เรียกซ้ำได้แต่ไม่ถูกนับซ้ำ")
  for (const r of ranked) {
    const reward = rewardTierFor(r.rank, r.points, participantCount, "WEEKLY");
    if (!reward) continue;
    const outcome = await withFencedLease(gameweekId, token, nowProvider, (tx) =>
      grantWeeklyReward(tx, r.userId, gameweekId, gameweek.number, reward),
    );
    if (!outcome) return { ok: false, error: "Gameweek นี้ถูก process อื่น resume ไปแล้วระหว่างที่ยังแจกรางวัลอยู่ ลองใหม่อีกครั้ง" };
    token = outcome.token;
  }

  // 3) ครบทุก recipient แล้ว → CAS SCORING → SCORED ด้วย token เดิม (fencing เดียวกัน) กันปิดสถานะทับ owner ใหม่
  // ที่อาจ takeover ไปพอดีเป๊ะระหว่างบรรทัดนี้ — **ต้องเช็คผลลัพธ์จริง** (Codex adversarial review รอบ 4 ชี้ว่า
  // รอบก่อนหน้าทิ้ง count ไปเฉยๆ แล้วคืนสำเร็จอยู่ดี) ถ้าแพ้ (count===0) แปลว่ามีคน takeover ไปแล้วจริงๆ ระหว่างที่
  // เรากำลังแจกรางวัลรอบสุดท้าย ต้องคืน error ไม่ใช่รายงานว่าสำเร็จ (แม้คะแนน/รางวัลที่เขียนไปแล้วจะถูกต้องเพราะ
  // pure+idempotent ก็ตาม แต่ "เราไม่ใช่คนปิดจบสำเร็จ" ต้องสะท้อนใน CloseGameweekResult ตรงๆ)
  const closed = await prisma.gameweek.updateMany({
    where: { id: gameweekId, status: GAMEWEEK_STATUS.SCORING, scoringStartedAt: token },
    data: { status: GAMEWEEK_STATUS.SCORED, scoredAt: now },
  });
  if (closed.count === 0) {
    return { ok: false, error: "Gameweek นี้ถูก process อื่น resume ไปแล้วก่อนที่เราจะปิดสถานะสำเร็จ ลองใหม่อีกครั้ง" };
  }

  return { ok: true, alreadyScored: false, participantCount, scoredCount: participantCount };
}

/**
 * Gameweek อยู่ในสถานะ SCORING อยู่แล้ว (ไม่ว่าจะเจอตอนอ่านครั้งแรกหรือหลังแพ้ CAS เริ่มต้น) — ถ้ายังไม่ stale
 * ตอบ busy เฉยๆ ถ้า stale (เกิน `SCORING_STALE_THRESHOLD_MS` ถือว่า process เดิมตายแล้ว) ต้อง **ชิง lease ด้วย
 * CAS บน `scoringStartedAt` เดิมเป๊ะ** ก่อนจะ resume จริง — ไม่ใช่ทุก caller ที่เห็น stale พร้อมกันเรียก
 * `runScoring` ได้เลยทันที (Codex adversarial review รอบ 2 ชี้ว่านั่นทำให้หลาย resumer วิ่งซ้อนกันได้ ไม่ single-writer
 * จริงตามที่ตั้งใจไว้) — ผู้ชนะ takeover คนเดียวเท่านั้นที่ตั้ง `scoringStartedAt` ใหม่เป็น `now` สำเร็จ (`count===1`)
 * แล้วไปรัน `runScoring` ต่อ คนที่แพ้ takeover ถือว่ามีคนอื่นเข้าคุม lease ไปแล้ว ตอบ busy (หรือ alreadyScored ถ้า
 * ระหว่างนั้นมีคนทำจนจบไปแล้วพอดี)
 */
async function tryResumeOrBusy(
  gameweekId: string,
  scoringStartedAt: Date | null,
  now: Date,
  nowProvider: NowProvider,
): Promise<CloseGameweekResult> {
  const staleMs = now.getTime() - (scoringStartedAt?.getTime() ?? 0);
  if (staleMs < SCORING_STALE_THRESHOLD_MS) {
    return { ok: false, error: "Gameweek นี้กำลังประมวลผลคะแนนอยู่ ลองใหม่อีกครั้งในอีกสักครู่" };
  }

  const takeover = await prisma.gameweek.updateMany({
    where: { id: gameweekId, status: GAMEWEEK_STATUS.SCORING, scoringStartedAt },
    data: { scoringStartedAt: now },
  });
  if (takeover.count === 0) {
    // แพ้ takeover — เช็คสถานะสด: อาจมีคนอื่น resume จนจบไปแล้วพอดี (SCORED) หรือแค่แพ้ race แย่ง lease
    // (คนที่ชนะเพิ่งตั้ง scoringStartedAt ใหม่เป็นค่าสดๆ) ทั้งสองกรณีไม่ต้อง resume ซ้อนอีก
    const fresh = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
    if (fresh.status === GAMEWEEK_STATUS.SCORED) return { ok: true, alreadyScored: true };
    return { ok: false, error: "Gameweek นี้กำลังประมวลผลคะแนนอยู่ ลองใหม่อีกครั้งในอีกสักครู่" };
  }

  return runScoring(gameweekId, now, now, nowProvider); // now = token ที่เพิ่งตั้งใน updateMany ข้างบนตอน takeover สำเร็จ
}

/**
 * ปิด Gameweek — state machine UPCOMING/LOCKED → SCORING → SCORED (CAS + ledger, resumable/idempotent)
 * ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 7 — เรียกซ้ำ/พร้อมกันได้เสมอ ไม่ error ไม่แจกซ้ำ
 *
 * `nowProvider` มีไว้สำหรับ test เท่านั้น (จำลอง lease heartbeat/takeover ระหว่าง `runScoring`) — ใช้งานจริงไม่ต้อง
 * ส่งเลย ดีฟอลต์เป็นเวลาจริงเสมอ
 */
export async function closeGameweek(
  gameweekId: string,
  now: Date = new Date(),
  nowProvider: NowProvider = defaultNowProvider,
): Promise<CloseGameweekResult> {
  const gameweek = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) throw new Error("ไม่พบ Gameweek นี้");

  if (gameweek.status === GAMEWEEK_STATUS.SCORED) return { ok: true, alreadyScored: true };

  if (gameweek.status === GAMEWEEK_STATUS.SCORING) {
    return tryResumeOrBusy(gameweekId, gameweek.scoringStartedAt, now, nowProvider);
  }

  if (now < gameweek.deadline) throw new Error("ยังไม่ถึง deadline ของ Gameweek นี้");

  const matches = await prisma.match.findMany({ where: { gameweekId } });
  if (matches.length === 0) throw new Error("Gameweek นี้ยังไม่มีแมตช์เลย");
  const unscored = matches.filter(
    (m) => m.status !== "POSTPONED" && m.status !== "CANCELLED" && (m.homeScore === null || m.awayScore === null),
  );
  if (unscored.length > 0) throw new Error(`มีแมตช์ที่ยังไม่ได้กรอกสกอร์ ${unscored.length} คู่`);

  // CAS: ผู้ชนะคนเดียวเข้าสู่ SCORING — กันเรียกซ้ำ/parallel
  const cas = await prisma.gameweek.updateMany({
    where: { id: gameweekId, status: { in: [GAMEWEEK_STATUS.UPCOMING, GAMEWEEK_STATUS.LOCKED] } },
    data: { status: GAMEWEEK_STATUS.SCORING, scoringStartedAt: now },
  });
  if (cas.count === 0) {
    const fresh = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
    if (fresh.status === GAMEWEEK_STATUS.SCORED) return { ok: true, alreadyScored: true };
    if (fresh.status === GAMEWEEK_STATUS.SCORING) {
      return tryResumeOrBusy(gameweekId, fresh.scoringStartedAt, now, nowProvider);
    }
    return { ok: false, error: "ไม่สามารถเริ่มปิด Gameweek ได้ (สถานะเปลี่ยนไปแล้วระหว่างเช็ค)" };
  }

  return runScoring(gameweekId, now, now, nowProvider); // now = token ที่เพิ่งตั้งใน CAS ข้างบนตอนชนะเข้าสู่ SCORING
}
