// PvP (Phase 3) — pattern เดียวกับ packs.ts/daily.ts: pure function ก่อน แยกจาก DB access
// เพื่อเทสได้โดยไม่พึ่ง Math.random()/new Date() จริงตอนรัน — ดู docs/superpowers/specs/2026-07-17-pvp-design.md

import { POSITION_GROUP, POSITIONS, type Position } from "@/lib/constants";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeChemistry } from "@/lib/chemistry";
import { FORMATIONS } from "@/lib/formations";
import { buildChemEntries, buildLineup, getOrCreateSquad } from "@/lib/squad";
import { dayIndex } from "@/lib/daily";
import { applyExp, levelReward, addCurrency, spendCurrency, InsufficientFundsError } from "@/lib/economy";
import { grantFreePack, type LevelUpReward, type OpenedCard } from "@/lib/packs";

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
  const scorer = pickWeighted(lineup, (e) => SHOOT_WEIGHT[POSITION_GROUP[e.slotPos as Position]] * e.ovr, rng);
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

export type Opponent = { rating: number; lineup: LineupEntry[]; isBot: boolean };

const POSITIONS_BY_GROUP: Record<"GK" | "DEF" | "MID" | "ATT", Position[]> = { GK: [], DEF: [], MID: [], ATT: [] };
for (const pos of POSITIONS) {
  POSITIONS_BY_GROUP[POSITION_GROUP[pos]].push(pos);
}

const BOT_OVR_RANGE_PCTS = [0.15, 0.3, 0.5];

function sampleWithReplacement<T extends { ovr: number; player: { name: string } }>(
  pool: T[],
  count: number,
): { name: string; ovr: number }[] {
  const picks: { name: string; ovr: number }[] = [];
  for (let i = 0; i < count; i++) {
    const card = pool[Math.floor(Math.random() * pool.length)];
    picks.push({ name: card.player.name, ovr: card.ovr });
  }
  return picks;
}

/** สุ่มการ์ด `count` ใบจากกลุ่มตำแหน่ง — ขยายช่วง OVR ทีละขั้น (±15% → ±30% → ±50% → ไม่จำกัด) จนกว่าจะเจอการ์ดอย่างน้อย 1 ใบ
 * การันตีไม่ error ตราบใดที่มีการ์ดกลุ่มตำแหน่งนี้อยู่ในระบบอย่างน้อย 1 ใบ (ดูสเปคหัวข้อ 2) */
async function pickCardsForGroup(
  tx: Prisma.TransactionClient,
  positions: Position[],
  targetOvr: number,
  count: number,
): Promise<{ name: string; ovr: number }[]> {
  for (const pct of BOT_OVR_RANGE_PCTS) {
    const pool = await tx.card.findMany({
      where: {
        position: { in: positions },
        ovr: { gte: Math.round(targetOvr * (1 - pct)), lte: Math.round(targetOvr * (1 + pct)) },
      },
      include: { player: true },
    });
    if (pool.length > 0) return sampleWithReplacement(pool, count);
  }

  // ไม่จำกัดช่วงเลย — เอาการ์ดที่ OVR ใกล้เคียงเป้าหมายที่สุดในกลุ่มตำแหน่งนี้ทั้งหมด
  const all = await tx.card.findMany({ where: { position: { in: positions } }, include: { player: true } });
  if (all.length === 0) throw new Error(`ไม่มีการ์ดกลุ่มตำแหน่งนี้เลยในระบบ: ${positions.join(",")}`);
  const sorted = [...all].sort((a, b) => Math.abs(a.ovr - targetOvr) - Math.abs(b.ovr - targetOvr));
  return sampleWithReplacement(sorted.slice(0, Math.max(count, 10)), count);
}

/** สุ่มทีมบอทเมื่อไม่มีคู่แข่งคนจริงในช่วง rating — formation คงที่ 4-3-3 เสมอสำหรับบอท, ไม่คำนวณ chemistry จริง
 * (rating บอทตรงๆ จาก OVR เฉลี่ยที่สุ่มได้ ให้ใกล้เคียง targetRating) */
export async function generateBotSquad(tx: Prisma.TransactionClient, targetRating: number): Promise<Opponent> {
  const layout = FORMATIONS["4-3-3"];
  const slotsByGroup = new Map<"GK" | "DEF" | "MID" | "ATT", string[]>();
  for (const slot of layout) {
    const group = POSITION_GROUP[slot.pos as Position];
    const arr = slotsByGroup.get(group) ?? [];
    arr.push(slot.pos);
    slotsByGroup.set(group, arr);
  }

  const lineup: LineupEntry[] = [];
  for (const [group, slotPositions] of slotsByGroup) {
    const picks = await pickCardsForGroup(tx, POSITIONS_BY_GROUP[group], targetRating, slotPositions.length);
    picks.forEach((p, i) => lineup.push({ name: p.name, ovr: p.ovr, slotPos: slotPositions[i] }));
  }

  const avgOvr = Math.round(lineup.reduce((sum, e) => sum + e.ovr, 0) / lineup.length);
  return { rating: avgOvr, lineup, isBot: true };
}

