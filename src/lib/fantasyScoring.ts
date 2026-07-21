// src/lib/fantasyScoring.ts
// Pure scoring engine ของ Fantasy Premier XI — ห้าม import prisma ในไฟล์นี้เด็ดขาด (เทสได้โดยไม่พึ่ง DB)
// ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 4-6
import { SCORING, FORMATION_MIN, PARTICIPANT_TIERS, WEEKLY_REWARDS, type PositionGroup, type RewardSpec } from "@/lib/fantasyConfig";

export type MatchStatLine = {
  playerId: string;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  ownGoals: number;
  goalsConceded: number;
};

/** คะแนนของนักเตะ 1 คนใน 1 แมตช์ (ไม่รวม captain multiplier — คูณทีหลังใน scoreEntry) */
export function scorePlayer(stat: MatchStatLine, positionGroup: PositionGroup): number {
  let points = 0;

  if (stat.minutes >= 60) points += SCORING.APPEARANCE_FULL;
  else if (stat.minutes >= 1) points += SCORING.APPEARANCE_SHORT;

  points += stat.goals * SCORING.GOAL[positionGroup];
  points += stat.assists * SCORING.ASSIST;

  const cleanSheet = stat.minutes >= 60 && stat.goalsConceded === 0;
  if (cleanSheet) points += SCORING.CLEAN_SHEET[positionGroup];

  if (positionGroup === "GK" || positionGroup === "DEF") {
    points -= Math.floor(stat.goalsConceded / SCORING.GOALS_CONCEDED_PER_POINT);
  }

  points += stat.yellow * SCORING.YELLOW;
  points += stat.red * SCORING.RED;
  points += stat.ownGoals * SCORING.OWN_GOAL;

  return points;
}

export type SubSlot = { slotIndex: number; playerId: string; positionGroup: PositionGroup };
export type BenchSlot = { benchPriority: number; playerId: string; positionGroup: PositionGroup };
export type EffectiveXIResult = {
  playerIds: string[];
  substitutions: { outPlayerId: string; inPlayerId: string }[];
};

function playedMinutes(playerId: string, minutesByPlayerId: Map<string, number>): boolean {
  return (minutesByPlayerId.get(playerId) ?? 0) > 0;
}

/**
 * Auto-substitution แบบ deterministic — ผลลัพธ์ห้ามขึ้นกับลำดับ input (sort เองภายในฟังก์ชันเสมอ)
 * Algorithm ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 5 ทีละขั้นตรงตามสเปค:
 * 1-2) GK แทนได้เฉพาะ GK  3-4) เรียง no-show ตาม slotIndex, เรียงตัวสำรองตาม benchPriority
 * 5-6) หาชุด (subset) ของตัวสำรอง outfield ที่ทำให้ **final XI** (หลังแทนทุกคู่ในชุดนั้นพร้อมกัน) มี
 * DEF>=3, MID>=2, ATT>=1 จริง — ค้นหาแบบ exhaustive ไม่ใช่ตัดสินทีละคู่แบบ greedy เพราะ greedy เช็ค validity
 * ทันทีหลังแทนแค่คู่เดียวจะ reject substitution ที่ถูกต้องทิ้งไปเมื่อต้องใช้ตัวสำรอง 2+ คนร่วมกันถึงจะกลับมา valid
 * (เช่น DEF ขาดพร้อมกับ MID ขาด ต้องใช้ทั้งตัวสำรอง DEF และ MID พร้อมกันถึงจะครบ ทั้งสองคู่จึงต้องถูกยอมรับด้วยกัน
 * ไม่ใช่ถูก reject ทีละคู่เพราะเช็คว่า "แค่คู่นี้คู่เดียว" ทำให้ทั้งทีม valid หรือยัง) — ในบรรดาทุกชุดที่ valid
 * เลือกชุดที่ใหญ่ที่สุด (ใช้ตัวสำรองให้มากที่สุดเท่าที่ยัง valid เพราะมีค่าคาดหวังแต้มเพิ่มขึ้นเสมอ ไม่เคยทำให้แย่ลง
 * เนื่องจากเป็นเงื่อนไขขั้นต่ำอย่างเดียว) ถ้ามีหลายชุดขนาดเท่ากันที่ valid พร้อมกัน เลือกชุดที่มี benchPriority
 * รวมน้อยที่สุด (ให้ความสำคัญกับตัวสำรอง priority สูงก่อนเสมอ) เพื่อ deterministic
 * 7) ห้ามใช้ตัวสำรองซ้ำ (แต่ละคนอยู่ใน subset ได้แค่ตำแหน่งเดียว โดยธรรมชาติของการเลือก subset)
 * 8) ถ้าไม่มีชุดใดเลย (รวมชุดว่าง) ทำให้ valid ได้ ปล่อยให้ final XI เหลือน้อยกว่า 11 คนได้ (ไม่ error ไม่บังคับเติม)
 * ขนาด search space เล็กมาก (bench outfield สูงสุด `MAX_BENCH_SIZE - 1 = 3` คน → รวมไม่เกิน 2^3=8 ชุดย่อยที่ต้องเช็ค)
 */
