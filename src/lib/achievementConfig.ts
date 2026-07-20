// Achievement + Collection Rewards catalog — รวม backend เดียว แยกด้วย category (activity/club/meta)
// ดู docs/superpowers/specs/2026-07-20-achievement-collection-design.md
//
// club entries (20 รายการ) มาจาก data/achievements/club-collection.json (frozen snapshot จาก
// prisma/generate-achievement-clubs.ts) — ห้ามคำนวณ target สดจาก COUNT(*) ของ Player (ดูสเปคหัวข้อ 3)
// ห้าม hardcode achievement key string ที่ไหนนอกไฟล์นี้ — อ้างอิงผ่าน ACHIEVEMENT_KEYS หรือ entry.key เท่านั้น

import clubCollectionData from "../../data/achievements/club-collection.json";

export type AchievementCategory = "activity" | "club" | "meta";

export type AchievementReward = {
  silver: number;
  gold: number;
  freePackId?: string;
};

export type ActivityAchievementConfig = {
  key: string;
  category: "activity";
  activityType: "packsOpened" | "pvpWins";
  target: number;
  reward: AchievementReward;
  label: string;
};

export type ClubAchievementConfig = {
  key: string;
  category: "club";
  clubName: string;
  playerIds: string[];
  target: number;
  reward: AchievementReward;
  label: string;
};

export type MetaAchievementConfig = {
  key: string;
  category: "meta";
  requiredClubKeys: string[];
  target: number;
  reward: AchievementReward;
  label: string;
};

export type AchievementConfig = ActivityAchievementConfig | ClubAchievementConfig | MetaAchievementConfig;

export const ACHIEVEMENT_KEYS = {
  PACK_5: "pack_5",
  PACK_20: "pack_20",
  PACK_50: "pack_50",
  PACK_150: "pack_150",
  PACK_300: "pack_300",
  PVP_5: "pvp_5",
  PVP_20: "pvp_20",
  PVP_50: "pvp_50",
  PVP_150: "pvp_150",
  PVP_300: "pvp_300",
  BIG6_COMPLETE: "big6_complete",
} as const;

const ACTIVITY_REWARD_BY_TARGET: Record<number, AchievementReward> = {
  5: { silver: 500, gold: 0 },
  20: { silver: 500, gold: 0, freePackId: "standard" },
  50: { silver: 0, gold: 5, freePackId: "evolution" },
  150: { silver: 0, gold: 10, freePackId: "royalprime" },
  300: { silver: 0, gold: 20, freePackId: "royalprime" },
};

const ACTIVITY_ACHIEVEMENTS: Record<string, ActivityAchievementConfig> = {
  [ACHIEVEMENT_KEYS.PACK_5]: {
    key: ACHIEVEMENT_KEYS.PACK_5,
    category: "activity",
    activityType: "packsOpened",
    target: 5,
    reward: ACTIVITY_REWARD_BY_TARGET[5],
    label: "เปิดซองสะสมครบ 5 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PACK_20]: {
    key: ACHIEVEMENT_KEYS.PACK_20,
    category: "activity",
    activityType: "packsOpened",
    target: 20,
    reward: ACTIVITY_REWARD_BY_TARGET[20],
    label: "เปิดซองสะสมครบ 20 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PACK_50]: {
    key: ACHIEVEMENT_KEYS.PACK_50,
    category: "activity",
    activityType: "packsOpened",
    target: 50,
    reward: ACTIVITY_REWARD_BY_TARGET[50],
    label: "เปิดซองสะสมครบ 50 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PACK_150]: {
    key: ACHIEVEMENT_KEYS.PACK_150,
    category: "activity",
    activityType: "packsOpened",
    target: 150,
    reward: ACTIVITY_REWARD_BY_TARGET[150],
    label: "เปิดซองสะสมครบ 150 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PACK_300]: {
    key: ACHIEVEMENT_KEYS.PACK_300,
    category: "activity",
    activityType: "packsOpened",
    target: 300,
    reward: ACTIVITY_REWARD_BY_TARGET[300],
    label: "เปิดซองสะสมครบ 300 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PVP_5]: {
    key: ACHIEVEMENT_KEYS.PVP_5,
    category: "activity",
    activityType: "pvpWins",
    target: 5,
    reward: ACTIVITY_REWARD_BY_TARGET[5],
    label: "ชนะ PvP สะสมครบ 5 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PVP_20]: {
    key: ACHIEVEMENT_KEYS.PVP_20,
    category: "activity",
    activityType: "pvpWins",
    target: 20,
    reward: ACTIVITY_REWARD_BY_TARGET[20],
    label: "ชนะ PvP สะสมครบ 20 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PVP_50]: {
    key: ACHIEVEMENT_KEYS.PVP_50,
    category: "activity",
    activityType: "pvpWins",
    target: 50,
    reward: ACTIVITY_REWARD_BY_TARGET[50],
    label: "ชนะ PvP สะสมครบ 50 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PVP_150]: {
    key: ACHIEVEMENT_KEYS.PVP_150,
    category: "activity",
    activityType: "pvpWins",
    target: 150,
    reward: ACTIVITY_REWARD_BY_TARGET[150],
    label: "ชนะ PvP สะสมครบ 150 ครั้ง",
  },
  [ACHIEVEMENT_KEYS.PVP_300]: {
    key: ACHIEVEMENT_KEYS.PVP_300,
    category: "activity",
    activityType: "pvpWins",
    target: 300,
    reward: ACTIVITY_REWARD_BY_TARGET[300],
    label: "ชนะ PvP สะสมครบ 300 ครั้ง",
  },
};