/** หาคู่แข่ง — คนจริงก่อน (squad ที่ cachedRating อยู่ในช่วง ±20% ใช้เป็นแค่ query filter, filled ครบ 11)
 * ไม่เจอ → fallback บอท ให้ rating ใกล้เคียง myRatingForQuery
 * สำคัญ: คำนวณ computeChemistry() สดจากข้อมูลจริงเสมอ ไม่ใช้ cachedRating ของคู่แข่งไปคำนวณแมตช์ตรงๆ (ดูสเปคหัวข้อ 3) */
export async function findOpponent(
  tx: Prisma.TransactionClient,
  myUserId: string,
  myRatingForQuery: number,
): Promise<Opponent> {
  const candidates = await tx.squad.findMany({
    where: {
      userId: { not: myUserId },
      cachedRating: {
        gte: Math.round(myRatingForQuery * 0.8),
        lte: Math.round(myRatingForQuery * 1.2),
      },
    },
    include: {
      slots: { orderBy: { index: "asc" }, include: { card: { include: { player: true } } } },
    },
  });

  const filled = candidates.filter((s) => s.slots.filter((slot) => slot.cardId !== null).length === 11);
  if (filled.length === 0) return generateBotSquad(tx, myRatingForQuery);

  const squad = filled[Math.floor(Math.random() * filled.length)];
  const layout = FORMATIONS[squad.formation] ?? FORMATIONS["4-3-3"];
  const chem = computeChemistry(buildChemEntries(squad.slots, layout));
  const lineup = buildLineup(squad.slots, layout);

  return { rating: chem.rating, lineup, isBot: false };
}

const FREE_MATCHES_PER_DAY = 5;
const TICKET_COST_GOLD = 3;

const SEASON_END_REWARD: Record<PvpTierKey, { silver: number; gold: number; freePackId?: string }> = {
  bronze: { silver: 200, gold: 0 },
  silver: { silver: 400, gold: 0, freePackId: "standard" },
  gold: { silver: 600, gold: 3, freePackId: "standard" },
  elite: { silver: 800, gold: 5, freePackId: "evolution" },
  champion: { silver: 1000, gold: 8, freePackId: "evolution" },
  legend: { silver: 1500, gold: 15, freePackId: "royalprime" },
};

export type SeasonEndReward = {
  tier: PvpTierKey;
  silver: number;
  gold: number;
  pack?: { packId: string; cards: OpenedCard[] };
};

export type PvpMatchResult =
  | {
      ok: true;
      myGoals: number;
      oppGoals: number;
      events: MatchGoalEvent[];
      outcome: "win" | "draw" | "lose";
      isTicketMatch: boolean;
      isBotOpponent: boolean;
      expGained: number;
      silverGained: number;
      rpDelta: number;
      rpBefore: number;
      rpAfter: number;
      tierBefore: PvpTierKey;
      tierAfter: PvpTierKey;
      promoted: boolean;
      demoted: boolean;
      leveledUp: boolean;
      level: number;
      levelRewards: LevelUpReward[];
      seasonEndReward?: SeasonEndReward;
    }
  | { ok: false; error: string };

/**
 * เล่นแมตช์ PvP 1 ครั้งแบบ atomic ทั้งหมด — season lazy reset, quota/ticket, matchmaking, simulate, apply reward
 * ไม่มีพารามิเตอร์ useTicket: isTicketMatch derive จาก pvpMatchesToday ฝั่ง server เสมอ (ดู Global Constraints ข้อ 2)
 */