export function resolveAutoSubs(
  starters: SubSlot[],
  bench: BenchSlot[],
  minutesByPlayerId: Map<string, number>,
): EffectiveXIResult {
  const effective = new Map<number, string>(); // slotIndex -> playerId ที่อยู่ในช่องนั้นตอนนี้
  for (const s of starters) effective.set(s.slotIndex, s.playerId);

  const substitutions: { outPlayerId: string; inPlayerId: string }[] = [];

  // --- ขั้น 1-2: GK แทนได้เฉพาะ GK (มีได้แค่คู่เดียวเสมอ ไม่ต้อง combinatorial search) ---
  const starterGkSlot = starters.find((s) => s.positionGroup === "GK");
  if (starterGkSlot && !playedMinutes(starterGkSlot.playerId, minutesByPlayerId)) {
    const benchGk = [...bench]
      .filter((b) => b.positionGroup === "GK" && playedMinutes(b.playerId, minutesByPlayerId))
      .sort((a, b) => a.benchPriority - b.benchPriority)[0];
    if (benchGk) {
      effective.set(starterGkSlot.slotIndex, benchGk.playerId);
      substitutions.push({ outPlayerId: starterGkSlot.playerId, inPlayerId: benchGk.playerId });
    }
  }

  // --- ขั้น 3-8: outfield — เลือก subset ที่ใหญ่ที่สุดของตัวสำรองที่ทำให้ final XI valid จริง ---
  const noShowOutfield = starters
    .filter((s) => s.positionGroup !== "GK" && !playedMinutes(s.playerId, minutesByPlayerId))
    .sort((a, b) => a.slotIndex - b.slotIndex);

  const availableBenchOutfield = bench
    .filter((b) => b.positionGroup !== "GK" && playedMinutes(b.playerId, minutesByPlayerId))
    .sort((a, b) => a.benchPriority - b.benchPriority);

  // จำนวนคนที่ "ลงสนามจริง" ต่อกลุ่ม ไม่นับ no-show (ก่อนแทนใดๆ) — ใช้ group ของตัวคนเอง (frozen
  // fantasyPositionGroup) เสมอ ไม่ใช่ group เดิมของ slot ที่เขาไปแทน ตรงกับหลักการในสเปคหัวข้อ 3
  const baseCounts: Record<PositionGroup, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const s of starters) {
    if (s.positionGroup === "GK") continue;
    if (playedMinutes(s.playerId, minutesByPlayerId)) baseCounts[s.positionGroup]++;
  }

  function isValid(counts: Record<PositionGroup, number>): boolean {
    return counts.DEF >= FORMATION_MIN.DEF && counts.MID >= FORMATION_MIN.MID && counts.ATT >= FORMATION_MIN.ATT;
  }

  const n = availableBenchOutfield.length;
  const capacity = Math.min(n, noShowOutfield.length); // ใช้ตัวสำรองเกินจำนวนช่อง no-show ที่มีจริงไม่ได้

  function combinationsOfSize(size: number): number[][] {
    const result: number[][] = [];
    const chosen: number[] = [];
    function build(start: number) {
      if (chosen.length === size) {
        result.push([...chosen]);
        return;
      }
      for (let i = start; i < n; i++) {
        chosen.push(i);
        build(i + 1);
        chosen.pop();
      }
    }
    build(0);
    return result;
  }

  // ไล่จากขนาดใหญ่สุด (capacity) ลงมาถึง 0 — เจอชุดแรกที่ valid ในขนาดที่ใหญ่ที่สุดเท่าที่เป็นไปได้ก็หยุดทันที
  // combinationsOfSize ไล่ index จากน้อยไปมากเสมอ (ตัวสำรอง priority สูงกว่า = index น้อยกว่า หลัง sort ข้างบน)
  // จึงได้ชุดที่ priority รวมน้อยที่สุดในบรรดาชุดขนาดเท่ากันโดยอัตโนมัติ — ผลลัพธ์ deterministic เสมอ
  let bestSubsetIndices: number[] = [];
  searchSizes: for (let size = capacity; size >= 0; size--) {
    for (const subset of combinationsOfSize(size)) {
      const counts = { ...baseCounts };
      for (const idx of subset) counts[availableBenchOutfield[idx].positionGroup]++;
      if (isValid(counts)) {
        bestSubsetIndices = subset;
        break searchSizes;
      }
    }
  }

  const chosenBenchPlayers = bestSubsetIndices.map((idx) => availableBenchOutfield[idx]);
  for (let i = 0; i < chosenBenchPlayers.length; i++) {
    const noShow = noShowOutfield[i];
    effective.set(noShow.slotIndex, chosenBenchPlayers[i].playerId);
    substitutions.push({ outPlayerId: noShow.playerId, inPlayerId: chosenBenchPlayers[i].playerId });
  }

  const playerIds = [...effective.values()].filter((playerId) => playedMinutes(playerId, minutesByPlayerId));
  return { playerIds, substitutions };
}