type ClubCollectionEntry = {
  key: string;
  clubName: string;
  playerIds: string[];
  size: number;
  tier: "small" | "large";
};
const clubCollectionEntries = (clubCollectionData as { clubs: ClubCollectionEntry[] }).clubs;

const CLUB_REWARD_BY_TIER: Record<"small" | "large", AchievementReward> = {
  small: { silver: 1000, gold: 0, freePackId: "standard" },
  large: { silver: 1500, gold: 5, freePackId: "evolution" },
};

const CLUB_ACHIEVEMENTS: Record<string, ClubAchievementConfig> = Object.fromEntries(
  clubCollectionEntries.map((entry) => [
    entry.key,
    {
      key: entry.key,
      category: "club",
      clubName: entry.clubName,
      playerIds: entry.playerIds,
      target: entry.size,
      reward: CLUB_REWARD_BY_TIER[entry.tier],
      label: `สะสมนักเตะครบทีม ${entry.clubName}`,
    } satisfies ClubAchievementConfig,
  ]),
);

const BIG6_CLUB_NAMES = [
  "Arsenal",
  "Chelsea",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Tottenham Hotspur",
] as const;

const big6ClubKeys = clubCollectionEntries
  .filter((entry) => (BIG6_CLUB_NAMES as readonly string[]).includes(entry.clubName))
  .map((entry) => entry.key);

if (big6ClubKeys.length !== 6) {
  throw new Error(
    `club-collection.json ผิดปกติ — คาดหวังสโมสร Big 6 ครบ 6 สโมสร เจอ ${big6ClubKeys.length} (ตรวจ data/achievements/club-collection.json)`,
  );
}

const META_ACHIEVEMENTS: Record<string, MetaAchievementConfig> = {
  [ACHIEVEMENT_KEYS.BIG6_COMPLETE]: {
    key: ACHIEVEMENT_KEYS.BIG6_COMPLETE,
    category: "meta",
    requiredClubKeys: big6ClubKeys,
    target: big6ClubKeys.length,
    reward: { silver: 2000, gold: 15, freePackId: "royalprime" },
    label:
      "สะสมนักเตะครบทั้ง 6 สโมสร Big 6 (Arsenal, Chelsea, Liverpool, Manchester City, Manchester United, Tottenham Hotspur)",
  },
};

/** Catalog รวมทั้งหมด 31 รายการ (10 activity + 20 club + 1 meta) — single source of truth เดียว
 * ที่ progress/claim/UI ทุกจุดต้องอ่านจากที่นี่เท่านั้น */
export const ACHIEVEMENTS: Record<string, AchievementConfig> = {
  ...ACTIVITY_ACHIEVEMENTS,
  ...CLUB_ACHIEVEMENTS,
  ...META_ACHIEVEMENTS,
};