export async function playPvpMatch(userId: string, now: Date = new Date()): Promise<PvpMatchResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        pvpRP: true,
        pvpSeasonKey: true,
        pvpWinStreak: true,
        pvpMatchesToday: true,
        pvpMatchesDate: true,
        level: true,
        exp: true,
      },
    });

    // 1. อ่าน Squad ตัวเอง validate ครบ 11 ตำแหน่งก่อนแตะโควตา/ticket/season reward
    // (กันเสียโควตาฟรีหรือ Gold ถ้าทีมยังไม่พร้อม — ดู Global Constraints ข้อ 1; และกัน season-end
    // reward commit เข้า DB ทั้งที่แมตช์ reject เพราะ transaction ปกติ return ก็ commit ไม่ rollback)
    const mySquad = await getOrCreateSquad(userId, tx);
    const myFilled = mySquad.slots.filter((s) => s.cardId !== null).length;
    if (myFilled !== 11) {
      return { ok: false, error: "จัดทีมให้ครบ 11 ตำแหน่งก่อน" };
    }

    // 2. Lazy season check — ก่อนอ่าน pvpRP ไปคำนวณอะไรต่อเสมอ (กันข้าม season boundary กลาง flow)
    const currentSeasonKey = seasonKey(now);
    let pvpRP = user.pvpRP;
    let seasonEndReward: SeasonEndReward | undefined;
    let currentLevel = user.level;
    let currentExp = user.exp;
    if (user.pvpSeasonKey !== currentSeasonKey) {
      if (user.pvpSeasonKey !== null) {
        const tier = tierForRP(pvpRP);
        const reward = SEASON_END_REWARD[tier.key];
        let pack: { packId: string; cards: OpenedCard[] } | undefined;
        if (reward.freePackId) {
          const bonus = await grantFreePack(tx, userId, reward.freePackId);
          pack = { packId: reward.freePackId, cards: bonus.cards };
          // grantFreePack (ผ่าน finalizeOpen) commit level/exp ใหม่ใน tx เดียวกันแล้ว — ต้อง refresh
          // local state ไม่งั้น step 7 จะคำนวณ applyExp จาก snapshot เก่า ทำ EXP หายและแจกรางวัล milestone ซ้ำ
          const refreshed = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { level: true, exp: true },
          });
          currentLevel = refreshed.level;
          currentExp = refreshed.exp;
        }
        if (reward.silver > 0) await addCurrency(userId, "silver", reward.silver, tx);
        if (reward.gold > 0) await addCurrency(userId, "gold", reward.gold, tx);
        seasonEndReward = { tier: tier.key, silver: reward.silver, gold: reward.gold, pack };
      }
      pvpRP = 0;
      await tx.user.update({ where: { id: userId }, data: { pvpRP: 0, pvpSeasonKey: currentSeasonKey } });
    }

    // 3. เช็ค+ตัดโควตาแบบ atomic compare-and-set (เหมือน claimMission() ใน missions.ts)
    const today = dayIndex(now);
    const storedDate = user.pvpMatchesDate ? dayIndex(user.pvpMatchesDate) : null;
    if (storedDate !== today) {
      // compare-and-set บน pvpMatchesDate ที่อ่านมาตอนต้น tx เท่านั้น — กัน race ตอนเที่ยงคืน UTC ที่
      // tx อื่นอาจ reset/increment ไปแล้วจาก snapshot คนละอัน (ถ้า where ไม่ match ก็ no-op เฉยๆ ถูกต้องแล้ว)
      await tx.user.updateMany({
        where: { id: userId, pvpMatchesDate: user.pvpMatchesDate },
        data: { pvpMatchesToday: 0, pvpMatchesDate: now },
      });
    }
    const freshQuota = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { pvpMatchesToday: true } });
    const matchesToday = freshQuota.pvpMatchesToday;

    let isTicketMatch: boolean;
    if (matchesToday < FREE_MATCHES_PER_DAY) {
      isTicketMatch = false;
      const claim = await tx.user.updateMany({
        where: { id: userId, pvpMatchesToday: { lt: FREE_MATCHES_PER_DAY } },
        data: { pvpMatchesToday: { increment: 1 } },
      });
      if (claim.count === 0) {
        return { ok: false, error: "โควตาแมตช์วันนี้เต็มแล้ว ลองใหม่พรุ่งนี้หรือใช้ Match Ticket" };
      }
    } else {
      isTicketMatch = true;
      try {
        await spendCurrency(userId, "gold", TICKET_COST_GOLD, tx);
      } catch (err) {
        if (err instanceof InsufficientFundsError) {
          return { ok: false, error: "Gold ไม่พอซื้อ Match Ticket" };
        }
        throw err;
      }
    }

    // 4. คำนวณ computeChemistry สดของตัวเอง (ไม่ใช้ cachedRating ตรงๆ — ดูสเปคหัวข้อ 3)
    const layout = FORMATIONS[mySquad.formation] ?? FORMATIONS["4-3-3"];
    const myRating = computeChemistry(buildChemEntries(mySquad.slots, layout)).rating;
    const myLineup = buildLineup(mySquad.slots, layout);

    // 5. หาคู่แข่ง + จำลองแมตช์
    const opponent = await findOpponent(tx, userId, myRating);
    const match = simulateMatch(myRating, opponent.rating, myLineup, opponent.lineup);
    const outcome: "win" | "draw" | "lose" =
      match.myGoals > match.oppGoals ? "win" : match.myGoals < match.oppGoals ? "lose" : "draw";

    // 6. คำนวณรางวัล EXP/Silver/RP + win-streak
    const mult = rpMultiplier(opponent.rating, myRating);
    let newWinStreak: number;
    let expGained: number;
    let silverGained: number;
    let pvpTotalWinsDelta: number;

    if (outcome === "win") {
      newWinStreak = user.pvpWinStreak + 1;
      expGained = Math.round(25 * mult) + winStreakBonus(newWinStreak);
      silverGained = Math.round(60 * mult);
      pvpTotalWinsDelta = 1;
    } else if (outcome === "draw") {
      newWinStreak = user.pvpWinStreak;
      expGained = 15;
      silverGained = 35;
      pvpTotalWinsDelta = 0;
    } else {
      newWinStreak = 0;
      expGained = isTicketMatch ? 0 : 8;
      silverGained = isTicketMatch ? 0 : 15;
      pvpTotalWinsDelta = 0;
    }
    const rpDelta = rpDeltaForOutcome(outcome, mult);

    const rpBefore = pvpRP;
    const rpAfter = Math.max(0, pvpRP + rpDelta);

    // 7. Apply EXP/level + silver + RP + win-streak
    const { level, exp, levelsGained } = applyExp(currentLevel, currentExp, expGained);
    const rewardsByLevel = levelsGained.map((lv) => ({ lv, reward: levelReward(lv) }));
    const levelSilverBonus = rewardsByLevel.reduce((sum, r) => sum + r.reward.silver, 0);
    const levelGoldBonus = rewardsByLevel.reduce((sum, r) => sum + r.reward.gold, 0);

    await tx.user.update({
      where: { id: userId },
      data: {
        silver: { increment: silverGained + levelSilverBonus },
        gold: { increment: levelGoldBonus },
        level,
        exp,
        pvpRP: rpAfter,
        pvpWinStreak: newWinStreak,
        pvpTotalWins: { increment: pvpTotalWinsDelta },
      },
    });

    const levelRewards: LevelUpReward[] = [];
    let finalLevel = level;
    for (const { lv, reward } of rewardsByLevel) {
      const entry: LevelUpReward = { level: lv, silver: reward.silver, gold: reward.gold };
      if (reward.freePackId) {
        const bonus = await grantFreePack(tx, userId, reward.freePackId);
        entry.pack = { packId: reward.freePackId, cards: bonus.cards };
        levelRewards.push(entry, ...bonus.levelRewards);
        finalLevel = bonus.level;
      } else {
        levelRewards.push(entry);
      }
    }

    const tierBefore = tierForRP(rpBefore).key;
    const tierAfter = tierForRP(rpAfter).key;
    const tierOrder = PVP_TIERS.map((t) => t.key);
    const promoted = tierOrder.indexOf(tierAfter) > tierOrder.indexOf(tierBefore);
    const demoted = tierOrder.indexOf(tierAfter) < tierOrder.indexOf(tierBefore);

    return {
      ok: true,
      myGoals: match.myGoals,
      oppGoals: match.oppGoals,
      events: match.events,
      outcome,
      isTicketMatch,
      isBotOpponent: opponent.isBot,
      expGained,
      silverGained,
      rpDelta: rpAfter - rpBefore,
      rpBefore,
      rpAfter,
      tierBefore,
      tierAfter,
      promoted,
      demoted,
      leveledUp: finalLevel > currentLevel,
      level: finalLevel,
      levelRewards,
      seasonEndReward,
    };
  });
}

