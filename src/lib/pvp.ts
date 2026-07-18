// PvP (Phase 3) — pattern เดียวกับ packs.ts/daily.ts: pure function ก่อน แยกจาก DB access
// เพื่อเทสได้โดยไม่พึ่ง Math.random()/new Date() จริงตอนรัน — ดู docs/superpowers/specs/2026-07-17-pvp-design.md

import { POSITION_GROUP, type Position } from "@/lib/constants";

export const PVP_TIERS = [
  { key: "bronze", label: "Bronze", min: 0 },
  { key: "silver", label: "Silver", min: 100 },
  { key: "gold", label: "Gold", min: 250 },
  { key: "elite", label: "Elite", min: 450 },
  { key: "champion", label: "Champion", min: 700 },
  { key: "legend", label: "Legend", min: 1000 },
] as const;
export type PvpTierKey = (typeof PVP_TIERS)[number]["key"];
export type PvpTier = (typeof PVP_TIERS)[number];

/** Tier ไม่ store แยกใน DB — derive จาก pvpRP เสมอ (single source of truth เดียวกับแนวทาง levelReward() ใน economy.ts) */
export function tierForRP(rp: number): PvpTier {
  return [...PVP_TIERS].reverse().find((t) => rp >= t.min)!;
}

/** season = เดือนปฏิทิน UTC เสมอ ("2026-07") — ตัว boundary UTC เดียวกับที่ dayIndex()/daily.ts ใช้ทั้งระบบ */
export function seasonKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** โบนัส EXP ต่อ win-streak คำนวณจาก streak ใหม่หลัง increment แล้ว (newStreak=1→0, 2→+5, 3→+10, 4+→เพดาน+15) */
export function winStreakBonus(newStreak: number): number {
  return Math.min((newStreak - 1) * 5, 15);
}

/** multiplier ตาม opponent strength — ใช้ร่วมกันทั้ง EXP/Silver (ตอนชนะ) และ RP (ทั้งชนะ/แพ้) */
export function rpMultiplier(oppRating: number, myRating: number): number {
  return Math.min(1.5, Math.max(0.5, oppRating / myRating));
}

/** RP ที่ได้/เสียต่อแมตช์ — ทิศทางสลับกันตั้งใจตอนแพ้ (คู่แข่งอ่อนกว่าเสีย RP เยอะกว่า คู่แข่งแรงกว่าเสียน้อยกว่า)
 * ที่ multiplier=1 ชนะ+20/แพ้-15 ไม่ zero-sum โดยตั้งใจ (progression ladder ชดเชยด้วย hard reset รายเดือน — ดูสเปคหัวข้อ 7) */
export function rpDeltaForOutcome(outcome: "win" | "draw" | "lose", mult: number): number {
  if (outcome === "win") return Math.round(20 * mult);
  if (outcome === "lose") return -Math.round(15 * (2 - mult));
  return 0;
}

export type LineupEntry = { name: string; ovr: number; slotPos: string };
export type GoalEvent = { minute: number; scorer: string; assist?: string };
export type MatchGoalEvent = GoalEvent & { team: "me" | "opp" };
export type MatchResult = { myGoals: number; oppGoals: number; events: MatchGoalEvent[] };

const SHOOT_WEIGHT: Record<"GK" | "DEF" | "MID" | "ATT", number> = { ATT: 3.0, MID: 1.5, DEF: 0.4, GK: 0.05 };
const ASSIST_WEIGHT: Record<"GK" | "DEF" | "MID" | "ATT", number> = { MID: 3.0, ATT: 1.5, DEF: 0.5, GK: 0.1 };

const GOAL_COUNT_TABLE: { total: number; chance: number }[] = [
  { total: 0, chance: 0.1 },
  { total: 1, chance: 0.2 },
  { total: 2, chance: 0.28 },
  { total: 3, chance: 0.22 },
  { total: 4, chance: 0.12 },
  { total: 5, chance: 0.08 },
];

function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: () => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = rng() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function pickGoalCount(rng: () => number): number {
  const r = rng();
  let acc = 0;
  for (const row of GOAL_COUNT_TABLE) {
    acc += row.chance;
    if (r < acc) return row.total;
  }
  return GOAL_COUNT_TABLE[GOAL_COUNT_TABLE.length - 1].total;
}

function scoreGoal(lineup: LineupEntry[], rng: () => number): GoalEvent {
  const scorer = pickWeighted(lineup, (e) => SHOOT_WEIGHT[POSITION_GROUP[e.slotPos as Position]], rng);
  const minute = Math.floor(rng() * 90) + 1;
  if (rng() >= 0.75) return { minute, scorer: scorer.name };

  const assistPool = lineup.filter((e) => e !== scorer);
  if (assistPool.length === 0) return { minute, scorer: scorer.name };
  const assistBy = pickWeighted(assistPool, (e) => ASSIST_WEIGHT[POSITION_GROUP[e.slotPos as Position]], rng);
  return { minute, scorer: scorer.name, assist: assistBy.name };
}

/** จำลองผลแมตช์ทั้งหมด (สกอร์ + goal events) — pure function รับ rng แยกเพื่อเทสได้โดยไม่พึ่ง Math.random() จริง */
export function simulateMatch(
  myRating: number,
  oppRating: number,
  myLineup: LineupEntry[],
  oppLineup: LineupEntry[],
  rng: () => number = Math.random,
): MatchResult {
  const myScore = myRating * (0.85 + rng() * 0.3);
  const oppScore = oppRating * (0.85 + rng() * 0.3);
  const strengthRatio = myScore / (myScore + oppScore);

  const totalGoals = pickGoalCount(rng);
  const events: MatchGoalEvent[] = [];
  let myGoals = 0;
  let oppGoals = 0;

  for (let i = 0; i < totalGoals; i++) {
    const isMine = rng() < strengthRatio;
    const goal = scoreGoal(isMine ? myLineup : oppLineup, rng);
    events.push({ ...goal, team: isMine ? "me" : "opp" });
    if (isMine) myGoals++;
    else oppGoals++;
  }

  events.sort((a, b) => a.minute - b.minute);
  return { myGoals, oppGoals, events };
}
