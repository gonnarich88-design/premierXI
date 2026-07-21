// src/lib/fantasyScoring.test.ts — รัน: npx tsx --test src/lib/fantasyScoring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePlayer, resolveAutoSubs, type MatchStatLine, type SubSlot, type BenchSlot } from "./fantasyScoring";

function stat(overrides: Partial<MatchStatLine> = {}): MatchStatLine {
  return { playerId: "p1", minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, ownGoals: 0, goalsConceded: 0, ...overrides };
}

test("scorePlayer: appearance boundaries (0 / 1-59 / 60+)", () => {
  assert.equal(scorePlayer(stat({ minutes: 0 }), "MID"), 0);
  assert.equal(scorePlayer(stat({ minutes: 1 }), "MID"), 1);
  assert.equal(scorePlayer(stat({ minutes: 59 }), "MID"), 1);
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 1 }), "MID"), 2);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 1 }), "MID"), 2);
});

test("scorePlayer: goal points differ by position group", () => {
  assert.equal(scorePlayer(stat({ minutes: 90, goals: 1, goalsConceded: 1 }), "GK"), 2 + 10);
  assert.equal(scorePlayer(stat({ minutes: 90, goals: 1, goalsConceded: 1 }), "DEF"), 2 + 6);
  assert.equal(scorePlayer(stat({ minutes: 90, goals: 1, goalsConceded: 1 }), "MID"), 2 + 5);
  assert.equal(scorePlayer(stat({ minutes: 90, goals: 1, goalsConceded: 1 }), "ATT"), 2 + 4);
});

test("scorePlayer: assist is 3 for every position", () => {
  for (const group of ["GK", "DEF", "MID", "ATT"] as const) {
    assert.equal(scorePlayer(stat({ minutes: 90, assists: 1, goalsConceded: 1 }), group), 2 + 3);
  }
});

test("scorePlayer: clean sheet requires >=60 minutes", () => {
  assert.equal(scorePlayer(stat({ minutes: 59, goalsConceded: 0 }), "DEF"), 1, "59 min ไม่ได้คลีนชีตแม้เสีย 0 ประตู");
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 0 }), "DEF"), 2 + 4, "60 min + เสีย 0 ได้คลีนชีต");
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 0 }), "GK"), 2 + 4);
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 0 }), "MID"), 2 + 1);
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 0 }), "ATT"), 2 + 0);
});

test("scorePlayer: goals conceded penalty rounds down every 2, only GK/DEF", () => {
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 1 }), "GK"), 2 - 0);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 2 }), "GK"), 2 - 1);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 3 }), "GK"), 2 - 1);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 4 }), "DEF"), 2 - 2);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 4 }), "MID"), 2, "MID/ATT ไม่โดนหักเสียประตู");
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 4 }), "ATT"), 2);
});

test("scorePlayer: cards and own goals", () => {
  assert.equal(scorePlayer(stat({ minutes: 90, yellow: 1, goalsConceded: 1 }), "MID"), 2 - 1);
  assert.equal(scorePlayer(stat({ minutes: 90, red: 1, goalsConceded: 1 }), "MID"), 2 - 3);
  assert.equal(scorePlayer(stat({ minutes: 90, ownGoals: 1, goalsConceded: 1 }), "MID"), 2 - 2);
});

// roster คงที่: formation 4-3-3 (GK1, DEF4, MID3, ATT3) + bench GK1/DEF1/MID1/ATT1 = 15 คน
const STARTERS: SubSlot[] = [
  { slotIndex: 0, playerId: "S0_GK", positionGroup: "GK" },
  { slotIndex: 1, playerId: "S1_DEF", positionGroup: "DEF" },
  { slotIndex: 2, playerId: "S2_DEF", positionGroup: "DEF" },
  { slotIndex: 3, playerId: "S3_DEF", positionGroup: "DEF" },
  { slotIndex: 4, playerId: "S4_DEF", positionGroup: "DEF" },
  { slotIndex: 5, playerId: "S5_MID", positionGroup: "MID" },
  { slotIndex: 6, playerId: "S6_MID", positionGroup: "MID" },
  { slotIndex: 7, playerId: "S7_MID", positionGroup: "MID" },
  { slotIndex: 8, playerId: "S8_ATT", positionGroup: "ATT" },
  { slotIndex: 9, playerId: "S9_ATT", positionGroup: "ATT" },
  { slotIndex: 10, playerId: "S10_ATT", positionGroup: "ATT" },
];
const BENCH: BenchSlot[] = [
  { benchPriority: 1, playerId: "B1_GK", positionGroup: "GK" },
  { benchPriority: 2, playerId: "B2_DEF", positionGroup: "DEF" },
  { benchPriority: 3, playerId: "B3_MID", positionGroup: "MID" },
  { benchPriority: 4, playerId: "B4_ATT", positionGroup: "ATT" },
];
const ALL_15 = [...STARTERS.map((s) => s.playerId), ...BENCH.map((b) => b.playerId)];

