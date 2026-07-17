// Catalog มิชชั่น Daily/Weekly — เก็บ target/reward/label ไว้ที่เดียว เป็น single source of truth
// (UI, bump, claim อ่านจากที่นี่ทั้งหมด กันบั๊คแบบ level-up logic เดิมที่เคย copy ซ้ำ 3 ที่)
// ดู docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md

export const MISSION_KEYS = {
  DAILY_LOGIN: "daily_login",
  DAILY_OPEN_PACK: "daily_open_pack",
  DAILY_ASSIGN_TEAM: "daily_assign_team",
  WEEKLY_LOGIN_5: "weekly_login5",
  WEEKLY_OPEN_PACK_10: "weekly_open_pack10",
} as const;

export type MissionKey = (typeof MISSION_KEYS)[keyof typeof MISSION_KEYS];

export type MissionConfig = {
  key: MissionKey;
  period: "daily" | "weekly";
  target: number;
  reward: { silver: number; exp: number; freePackId?: string };
  label: string;
};

export const MISSIONS: Record<MissionKey, MissionConfig> = {
  [MISSION_KEYS.DAILY_LOGIN]: {
    key: MISSION_KEYS.DAILY_LOGIN,
    period: "daily",
    target: 1,
    reward: { silver: 15, exp: 5 },
    label: "Login วันนี้",
  },
  [MISSION_KEYS.DAILY_OPEN_PACK]: {
    key: MISSION_KEYS.DAILY_OPEN_PACK,
    period: "daily",
    target: 1,
    reward: { silver: 40, exp: 10 },
    label: "เปิดซอง 1 ครั้ง",
  },
  [MISSION_KEYS.DAILY_ASSIGN_TEAM]: {
    key: MISSION_KEYS.DAILY_ASSIGN_TEAM,
    period: "daily",
    target: 1,
    reward: { silver: 25, exp: 5 },
    label: "วางการ์ดในช่องอย่างน้อย 1 ครั้ง",
  },
  [MISSION_KEYS.WEEKLY_LOGIN_5]: {
    key: MISSION_KEYS.WEEKLY_LOGIN_5,
    period: "weekly",
    target: 5,
    reward: { silver: 200, exp: 0, freePackId: "standard" },
    label: "Login สะสมครบ 5 วัน",
  },
  [MISSION_KEYS.WEEKLY_OPEN_PACK_10]: {
    key: MISSION_KEYS.WEEKLY_OPEN_PACK_10,
    period: "weekly",
    target: 10,
    reward: { silver: 300, exp: 30 },
    label: "เปิดซองสะสมครบ 10 ครั้ง",
  },
};
