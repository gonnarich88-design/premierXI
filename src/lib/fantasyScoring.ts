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