function minutesFromBitmask(mask: number): Map<string, number> {
  const m = new Map<string, number>();
  ALL_15.forEach((playerId, i) => m.set(playerId, (mask >> i) & 1 ? 90 : 0));
  return m;
}

test("resolveAutoSubs: never reuses a bench player twice and never returns duplicate playerIds", () => {
  for (let mask = 0; mask < 1 << 15; mask++) {
    const minutes = minutesFromBitmask(mask);
    const result = resolveAutoSubs(STARTERS, BENCH, minutes);
    const seen = new Set(result.playerIds);
    assert.equal(seen.size, result.playerIds.length, `mask=${mask}: duplicate playerId in result`);
    const inIds = result.substitutions.map((s) => s.inPlayerId);
    assert.equal(new Set(inIds).size, inIds.length, `mask=${mask}: same bench player used twice`);
  }
});

test("resolveAutoSubs: result is order-independent (shuffled input gives identical output)", () => {
  const shuffledStarters = [...STARTERS].reverse();
  const shuffledBench = [...BENCH].reverse();
  for (let mask = 0; mask < 1 << 15; mask += 97) {
    // สุ่มตัวอย่าง (ไม่ไล่ครบ 32768 ซ้ำสองรอบ กันช้าเกิน) — step เฉพาะจำนวนเฉพาะกันชนแพทเทิร์น bit ซ้ำ
    const minutes = minutesFromBitmask(mask);
    const a = resolveAutoSubs(STARTERS, BENCH, minutes);
    const b = resolveAutoSubs(shuffledStarters, shuffledBench, minutes);
    assert.deepEqual(
      [...a.playerIds].sort(),
      [...b.playerIds].sort(),
      `mask=${mask}: shuffled input order changed the result`,
    );
  }
});

test("resolveAutoSubs: GK sub only replaces GK, never touches outfield bench pool", () => {
  const minutes = minutesFromBitmask(0); // ไม่มีใครลงสนามเลย ยกเว้นที่ตั้งเอง
  minutes.set("S0_GK", 0);
  minutes.set("B1_GK", 90);
  for (const s of STARTERS.slice(1)) minutes.set(s.playerId, 90); // outfield starters ทั้งหมดลงสนามปกติ
  const result = resolveAutoSubs(STARTERS, BENCH, minutes);
  assert.ok(result.playerIds.includes("B1_GK"));
  assert.equal(result.substitutions.length, 1);
  assert.deepEqual(result.substitutions[0], { outPlayerId: "S0_GK", inPlayerId: "B1_GK" });
});

test("resolveAutoSubs: no valid bench GK leaves final XI without a goalkeeper (edge case 11)", () => {
  const minutes = minutesFromBitmask(0);
  for (const s of STARTERS.slice(1)) minutes.set(s.playerId, 90);
  minutes.set("S0_GK", 0);
  minutes.set("B1_GK", 0); // bench GK ก็ไม่ได้ลงสนาม
  const result = resolveAutoSubs(STARTERS, BENCH, minutes);
  assert.ok(!result.playerIds.includes("S0_GK"));
  assert.ok(!result.playerIds.includes("B1_GK"));
  assert.equal(result.playerIds.length, 10, "final XI เหลือ 10 คนไม่มี GK ได้ ไม่ error");
});

test("resolveAutoSubs: bench player used when the substitution satisfies the DEF>=3 minimum", () => {
  const minutes = minutesFromBitmask(0);
  for (const s of STARTERS) minutes.set(s.playerId, 90);
  minutes.set("S1_DEF", 0); // no-show แค่ 1 คน (S2,S3,S4 ยังลงสนามอยู่ = DEF จริง 3 อยู่แล้ว)
  minutes.set("B2_DEF", 90);
  const result = resolveAutoSubs(STARTERS, BENCH, minutes);
  assert.ok(result.playerIds.includes("B2_DEF"));
  assert.equal(result.substitutions.length, 1);
  assert.deepEqual(result.substitutions[0], { outPlayerId: "S1_DEF", inPlayerId: "B2_DEF" });
  assert.equal(result.playerIds.filter((id) => id.endsWith("_DEF")).length, 4, "DEF ครบ 4 คน (S2,S3,S4,B2) — ยังใช้ตัวสำรองแม้ไม่ได้ต่ำกว่าขั้นต่ำอยู่แล้วก็ตาม");
});