export type PvpStatus = {
  rp: number;
  tier: PvpTierKey;
  tierLabel: string;
  currentTierMin: number;
  nextTierMin: number | null;
  matchesToday: number;
  matchesRemaining: number;
  gold: number;
  squadFilled: number;
};

/** สถานะหน้า /pvp — read-only เสมอ ไม่ trigger lazy season reset (มีแค่ playPvpMatch ตอนกด "แข่งเลย" เท่านั้นที่ reset จริง) */
export async function getPvpStatus(userId: string, now: Date): Promise<PvpStatus> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { pvpRP: true, pvpMatchesToday: true, pvpMatchesDate: true, gold: true },
  });

  const today = dayIndex(now);
  const storedDate = user.pvpMatchesDate ? dayIndex(user.pvpMatchesDate) : null;
  const matchesToday = storedDate === today ? user.pvpMatchesToday : 0;

  const tier = tierForRP(user.pvpRP);
  const tierIdx = PVP_TIERS.findIndex((t) => t.key === tier.key);
  const nextTier = PVP_TIERS[tierIdx + 1];

  const squad = await prisma.squad.findUnique({
    where: { userId },
    select: { slots: { select: { cardId: true } } },
  });
  const squadFilled = squad?.slots.filter((s) => s.cardId !== null).length ?? 0;

  return {
    rp: user.pvpRP,
    tier: tier.key,
    tierLabel: tier.label,
    currentTierMin: tier.min,
    nextTierMin: nextTier ? nextTier.min : null,
    matchesToday,
    matchesRemaining: Math.max(0, FREE_MATCHES_PER_DAY - matchesToday),
    gold: user.gold,
    squadFilled,
  };
}
