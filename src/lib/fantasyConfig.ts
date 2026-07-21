// src/lib/fantasyConfig.ts
// Catalog กลางของ Fantasy Premier XI — single source of truth เหมือน missionConfig.ts/achievementConfig.ts
// ดู docs/superpowers/specs/2026-07-20-fantasy-design.md

/** จำนวนผู้เล่นเป้าหมายต่อกลุ่มตำแหน่งใน Squad 15 คน — ใช้แสดงผลใน UI เท่านั้น
 * (ไม่บังคับครบ 15 — ขั้นต่ำจริงคือ 11 ตัวจริงครบ formation ดู validateLineup ใน fantasy.ts) */
export const SQUAD_QUOTA = {
  GK: 2,
  DEF: 5,
  MID: 5,
  ATT: 3,
} as const;

/** ตัวสำรองสูงสุดต่อทีม */
export const MAX_BENCH_SIZE = 4;

export const GAMEWEEK_STATUS = {
  UPCOMING: "UPCOMING",
  LOCKED: "LOCKED",
  SCORING: "SCORING",
  SCORED: "SCORED",
} as const;
export type GameweekStatus = (typeof GAMEWEEK_STATUS)[keyof typeof GAMEWEEK_STATUS];

export type PositionGroup = "GK" | "DEF" | "MID" | "ATT";

/** ตารางคะแนน Fantasy — single source of truth ห้าม hardcode เลขนี้ที่อื่น
 * ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 4 */
export const SCORING = {
  APPEARANCE_SHORT: 1, // ลงสนาม 1-59 นาที
  APPEARANCE_FULL: 2, // ลงสนาม >=60 นาที
  GOAL: { GK: 10, DEF: 6, MID: 5, ATT: 4 } as Record<PositionGroup, number>,
  ASSIST: 3,
  CLEAN_SHEET: { GK: 4, DEF: 4, MID: 1, ATT: 0 } as Record<PositionGroup, number>,
  GOALS_CONCEDED_PER_POINT: 2, // -1 ทุก 2 ลูกที่เสีย (เฉพาะ GK/DEF)
  YELLOW: -1,
  RED: -3,
  OWN_GOAL: -2,
  CAPTAIN_MULTIPLIER: 2,
} as const;

/** ขั้นต่ำต่อกลุ่มตำแหน่งของ final XI หลัง auto-sub (ใช้เช็ค validity ระหว่างแทนตัว)
 * ดูสเปคหัวข้อ 5 ข้อ 6 — GK ไม่ได้ระบุที่นี่เพราะจัดการแยกเป็น GK-only-replaces-GK ในขั้นตอนก่อนหน้า */
export const FORMATION_MIN = { DEF: 3, MID: 2, ATT: 1 } as const;

export type RewardSpec = { key: string; silver?: number; gold?: number; packId?: string };

/** จำนวนผู้เข้าแข่งขันจริง (submittedAt != null) → เปิด payout ถึงอันดับเท่าไหร่ — ดูสเปคหัวข้อ 12 */
export const PARTICIPANT_TIERS: { minParticipants: number; rankLimit: number }[] = [
  { minParticipants: 200, rankLimit: 1000 },
  { minParticipants: 20, rankLimit: 100 },
  { minParticipants: 5, rankLimit: 10 },
  { minParticipants: 1, rankLimit: 1 },
];

/** ตารางรางวัล Weekly — เรียงจาก maxRank น้อยไปมาก ต้องเรียงแบบนี้เสมอ (rewardTierFor ใน fantasyScoring.ts ไล่จากบนลงล่าง)
 * ดูสเปคหัวข้อ 11 */
export const WEEKLY_REWARDS: { maxRank: number; reward: RewardSpec }[] = [
  { maxRank: 1, reward: { key: "WEEKLY_TOP1", gold: 3, packId: "evolution" } },
  { maxRank: 10, reward: { key: "WEEKLY_TOP10", packId: "standard", silver: 300 } },
  { maxRank: 100, reward: { key: "WEEKLY_TOP100", silver: 300 } },
  { maxRank: 1000, reward: { key: "WEEKLY_TOP1000", silver: 100 } },
];
