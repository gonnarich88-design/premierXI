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