test("resolveAutoSubs: bench player stays unused when it can never reach the DEF>=3 minimum on its own", () => {
  // DEF ไม่ลงสนาม 3 ใน 4 คน (S1,S2,S3) เหลือจริงแค่ S4 — มีตัวสำรอง DEF แค่ 1 คน (B2) ใช้แทนได้สูงสุด DEF=2 (S4+B2)
  // ยังไม่ถึงขั้นต่ำ 3 ไม่ว่าจะแทนช่องไหนก็ตาม จึงไม่ถูกใช้เลยสักช่อง (ตรงตามสเปคหัวข้อ 5 ข้อ 8 — final XI เหลือน้อยกว่า
  // 11 คนได้ ถ้าไม่มีตัวสำรองที่ถูกกติกาจริงๆ ไม่ error ไม่บังคับเติม)
  const minutes = minutesFromBitmask(0);
  for (const s of STARTERS) minutes.set(s.playerId, 90);
  minutes.set("S1_DEF", 0);
  minutes.set("S2_DEF", 0);
  minutes.set("S3_DEF", 0);
  minutes.set("B2_DEF", 90); // B3_MID/B4_ATT/B1_GK ไม่ได้ลงสนาม (default 0) กันไม่ให้ช่วยทางอ้อม
  const result = resolveAutoSubs(STARTERS, BENCH, minutes);
  assert.ok(!result.playerIds.includes("B2_DEF"), "ใช้แทนแล้วก็ยังไม่ถึงขั้นต่ำ DEF>=3 (2<3) จึงไม่ถูกใช้เลย");
  assert.equal(result.substitutions.length, 0);
  assert.ok(!result.playerIds.includes("S1_DEF") && !result.playerIds.includes("S2_DEF") && !result.playerIds.includes("S3_DEF"));
  assert.ok(result.playerIds.includes("S4_DEF"));
  assert.equal(result.playerIds.filter((id) => id.endsWith("_DEF")).length, 1, "เหลือ DEF จริงแค่ S4 คนเดียว ไม่มีใครมาเสริมได้");
});

test("resolveAutoSubs: accepts two simultaneous substitutions across different groups when only both together restore the minimum (regression — greedy single-swap check used to reject both entirely)", () => {
  // DEF ขาด 2 คน (เหลือ S3,S4 = 2 <3) พร้อมกับ MID ขาด 2 คน (เหลือ S7 = 1 <2) — มีตัวสำรองพอดี 1 คนต่อกลุ่ม
  // (B2_DEF, B3_MID) ที่ทำให้ครบขั้นต่ำได้ถ้าใช้ทั้งคู่พร้อมกัน (DEF: 2+1=3, MID: 1+1=2) แต่ใช้แค่ตัวใดตัวหนึ่งเดี่ยวๆ
  // ไม่มีทางทำให้ทั้งทีม valid ได้เลย (อีกกลุ่มยังขาดอยู่ดี) — resolver แบบ greedy เดิมเช็ค validity ทั้งทีมทันที
  // หลังแทนแค่คู่เดียว จึงไม่ยอมรับคู่ไหนเลยสักคู่ (ลองแทน B2 คนเดียว → MID ยังขาด → invalid → revert, ลองแทน B3
  // คนเดียว → DEF ยังขาด → invalid → revert) สุดท้ายได้ 0 substitutions ทั้งที่มีคำตอบที่ valid จริงถ้าใช้ทั้งคู่
  const minutes = minutesFromBitmask(0);
  for (const s of STARTERS) minutes.set(s.playerId, 90);
  minutes.set("S1_DEF", 0);
  minutes.set("S2_DEF", 0); // DEF เหลือ S3,S4 = 2 (<3)
  minutes.set("S5_MID", 0);
  minutes.set("S6_MID", 0); // MID เหลือ S7 = 1 (<2)
  minutes.set("B2_DEF", 90);
  minutes.set("B3_MID", 90); // B4_ATT/B1_GK ไม่ได้ลงสนาม กันไม่ให้ช่วยทางอ้อม
  const result = resolveAutoSubs(STARTERS, BENCH, minutes);
  assert.equal(result.substitutions.length, 2, "ต้องใช้ตัวสำรองทั้ง B2(DEF) และ B3(MID) พร้อมกันถึงจะ valid — ใช้แค่ตัวเดียวไม่พอ");
  const inIds = result.substitutions.map((s) => s.inPlayerId).sort();
  assert.deepEqual(inIds, ["B2_DEF", "B3_MID"]);
  assert.equal(result.playerIds.filter((id) => id.endsWith("_DEF")).length, 3, "DEF: S3,S4,B2 = 3 พอดีขั้นต่ำ");
  assert.equal(result.playerIds.filter((id) => id.endsWith("_MID")).length, 2, "MID: S7,B3 = 2 พอดีขั้นต่ำ");
  assert.equal(result.playerIds.length, 9, "final XI เหลือ 9 คน (S1,S2,S5,S6 หลุดไปเฉยๆ ไม่มีใครมาเติมช่องที่เหลือ)");
});