/**
 * เลือกว่าใครได้ captain multiplier x2 — ตรวจจาก minutes ของ captain/vice ตัวจริงเท่านั้น (ไม่สนใจว่าใครถูกแทนเข้ามา
 * ในช่องนั้น เพราะ "ตัวสำรองที่เข้ามาแทน Captain ไม่รับตำแหน่ง Captain ต่อ" — ดูสเปคหัวข้อ 6 ข้อ 5)
 */
export function resolveCaptain(
  captainPlayerId: string,
  viceCaptainPlayerId: string,
  minutesByPlayerId: Map<string, number>,
): string | null {
  if (playedMinutes(captainPlayerId, minutesByPlayerId)) return captainPlayerId;
  if (playedMinutes(viceCaptainPlayerId, minutesByPlayerId)) return viceCaptainPlayerId;
  return null;
}

export type ScoredPlayer = { playerId: string; points: number; isCaptain: boolean; substitutedIn: boolean };
export type ScoreEntryResult = {
  totalPoints: number;
  players: ScoredPlayer[];
  substitutions: { outPlayerId: string; inPlayerId: string }[];
};

/**
 * คิดคะแนนทีมทั้งทีม 1 Gameweek — รวม auto-sub + captain + Double/Blank Gameweek (statsByPlayerId มี 0/1/2
 * แถวต่อคนได้ตามจำนวนแมตช์ที่ทีมนั้นเล่นใน GW นี้ ผลรวมจากทุกแมตช์ตามสเปคหัวข้อ 9)
 * ใช้ fantasyPositionGroup ที่ freeze มากับแต่ละ slot เสมอ (ไม่ใช่ group ของช่องที่ไปแทน) ตามสเปคหัวข้อ 3
 */
export function scoreEntry(
  starters: SubSlot[],
  bench: BenchSlot[],
  captainPlayerId: string,
  viceCaptainPlayerId: string,
  statsByPlayerId: Map<string, MatchStatLine[]>,
): ScoreEntryResult {
  const minutesByPlayerId = new Map<string, number>();
  const groupByPlayerId = new Map<string, PositionGroup>();
  for (const s of [...starters, ...bench]) {
    groupByPlayerId.set(s.playerId, s.positionGroup);
    const rows = statsByPlayerId.get(s.playerId) ?? [];
    minutesByPlayerId.set(
      s.playerId,
      rows.reduce((sum, r) => sum + r.minutes, 0),
    );
  }

  const { playerIds: effectivePlayerIds, substitutions } = resolveAutoSubs(starters, bench, minutesByPlayerId);
  const captainId = resolveCaptain(captainPlayerId, viceCaptainPlayerId, minutesByPlayerId);
  const subInIds = new Set(substitutions.map((s) => s.inPlayerId));

  const players: ScoredPlayer[] = effectivePlayerIds.map((playerId) => {
    const rows = statsByPlayerId.get(playerId) ?? [];
    const group = groupByPlayerId.get(playerId)!;
    const base = rows.reduce((sum, r) => sum + scorePlayer(r, group), 0);
    const isCaptain = playerId === captainId;
    const points = isCaptain ? base * SCORING.CAPTAIN_MULTIPLIER : base;
    return { playerId, points, isCaptain, substitutedIn: subInIds.has(playerId) };
  });

  const totalPoints = players.reduce((sum, p) => sum + p.points, 0);
  return { totalPoints, players, substitutions };
}

export type ScoreRow = { userId: string; points: number };
export type RankedScore = { userId: string; points: number; rank: number };

/** Competition ranking (1,2,2,4) — คะแนนเท่ากันได้อันดับเดียวกัน คนถัดไปข้ามอันดับที่ถูกใช้ไปแล้ว
 * secondary sort ด้วย userId กันผลลัพธ์เปลี่ยนตาม row order ของ DB (rank เลขเดียวกันเสมอไม่ว่าจะ sort ด้วยอะไร
 * แต่ลำดับ array output ต้อง deterministic ด้วยเพื่อ audit ซ้ำได้) — ดูสเปคหัวข้อ 10 */
export function computeRanks(scores: ScoreRow[]): RankedScore[] {
  const sorted = [...scores].sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId));
  const result: RankedScore[] = [];
  let rank = 0;
  let prevPoints: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    if (prevPoints === null || sorted[i].points !== prevPoints) rank = i + 1;
    result.push({ userId: sorted[i].userId, points: sorted[i].points, rank });
    prevPoints = sorted[i].points;
  }
  return result;
}

/** จำนวนผู้เข้าแข่งขันจริง (submittedAt != null) → เปิด payout ถึงอันดับเท่าไหร่ — ดูสเปคหัวข้อ 12 */
export function participantRankLimit(participantCount: number): number {
  for (const tier of PARTICIPANT_TIERS) {
    if (participantCount >= tier.minParticipants) return tier.rankLimit;
  }
  return 0;
}

/** ผลลัพธ์ = min(rankLimit จาก participant tier, maxRank ของตาราง reward) โดยธรรมชาติ เพราะต้องผ่านทั้งสองเงื่อนไข
 * ยังไม่มี MONTHLY_REWARDS ใน 7B (มาจริงใน 7C) — เรียกด้วย "MONTHLY" ตอนนี้ throw ชัดเจนแทนคืนพฤติกรรมผิด
 *
 * `points <= 0` ไม่ได้รางวัลไม่ว่า rank จะเท่าไหร่ — กัน mass-tie-at-zero (blank GW/สถิติขาด/ทีมไม่มีใครลงสนาม)
 * ขยาย payout ของ tier สูงสุดไม่จำกัด เพราะคนคะแนน 0 จำนวนมากจะเท่ากันที่ rank 1 พร้อมกันได้ง่ายเกินไป — ดูหัวข้อ
 * "Reward/tie policy" ด้านบน ties ที่คะแนนบวกเท่ากันจริงยังคงได้รางวัลร่วมกันตามปกติ (ตั้งใจ ไม่ใช่บั๊ก) */
export function rewardTierFor(
  rank: number,
  points: number,
  participantCount: number,
  periodType: "WEEKLY" | "MONTHLY",
): RewardSpec | null {
  if (periodType === "MONTHLY") throw new Error("MONTHLY reward table ยังไม่ implement ใน 7B (มาใน 7C)");
  if (points <= 0) return null;
  const rankLimit = participantRankLimit(participantCount);
  if (rank > rankLimit) return null;
  for (const row of WEEKLY_REWARDS) {
    if (rank <= row.maxRank) return row.reward;
  }
  return null;
}
