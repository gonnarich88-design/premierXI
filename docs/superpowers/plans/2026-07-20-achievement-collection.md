# Achievement + Collection Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `docs/TASKS.md` ขั้น 5's last two items — Achievement (open-pack / PvP-win milestones, full-club/Big6 collection) and Collection rewards (full-club/Big6) — as a single generic backend (`AchievementProgress`, `achievementConfig.ts`, `achievements.ts`) surfaced on a new `/achievements` page with two tabs.

**Architecture:** One `AchievementProgress` Prisma model (`claimed`/`claimedAt` only — never a `progress` column) paired with a code-defined catalog (`ACHIEVEMENTS` in `src/lib/achievementConfig.ts`) that merges 10 explicit activity entries, 20 club entries built from a frozen data snapshot (`data/achievements/club-collection.json`, generated once by `prisma/generate-achievement-clubs.ts`), and 1 meta (Big 6) entry. Progress is **never stored** — it's computed live every time from `User.totalPacksOpened`/`User.pvpTotalWins` (activity) or a live `UserCard`→`Card`→`Player` join (club/meta), exactly as decided in the design spec to avoid a second source of truth. `totalPacksOpened`/`pvpTotalWins` are bumped inside the *existing* transactions of `openPack()`/`openPackWithShards()` (`src/lib/packs.ts`) and `playPvpMatch()` (`src/lib/pvp.ts`). Claiming (`claimAchievement()`) is atomic: since an `AchievementProgress` row is only ever created at the moment of a successful claim (never pre-created like `MissionProgress`), a bare `create()` that relies on the `@@unique([userId, achievementKey])` constraint throwing `P2002` on a duplicate *is* the compare-and-set — no `updateMany` needed. Rewards are granted with the exact same primitives already used everywhere else (`addCurrency`, `grantFreePack`) — no new reward-granting logic.

**Tech Stack:** Next.js (App Router, TypeScript), Prisma 6 + SQLite, React 19, Tailwind CSS. No test framework installed — verification uses temporary `tsx`-run scripts at the repo root (this repo's established convention), deleted before each task's commit.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-20-achievement-collection-design.md` — implements it exactly (reviewed by Codex, approved by the user). Do not deviate without checking back.
- **Never hardcode an achievement-key string literal (e.g. `"pack_5"`, `"club_arsenal"`) anywhere outside `src/lib/achievementConfig.ts`.** UI/actions/other lib code must always reference `ACHIEVEMENT_KEYS.X` or an `entry.key`/`config.key` value read from the catalog.
- **Never run `npm run dev` or `npm start`** (the Preview system manages the server) — use `npm run build` and `npx tsc --noEmit` only for verification.
- No emojis anywhere in UI (project rule).
- Mobile-first: every new page/component must not visually break on small viewports — verify in Preview before considering a UI task done.
- Temporary verify scripts (`verify-*.ts` at repo root) are never committed — run once to confirm behavior, then `rm` before that task's commit.
- `User.totalPacksOpened` increments **only** inside `openPack()` and `openPackWithShards()` (`src/lib/packs.ts`) — **never** inside `finalizeOpen()` or `grantFreePack()` (prevents double-counting free packs granted from level-up/mission/login-milestone/achievement rewards — see spec Non-goals).
- `User.pvpTotalWins` increments **only** on an actual match win (`outcome === "win"`) inside `playPvpMatch()` (`src/lib/pvp.ts`) — wins via a Match Ticket still count; draws/losses never do.
- Club-collection target numbers are a **frozen static snapshot** (`data/achievements/club-collection.json`) — `achievementConfig.ts` must never compute a club's target via a live `COUNT(*)` on `Player`.
- Club/Big6 progress counts at the **`Player` level, not `Card`** — owning any one card version (normal/evolution/royalprime) of a player counts as "have this player."
- `AchievementProgress` stores **only** `claimed`/`claimedAt` — never a `progress` integer column. Progress is always computed live.
- Out of scope (see spec Non-goals): "ครบลีก" (single league value makes it meaningless), "ครบชาติ" (67 nations, deferred), backfilling historical pack-opens/PvP-wins for existing users (counters start at 0 from deploy), single-player clubs (West Ham United, Leicester City, Burnley — excluded from the 20-club MVP), and any pack opened via Starter Pack or `grantFreePack()`/`finalizeOpen()` counting toward `totalPacksOpened`.

---

### Task 1: Prisma schema — `AchievementProgress` model + `User.totalPacksOpened`/`pvpTotalWins`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `AchievementProgress` Prisma model with `@@unique([userId, achievementKey])` (default constraint name `userId_achievementKey`), available on the generated client as `prisma.achievementProgress`/`tx.achievementProgress`. `User.totalPacksOpened: number`, `User.pvpTotalWins: number`.
- Consumes: nothing new.

- [ ] **Step 1: Add `totalPacksOpened`/`pvpTotalWins` to `User` and the `achievementProgress` relation**

In `prisma/schema.prisma`, the `User` model currently has (lines 54-69):

```prisma
  // PvP (Phase 3) — tier derive จาก pvpRP ผ่าน tierForRP() ใน src/lib/pvp.ts เสมอ ไม่ store tier แยก
  pvpRP           Int       @default(0)
  pvpSeasonKey    String? // "YYYY-MM" แบบ UTC (ดู seasonKey() ใน pvp.ts) — null = ยังไม่เคยแข่งเลย
  pvpWinStreak    Int       @default(0)
  pvpMatchesToday Int       @default(0)
  pvpMatchesDate  DateTime? // เทียบ dayIndex() เหมือน daily.ts เพื่อรีเซ็ตโควตารายวัน

  createdAt   DateTime  @default(now())
  lastLoginAt DateTime?

  cards            UserCard[]
  squad            Squad?
  notifications    Notification[]
  announcements    Announcement[] @relation("AnnouncementAuthor")
  missionProgress  MissionProgress[]
}
```

Replace it with:

```prisma
  // PvP (Phase 3) — tier derive จาก pvpRP ผ่าน tierForRP() ใน src/lib/pvp.ts เสมอ ไม่ store tier แยก
  pvpRP           Int       @default(0)
  pvpSeasonKey    String? // "YYYY-MM" แบบ UTC (ดู seasonKey() ใน pvp.ts) — null = ยังไม่เคยแข่งเลย
  pvpWinStreak    Int       @default(0)
  pvpMatchesToday Int       @default(0)
  pvpMatchesDate  DateTime? // เทียบ dayIndex() เหมือน daily.ts เพื่อรีเซ็ตโควตารายวัน

  // Achievement (category "activity") — lifetime counter เริ่มนับ 0 ตั้งแต่ deploy ระบบนี้ ไม่ backfill ย้อนหลัง
  // ดู docs/superpowers/specs/2026-07-20-achievement-collection-design.md Non-goals
  totalPacksOpened Int @default(0) // นับเฉพาะ openPack()/openPackWithShards() ที่ user กดเอง — ห้ามนับ starter/free pack จาก milestone อื่น
  pvpTotalWins     Int @default(0) // นับชนะสะสมตลอดกาล (ต่างจาก pvpWinStreak ที่รีเซ็ตเมื่อแพ้)

  createdAt   DateTime  @default(now())
  lastLoginAt DateTime?

  cards               UserCard[]
  squad               Squad?
  notifications       Notification[]
  announcements       Announcement[] @relation("AnnouncementAuthor")
  missionProgress     MissionProgress[]
  achievementProgress AchievementProgress[]
}
```

- [ ] **Step 2: Add the `AchievementProgress` model**

Add at the end of `prisma/schema.prisma` (after the `MissionProgress` model):

```prisma

/// สถานะเคลม Achievement — ตัวเดียว generic ใช้ร่วมทุกหมวด (activity/club/meta)
/// progress ไม่เก็บในตารางนี้ — คำนวณสดเสมอจาก User counter (activity) หรือ UserCard join (club/meta)
/// achievementKey ต้องมาจาก ACHIEVEMENTS ใน src/lib/achievementConfig.ts เท่านั้น
/// row จะถูกสร้างก็ต่อเมื่อเคลมสำเร็จเท่านั้น (ไม่มี "progress row" สร้างล่วงหน้าเหมือน MissionProgress)
model AchievementProgress {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  achievementKey String

  claimed   Boolean   @default(false)
  claimedAt DateTime?

  @@unique([userId, achievementKey])
  @@index([userId])
}
```

- [ ] **Step 3: Run the migration**

Run: `npx prisma migrate dev --name add_achievement_progress`
Expected: `Your database is now in sync with your schema.` — creates a new folder under `prisma/migrations/` and regenerates the Prisma client.

- [ ] **Step 4: Verify the generated client has the new fields/delegate**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add AchievementProgress model and User activity counters"
```

---

### Task 2: Generate frozen club-collection snapshot

**Files:**
- Create: `prisma/generate-achievement-clubs.ts`
- Create (generated output, committed): `data/achievements/club-collection.json`
- Modify: `package.json` (add `db:generate-achievement-clubs` script)
- Test (temporary, not committed): `verify-club-collection.ts` (repo root)

**Interfaces:**
- Produces: `data/achievements/club-collection.json` with shape `{ clubs: { key: string; clubName: string; playerIds: string[]; size: number; tier: "small" | "large" }[] }` — consumed by Task 3.
- Consumes: nothing new (standalone script using `@prisma/client` directly, same pattern as `prisma/import-cards.ts`/`prisma/import-special-cards.ts`).

This script is kept in `prisma/` (not deleted as throwaway) and wired to an npm script, matching the existing precedent of `db:import`/`db:import-special` — so it can be re-run deliberately in the future if clubs/players are added (see spec §3: "ถ้ามีสโมสรใหม่/นักเตะเพิ่มในอนาคตและต้องการอัพเดต target ต้องรัน generate script ใหม่โดยตั้งใจ").

- [ ] **Step 1: Create `prisma/generate-achievement-clubs.ts`**

```ts
/**
 * Generate frozen club-collection snapshot สำหรับ Achievement ระบบ "สะสมครบทีม"
 *
 * Query Player group by club, ตัดสโมสรที่มีนักเตะคนเดียว (ข้อมูล seed ไม่ครบ — ดู Non-goals),
 * แบ่ง tier small (<=25 คน) / large (>25 คน) ตามสเปค, เขียนผลลัพธ์ไปที่
 * data/achievements/club-collection.json — ไฟล์นี้คือ single source of truth ของ target แต่ละสโมสร
 * (ห้าม achievementConfig.ts คำนวณ target สดจาก COUNT(*) ของ Player — ดู
 * docs/superpowers/specs/2026-07-20-achievement-collection-design.md หัวข้อ 3)
 *
 * รันครั้งแรกตอน implement ระบบนี้ (npm run db:generate-achievement-clubs) — รันซ้ำได้ในอนาคต
 * แบบตั้งใจถ้ามีสโมสร/นักเตะเพิ่ม (ไม่ใช่ auto-run ทุกครั้งที่ deploy)
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const OUTPUT_DIR = join(process.cwd(), "data", "achievements");
const OUTPUT_PATH = join(OUTPUT_DIR, "club-collection.json");
const MIN_CLUB_SIZE = 2; // ตัดสโมสรที่มีนักเตะคนเดียวออก (West Ham United/Leicester City/Burnley — ดู Non-goals)
const SMALL_TIER_MAX = 25; // small: <=25 คน, large: >25 คน (ดูสเปคหัวข้อ 3)

function slugifyClub(clubName: string): string {
  return (
    "club_" +
    clubName
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

async function main() {
  const players = await prisma.player.findMany({ select: { id: true, club: true } });

  const byClub = new Map<string, string[]>();
  for (const p of players) {
    const arr = byClub.get(p.club) ?? [];
    arr.push(p.id);
    byClub.set(p.club, arr);
  }

  const included = [...byClub.entries()].filter(([, playerIds]) => playerIds.length >= MIN_CLUB_SIZE);
  const excluded = [...byClub.entries()].filter(([, playerIds]) => playerIds.length < MIN_CLUB_SIZE);

  const clubs = included
    .map(([clubName, playerIds]) => ({
      key: slugifyClub(clubName),
      clubName,
      playerIds,
      size: playerIds.length,
      tier: playerIds.length <= SMALL_TIER_MAX ? ("small" as const) : ("large" as const),
    }))
    .sort((a, b) => a.size - b.size);

  console.log(`ตัดสโมสรที่มีนักเตะน้อยกว่า ${MIN_CLUB_SIZE} คนออก (${excluded.length} สโมสร):`);
  for (const [clubName, ids] of excluded) console.log(`  - ${clubName}: ${ids.length} คน`);

  console.log(`\nรวม ${clubs.length} สโมสรเข้า achievement catalog:`);
  for (const c of clubs) console.log(`  - ${c.key} (${c.clubName}): ${c.size} คน [${c.tier}]`);

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify({ clubs }, null, 2) + "\n", "utf-8");
  console.log(`\nเขียนไฟล์: ${OUTPUT_PATH}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, the `scripts` block currently is:

```json
  "scripts": {
    "dev": "next build && next start -H 0.0.0.0",
    "dev:hmr": "next dev -H 0.0.0.0",
    "build": "next build",
    "start": "next start -H 0.0.0.0",
    "lint": "eslint",
    "db:import": "tsx prisma/import-cards.ts",
    "db:import-special": "tsx prisma/import-special-cards.ts",
    "db:reset": "prisma migrate reset --force"
  },
```

Change to:

```json
  "scripts": {
    "dev": "next build && next start -H 0.0.0.0",
    "dev:hmr": "next dev -H 0.0.0.0",
    "build": "next build",
    "start": "next start -H 0.0.0.0",
    "lint": "eslint",
    "db:import": "tsx prisma/import-cards.ts",
    "db:import-special": "tsx prisma/import-special-cards.ts",
    "db:generate-achievement-clubs": "tsx prisma/generate-achievement-clubs.ts",
    "db:reset": "prisma migrate reset --force"
  },
```

- [ ] **Step 3: Run the generator**

Run: `npm run db:generate-achievement-clubs`
Expected: prints 3 excluded clubs (West Ham United, Leicester City, Burnley, each with 1 player), then 20 included clubs with their sizes/tiers, then `เขียนไฟล์: .../data/achievements/club-collection.json`. Confirmed against the current DB (verified during planning): sizes are Aston Villa 23, Fulham 23, Everton 24, Coventry City 25, Hull City 25, Newcastle United 25, Nottingham Forest 25 (all `small`); Ipswich Town 27, Leeds United 28, Sunderland 28, AFC Bournemouth 29, Brentford 29, Crystal Palace 30, Arsenal 31, Brighton & Hove Albion 34, Liverpool 37, Manchester City 39, Chelsea 42, Manchester United 43, Tottenham Hotspur 43 (all `large`).

- [ ] **Step 4: Write the verify script**

Create `verify-club-collection.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

type ClubEntry = { key: string; clubName: string; playerIds: string[]; size: number; tier: string };

const raw = readFileSync(join(process.cwd(), "data", "achievements", "club-collection.json"), "utf-8");
const data = JSON.parse(raw) as { clubs: ClubEntry[] };

assert.strictEqual(
  data.clubs.length,
  20,
  `คาดหวัง 20 สโมสร (ตัด West Ham/Leicester/Burnley ที่มี 1 คนออกแล้ว) เจอ ${data.clubs.length}`,
);
console.log("PASS: club-collection.json has exactly 20 clubs");

for (const c of data.clubs) {
  assert.strictEqual(c.playerIds.length, c.size, `${c.key}: size ต้องตรงกับ playerIds.length`);
  assert.ok(c.size > 1, `${c.key}: ต้องไม่มีสโมสรที่มีนักเตะคนเดียวหลุดเข้ามา`);
  assert.strictEqual(c.tier, c.size <= 25 ? "small" : "large", `${c.key}: tier ผิด (size=${c.size})`);
}
console.log("PASS: every club's playerIds length matches size, tier matches the <=25/>25 threshold");

const big6Names = ["Arsenal", "Chelsea", "Liverpool", "Manchester City", "Manchester United", "Tottenham Hotspur"];
for (const name of big6Names) {
  const found = data.clubs.find((c) => c.clubName === name);
  assert.ok(found, `ต้องเจอสโมสร Big6: ${name}`);
  assert.strictEqual(found!.tier, "large", `${name} ต้องอยู่ tier large`);
}
console.log("PASS: all 6 Big-6 clubs are present and in the large tier");

console.log("ALL PASS");
```

- [ ] **Step 5: Run the script**

Run: `npx tsx verify-club-collection.ts`
Expected:
```
PASS: club-collection.json has exactly 20 clubs
PASS: every club's playerIds length matches size, tier matches the <=25/>25 threshold
PASS: all 6 Big-6 clubs are present and in the large tier
ALL PASS
```

- [ ] **Step 6: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-club-collection.ts`

- [ ] **Step 7: Commit**

```bash
git add prisma/generate-achievement-clubs.ts data/achievements/club-collection.json package.json
git commit -m "feat(achievements): generate frozen club-collection snapshot"
```

---

### Task 3: `src/lib/achievementConfig.ts` — the 31-entry catalog

**Files:**
- Create: `src/lib/achievementConfig.ts`
- Test (temporary, not committed): `verify-achievement-config.ts` (repo root)

**Interfaces:**
- Consumes: `data/achievements/club-collection.json` (Task 2).
- Produces: `AchievementCategory`, `AchievementReward`, `ActivityAchievementConfig`, `ClubAchievementConfig`, `MetaAchievementConfig`, `AchievementConfig` types; `ACHIEVEMENT_KEYS` const; `ACHIEVEMENTS: Record<string, AchievementConfig>` — all consumed by Task 4 (`achievements.ts`) and Task 8 (UI, via `AchievementStatus`).

- [ ] **Step 1: Create `src/lib/achievementConfig.ts`**

```ts
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
```

- [ ] **Step 2: Write the verify script**

Create `verify-achievement-config.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { ACHIEVEMENTS, ACHIEVEMENT_KEYS } from "@/lib/achievementConfig";

// ต้องมีครบ 31 รายการเป๊ะ (10 activity + 20 club + 1 meta) ตามสเปคข้อ 4
const all = Object.values(ACHIEVEMENTS);
assert.strictEqual(all.length, 31, `คาดหวัง 31 achievement เจอ ${all.length}`);
console.log("PASS: ACHIEVEMENTS catalog has exactly 31 entries");

const activity = all.filter((a) => a.category === "activity");
const club = all.filter((a) => a.category === "club");
const meta = all.filter((a) => a.category === "meta");
assert.strictEqual(activity.length, 10);
assert.strictEqual(club.length, 20);
assert.strictEqual(meta.length, 1);
console.log("PASS: category split is 10 activity / 20 club / 1 meta");

// ทุก key ต้อง self-consistent (key ตรงกับ property ที่ใช้ index)
for (const [k, config] of Object.entries(ACHIEVEMENTS)) {
  assert.strictEqual(config.key, k, `mismatched key for ${k}`);
}
console.log("PASS: ACHIEVEMENTS catalog keys are self-consistent");

// รางวัล activity ตรงตามตารางในสเปคข้อ 4 เป๊ะทุก threshold
assert.deepStrictEqual(ACHIEVEMENTS[ACHIEVEMENT_KEYS.PACK_5].reward, { silver: 500, gold: 0 });
assert.deepStrictEqual(ACHIEVEMENTS[ACHIEVEMENT_KEYS.PACK_20].reward, {
  silver: 500,
  gold: 0,
  freePackId: "standard",
});
assert.deepStrictEqual(ACHIEVEMENTS[ACHIEVEMENT_KEYS.PACK_50].reward, {
  silver: 0,
  gold: 5,
  freePackId: "evolution",
});
assert.deepStrictEqual(ACHIEVEMENTS[ACHIEVEMENT_KEYS.PACK_150].reward, {
  silver: 0,
  gold: 10,
  freePackId: "royalprime",
});
assert.deepStrictEqual(ACHIEVEMENTS[ACHIEVEMENT_KEYS.PACK_300].reward, {
  silver: 0,
  gold: 20,
  freePackId: "royalprime",
});
assert.deepStrictEqual(ACHIEVEMENTS[ACHIEVEMENT_KEYS.PVP_5].reward, { silver: 500, gold: 0 });
assert.deepStrictEqual(ACHIEVEMENTS[ACHIEVEMENT_KEYS.PVP_300].reward, {
  silver: 0,
  gold: 20,
  freePackId: "royalprime",
});
console.log("PASS: activity reward table matches spec section 4 exactly");

// club: target ต้องเท่ากับ playerIds.length เป๊ะ (frozen snapshot ไม่ผิดเพี้ยน), reward ตาม tier ถูก tier
for (const c of club) {
  if (c.category !== "club") continue;
  assert.strictEqual(c.target, c.playerIds.length, `${c.key}: target ต้องเท่ากับจำนวน playerIds`);
  if (c.target <= 25) {
    assert.deepStrictEqual(
      c.reward,
      { silver: 1000, gold: 0, freePackId: "standard" },
      `${c.key}: small tier reward ผิด`,
    );
  } else {
    assert.deepStrictEqual(
      c.reward,
      { silver: 1500, gold: 5, freePackId: "evolution" },
      `${c.key}: large tier reward ผิด`,
    );
  }
}
console.log("PASS: every club achievement's target matches its frozen playerIds length, reward matches its tier");

// meta Big6 ต้องอ้างอิง club key ของ Big 6 ทั้ง 6 สโมสรเป๊ะ (Arsenal/Chelsea/Liverpool/Man City/Man Utd/Spurs)
const big6 = ACHIEVEMENTS[ACHIEVEMENT_KEYS.BIG6_COMPLETE];
assert.strictEqual(big6.category, "meta");
if (big6.category === "meta") {
  assert.strictEqual(big6.requiredClubKeys.length, 6);
  assert.strictEqual(big6.target, 6);
  const big6ClubNames = big6.requiredClubKeys.map((k) => {
    const c = ACHIEVEMENTS[k];
    assert.strictEqual(c.category, "club");
    return c.category === "club" ? c.clubName : "";
  });
  for (const name of ["Arsenal", "Chelsea", "Liverpool", "Manchester City", "Manchester United", "Tottenham Hotspur"]) {
    assert.ok(big6ClubNames.includes(name), `Big6 ต้องรวม ${name}`);
  }
  assert.deepStrictEqual(big6.reward, { silver: 2000, gold: 15, freePackId: "royalprime" });
}
console.log("PASS: Big6 meta achievement references exactly the 6 Big-6 club keys with the correct reward");

console.log("ALL PASS");
```

- [ ] **Step 3: Run the script**

Run: `npx tsx verify-achievement-config.ts`
Expected: all `PASS:` lines then `ALL PASS`.

- [ ] **Step 4: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-achievement-config.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/achievementConfig.ts
git commit -m "feat(achievements): add achievement catalog (10 activity + 20 club + 1 meta)"
```

---

### Task 4: `src/lib/achievements.ts` — live progress + atomic claim

**Files:**
- Create: `src/lib/achievements.ts`
- Test (temporary, not committed): `verify-achievements.ts` (repo root)

**Interfaces:**
- Consumes: `ACHIEVEMENTS`, `AchievementConfig`, `AchievementCategory`, `AchievementReward` (`@/lib/achievementConfig`); `addCurrency` (`@/lib/economy`); `grantFreePack`, `LevelUpReward`, `OpenedCard` (`@/lib/packs`); `prisma` (`@/lib/prisma`).
- Produces: `AchievementStatus` type, `getAchievementStatus(userId): Promise<AchievementStatus[]>`, `ClaimAchievementResult` type, `claimAchievement(userId, achievementKey): Promise<ClaimAchievementResult>` — consumed by Task 7 (server action) and Task 8 (UI).

- [ ] **Step 1: Create `src/lib/achievements.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addCurrency } from "@/lib/economy";
import { grantFreePack, type LevelUpReward, type OpenedCard } from "@/lib/packs";
import {
  ACHIEVEMENTS,
  type AchievementCategory,
  type AchievementConfig,
  type AchievementReward,
} from "@/lib/achievementConfig";

type Db = Prisma.TransactionClient | typeof prisma;

/** playerId ทั้งหมดที่ user มีการ์ดอย่างน้อย 1 เวอร์ชัน (นับที่ระดับ Player ไม่ใช่ Card — ดูสเปคหัวข้อ 3) */
async function getOwnedPlayerIds(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db.userCard.findMany({
    where: { userId },
    select: { card: { select: { playerId: true } } },
  });
  return new Set(rows.map((r) => r.card.playerId));
}

/**
 * progress สดของ achievement 1 ตัว — ไม่มีการเก็บ progress ในตาราง AchievementProgress เลย (ดูสเปคหัวข้อ 2)
 * cache ใช้ร่วมข้าม achievement หลายตัวในการเรียกครั้งเดียว (getAchievementStatus วน 31 ตัว แต่ query จริงแค่ 3 ครั้ง)
 */
async function computeProgress(
  db: Db,
  userId: string,
  config: AchievementConfig,
  cache: { ownedPlayerIds?: Set<string>; totalPacksOpened?: number; pvpTotalWins?: number } = {},
): Promise<number> {
  if (config.category === "activity") {
    let packs = cache.totalPacksOpened;
    let wins = cache.pvpTotalWins;
    if (packs === undefined || wins === undefined) {
      const user = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { totalPacksOpened: true, pvpTotalWins: true },
      });
      packs = user.totalPacksOpened;
      wins = user.pvpTotalWins;
      cache.totalPacksOpened = packs;
      cache.pvpTotalWins = wins;
    }
    return config.activityType === "packsOpened" ? packs : wins;
  }

  let owned = cache.ownedPlayerIds;
  if (!owned) {
    owned = await getOwnedPlayerIds(db, userId);
    cache.ownedPlayerIds = owned;
  }

  if (config.category === "club") {
    return config.playerIds.filter((id) => owned!.has(id)).length;
  }

  // meta (Big6) — ครบเมื่อ club achievement ที่กำหนดทั้งหมดถึง target ครบทุกตัว ไม่ผูกกับ claimed ของ club (ดูสเปคหัวข้อ 2)
  let completedClubs = 0;
  for (const clubKey of config.requiredClubKeys) {
    const clubConfig = ACHIEVEMENTS[clubKey];
    if (!clubConfig || clubConfig.category !== "club") continue;
    const clubProgress = clubConfig.playerIds.filter((id) => owned!.has(id)).length;
    if (clubProgress >= clubConfig.target) completedClubs++;
  }
  return completedClubs;
}

export type AchievementStatus = {
  key: string;
  category: AchievementCategory;
  label: string;
  progress: number;
  target: number;
  claimed: boolean;
  reward: AchievementReward;
};

/** สถานะ achievement ทั้ง 31 รายการของ user ตอนนี้ — progress คำนวณสดเสมอ (ไม่ได้อ่านจาก DB column ไหนตรงๆ) */
export async function getAchievementStatus(userId: string): Promise<AchievementStatus[]> {
  const [claims, user, ownedPlayerIds] = await Promise.all([
    prisma.achievementProgress.findMany({
      where: { userId },
      select: { achievementKey: true, claimed: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totalPacksOpened: true, pvpTotalWins: true },
    }),
    getOwnedPlayerIds(prisma, userId),
  ]);
  const claimedByKey = new Map(claims.map((c) => [c.achievementKey, c.claimed]));
  const cache = {
    ownedPlayerIds,
    totalPacksOpened: user.totalPacksOpened,
    pvpTotalWins: user.pvpTotalWins,
  };

  const results: AchievementStatus[] = [];
  for (const config of Object.values(ACHIEVEMENTS)) {
    const progress = await computeProgress(prisma, userId, config, cache);
    results.push({
      key: config.key,
      category: config.category,
      label: config.label,
      progress,
      target: config.target,
      claimed: claimedByKey.get(config.key) ?? false,
      reward: config.reward,
    });
  }
  return results;
}

export type ClaimAchievementResult =
  | {
      ok: true;
      reward: { silver: number; gold: number };
      pack?: { packId: string; cards: OpenedCard[] };
      leveledUp: boolean;
      level: number;
      levelRewards: LevelUpReward[];
      achievementLabel: string;
    }
  | { ok: false; error: string };

/**
 * เคลมรางวัล Achievement — atomic เหมือน claimMission() แต่ CAS ต่างกันเล็กน้อย: AchievementProgress
 * ไม่มี "progress row" ที่สร้างไว้ล่วงหน้า (ต่างจาก MissionProgress ที่ bumpMission สร้างตั้งแต่ progress=0)
 * ดังนั้นแค่ create() row (claimed=true ตั้งแต่สร้าง) แล้วปล่อยให้ @@unique([userId, achievementKey])
 * ชนกัน (P2002) เป็นตัวกันเคลมซ้ำแบบ atomic — เหมือน bumpLoginMissions() ตัดสิน "ครั้งแรกของวัน"
 */
export async function claimAchievement(userId: string, achievementKey: string): Promise<ClaimAchievementResult> {
  const config = ACHIEVEMENTS[achievementKey];
  if (!config) return { ok: false, error: "ไม่พบ Achievement นี้" };

  return prisma.$transaction(async (tx) => {
    const progress = await computeProgress(tx, userId, config);
    if (progress < config.target) {
      return { ok: false, error: "ยังทำไม่ครบเงื่อนไข" };
    }

    try {
      await tx.achievementProgress.create({
        data: { userId, achievementKey: config.key, claimed: true, claimedAt: new Date() },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: false, error: "เคลมไปแล้ว" };
      }
      throw err;
    }

    if (config.reward.silver > 0) await addCurrency(userId, "silver", config.reward.silver, tx);
    if (config.reward.gold > 0) await addCurrency(userId, "gold", config.reward.gold, tx);

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } });
    let finalLevel = user.level;
    const levelRewards: LevelUpReward[] = [];
    let pack: { packId: string; cards: OpenedCard[] } | undefined;
    if (config.reward.freePackId) {
      const bonus = await grantFreePack(tx, userId, config.reward.freePackId);
      pack = { packId: config.reward.freePackId, cards: bonus.cards };
      levelRewards.push(...bonus.levelRewards);
      finalLevel = bonus.level;
    }

    return {
      ok: true,
      reward: { silver: config.reward.silver, gold: config.reward.gold },
      pack,
      leveledUp: finalLevel > user.level,
      level: finalLevel,
      levelRewards,
      achievementLabel: config.label,
    };
  });
}
```

- [ ] **Step 2: Write the verify script**

Create `verify-achievements.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getAchievementStatus, claimAchievement } from "@/lib/achievements";
import { ACHIEVEMENT_KEYS, ACHIEVEMENTS } from "@/lib/achievementConfig";

async function main() {
  const user = await prisma.user.create({
    data: {
      username: `verify_achievements_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
    },
    select: { id: true },
  });

  try {
    // 1) activity progress อ่านสดจาก totalPacksOpened — ยังไม่ได้เพิ่มเลย ต้องเป็น 0
    let status = await getAchievementStatus(user.id);
    let pack5 = status.find((a) => a.key === ACHIEVEMENT_KEYS.PACK_5)!;
    assert.strictEqual(pack5.progress, 0);
    assert.strictEqual(status.length, 31, "ต้องมี achievement ครบ 31 รายการเสมอ (10 activity + 20 club + 1 meta)");
    console.log("PASS: getAchievementStatus returns all 31 achievements with progress computed live from totalPacksOpened=0");

    // 2) ยังไม่ครบ target → claim ต้อง fail
    const tooEarly = await claimAchievement(user.id, ACHIEVEMENT_KEYS.PACK_5);
    assert.strictEqual(tooEarly.ok, false);
    console.log("PASS: claimAchievement fails when progress < target");

    // 3) key ไม่มีจริง → error
    const invalid = await claimAchievement(user.id, "not_a_real_achievement");
    assert.strictEqual(invalid.ok, false);
    console.log("PASS: invalid achievementKey rejected");

    // 4) ตั้ง totalPacksOpened ให้ครบ 5 ตรงๆ (ไม่ผ่าน openPack เพราะเทสนี้เทสแค่ claim flow) → claim สำเร็จ ได้รางวัลตาม config
    await prisma.user.update({ where: { id: user.id }, data: { totalPacksOpened: 5 } });
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { silver: true, gold: true },
    });
    const claimed = await claimAchievement(user.id, ACHIEVEMENT_KEYS.PACK_5);
    assert.strictEqual(claimed.ok, true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { silver: true, gold: true } });
    const pack5Config = ACHIEVEMENTS[ACHIEVEMENT_KEYS.PACK_5];
    assert.strictEqual(after.silver, before.silver + pack5Config.reward.silver);
    assert.strictEqual(after.gold, before.gold + pack5Config.reward.gold);
    console.log("PASS: claiming PACK_5 grants exactly the configured silver/gold");

    // 5) เคลมซ้ำ → error
    const again = await claimAchievement(user.id, ACHIEVEMENT_KEYS.PACK_5);
    assert.strictEqual(again.ok, false);
    console.log("PASS: double-claim rejected");

    // 6) club achievement — ให้การ์ดครบทุกนักเตะของสโมสรที่เล็กที่สุด แล้วเช็ค progress/claim
    const smallestClub = Object.values(ACHIEVEMENTS)
      .filter((a) => a.category === "club")
      .sort((a, b) => a.target - b.target)[0];
    assert.ok(smallestClub && smallestClub.category === "club");
    if (smallestClub.category === "club") {
      for (const playerId of smallestClub.playerIds) {
        const card = await prisma.card.findFirstOrThrow({ where: { playerId }, select: { id: true } });
        await prisma.userCard.create({ data: { userId: user.id, cardId: card.id } });
      }
    }
    status = await getAchievementStatus(user.id);
    const clubStatus = status.find((a) => a.key === smallestClub.key)!;
    assert.strictEqual(clubStatus.progress, smallestClub.target, "progress ต้องครบ target หลังมีการ์ดครบทุกนักเตะของสโมสร");
    const clubClaim = await claimAchievement(user.id, smallestClub.key);
    assert.strictEqual(clubClaim.ok, true);
    console.log(`PASS: club achievement (${smallestClub.key}) progress/claim work from live UserCard join`);

    // 7) meta (Big6) — progress = จำนวนสโมสร Big6 ที่ครบแล้ว, ไม่ผูกกับ claimed ของ club
    const big6 = ACHIEVEMENTS[ACHIEVEMENT_KEYS.BIG6_COMPLETE];
    assert.ok(big6.category === "meta");
    if (big6.category === "meta") {
      const smallestBig6ClubKey = [...big6.requiredClubKeys].sort(
        (a, b) => ACHIEVEMENTS[a].target - ACHIEVEMENTS[b].target,
      )[0];
      const smallestBig6Club = ACHIEVEMENTS[smallestBig6ClubKey];
      assert.ok(smallestBig6Club.category === "club");
      const before6 = (await getAchievementStatus(user.id)).find((a) => a.key === ACHIEVEMENT_KEYS.BIG6_COMPLETE)!;

      if (smallestBig6Club.category === "club") {
        for (const playerId of smallestBig6Club.playerIds) {
          const card = await prisma.card.findFirstOrThrow({ where: { playerId }, select: { id: true } });
          const owned = await prisma.userCard.findUnique({
            where: { userId_cardId: { userId: user.id, cardId: card.id } },
          });
          if (!owned) await prisma.userCard.create({ data: { userId: user.id, cardId: card.id } });
        }
      }

      const after6 = (await getAchievementStatus(user.id)).find((a) => a.key === ACHIEVEMENT_KEYS.BIG6_COMPLETE)!;
      assert.strictEqual(after6.progress, before6.progress + 1, "Big6 progress ต้องขยับ +1 หลังสะสมครบอีก 1 สโมสรใน Big6");
      assert.ok(after6.progress < after6.target, "ยังไม่ครบทั้ง 6 สโมสร — claim ต้องยัง fail");
      const big6ClaimTooEarly = await claimAchievement(user.id, ACHIEVEMENT_KEYS.BIG6_COMPLETE);
      assert.strictEqual(big6ClaimTooEarly.ok, false);
      console.log("PASS: Big6 meta progress derives correctly from per-club completion (partial progress, claim still blocked)");
    }
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Run the script**

Run: `npx tsx verify-achievements.ts`
Expected: all `PASS:` lines then `ALL PASS`.

- [ ] **Step 4: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-achievements.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/achievements.ts
git commit -m "feat(achievements): add live progress computation and atomic claimAchievement"
```

---

### Task 5: Increment `totalPacksOpened`/`pvpTotalWins` at the correct call sites

**Files:**
- Modify: `src/lib/packs.ts` (`openPack()`, `openPackWithShards()`)
- Modify: `src/lib/pvp.ts` (`playPvpMatch()`)
- Test (temporary, not committed): `verify-achievement-pack-counter.ts`, `verify-achievement-pvp-counter.ts` (repo root)

**Interfaces:**
- Consumes: nothing new — uses the `User.totalPacksOpened`/`pvpTotalWins` fields added in Task 1.
- Produces: nothing new — `openPack()`/`openPackWithShards()`/`playPvpMatch()` signatures and return types are unchanged.

- [ ] **Step 1: Increment `totalPacksOpened` in `openPack()`**

In `src/lib/packs.ts`, `openPack()`'s transaction body currently ends (lines 268-273):

```ts
    const picks = await resolvePackCards(tx, config);
    const result = await finalizeOpen(tx, userId, picks);
    await bumpMission(tx, userId, MISSION_KEYS.DAILY_OPEN_PACK, now);
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_OPEN_PACK_10, now);
    return result;
  });
}
```

Change to:

```ts
    const picks = await resolvePackCards(tx, config);
    const result = await finalizeOpen(tx, userId, picks);
    await bumpMission(tx, userId, MISSION_KEYS.DAILY_OPEN_PACK, now);
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_OPEN_PACK_10, now);
    await tx.user.update({ where: { id: userId }, data: { totalPacksOpened: { increment: 1 } } });
    return result;
  });
}
```

- [ ] **Step 2: Increment `totalPacksOpened` in `openPackWithShards()`**

In `src/lib/packs.ts`, `openPackWithShards()`'s transaction body currently ends (lines 315-320):

```ts
    const picks = await resolvePackCards(tx, config);
    const result = await finalizeOpen(tx, userId, picks);
    await bumpMission(tx, userId, MISSION_KEYS.DAILY_OPEN_PACK, now);
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_OPEN_PACK_10, now);
    return result;
  });
}
```

Change to:

```ts
    const picks = await resolvePackCards(tx, config);
    const result = await finalizeOpen(tx, userId, picks);
    await bumpMission(tx, userId, MISSION_KEYS.DAILY_OPEN_PACK, now);
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_OPEN_PACK_10, now);
    await tx.user.update({ where: { id: userId }, data: { totalPacksOpened: { increment: 1 } } });
    return result;
  });
}
```

**Note:** `finalizeOpen()` and `grantFreePack()` are deliberately left untouched — they must never bump `totalPacksOpened` (see Global Constraints; prevents double-counting free packs nested from level-up/mission/login-milestone/achievement rewards).

- [ ] **Step 3: Write the pack-counter verify script**

Create `verify-achievement-pack-counter.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { openPack, openPackWithShards, grantFreePack } from "@/lib/packs";

async function main() {
  const user = await prisma.user.create({
    data: {
      username: `verify_pack_counter_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
      silver: 10_000,
      shards: 10_000,
    },
    select: { id: true },
  });

  try {
    await openPack(user.id, "standard");
    let u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { totalPacksOpened: true } });
    assert.strictEqual(u.totalPacksOpened, 1);
    console.log("PASS: openPack increments totalPacksOpened");

    await openPackWithShards(user.id, "standard");
    u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { totalPacksOpened: true } });
    assert.strictEqual(u.totalPacksOpened, 2);
    console.log("PASS: openPackWithShards also increments totalPacksOpened");

    await prisma.$transaction((tx) => grantFreePack(tx, user.id, "standard"));
    u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { totalPacksOpened: true } });
    assert.strictEqual(
      u.totalPacksOpened,
      2,
      "grantFreePack (ซองฟรีจาก milestone) ต้องไม่ทำให้ totalPacksOpened ขยับ (ดู Non-goals)",
    );
    console.log("PASS: grantFreePack does not bump totalPacksOpened (no double-count from nested free packs)");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run the pack-counter script**

Run: `npx tsx verify-achievement-pack-counter.ts`
Expected:
```
PASS: openPack increments totalPacksOpened
PASS: openPackWithShards also increments totalPacksOpened
PASS: grantFreePack does not bump totalPacksOpened (no double-count from nested free packs)
ALL PASS
```

- [ ] **Step 5: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-achievement-pack-counter.ts`

- [ ] **Step 6: Commit the pack-counter change**

```bash
git add src/lib/packs.ts
git commit -m "feat(achievements): increment totalPacksOpened in openPack/openPackWithShards"
```

- [ ] **Step 7: Increment `pvpTotalWins` in `playPvpMatch()`**

In `src/lib/pvp.ts`, the outcome branch currently is (lines 383-399):

```ts
    let newWinStreak: number;
    let expGained: number;
    let silverGained: number;

    if (outcome === "win") {
      newWinStreak = user.pvpWinStreak + 1;
      expGained = Math.round(25 * mult) + winStreakBonus(newWinStreak);
      silverGained = Math.round(60 * mult);
    } else if (outcome === "draw") {
      newWinStreak = user.pvpWinStreak;
      expGained = 15;
      silverGained = 35;
    } else {
      newWinStreak = 0;
      expGained = isTicketMatch ? 0 : 8;
      silverGained = isTicketMatch ? 0 : 15;
    }
    const rpDelta = rpDeltaForOutcome(outcome, mult);
```

Change to:

```ts
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
```

(`pvpTotalWinsDelta` is `1` for both a free-quota win and a Match-Ticket win — see Global Constraints; a ticket-match *loss* already grants 0 EXP/Silver via the existing `isTicketMatch` branch above, unrelated to this counter.)

- [ ] **Step 8: Include the increment in the `tx.user.update` call**

In `src/lib/pvp.ts`, the update call currently is (lines 411-421):

```ts
    await tx.user.update({
      where: { id: userId },
      data: {
        silver: { increment: silverGained + levelSilverBonus },
        gold: { increment: levelGoldBonus },
        level,
        exp,
        pvpRP: rpAfter,
        pvpWinStreak: newWinStreak,
      },
    });
```

Change to:

```ts
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
```

- [ ] **Step 9: Write the pvp-counter verify script**

Create `verify-achievement-pvp-counter.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { assignSlot } from "@/lib/squad";
import { playPvpMatch } from "@/lib/pvp";

async function createUserWithFullSquad(tag: string) {
  const user = await prisma.user.create({
    data: {
      username: `verify_pvp_counter_${tag}_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
      gold: 10_000,
    },
    select: { id: true },
  });

  const cards = [
    ...(await prisma.card.findMany({ where: { position: "GK" }, take: 1 })),
    ...(await prisma.card.findMany({ where: { position: { in: ["CB", "LB", "RB"] } }, take: 4 })),
    ...(await prisma.card.findMany({ where: { position: "CM" }, take: 3 })),
    ...(await prisma.card.findMany({ where: { position: { in: ["ST", "LW", "RW"] } }, take: 3 })),
  ];
  assert.strictEqual(cards.length, 11, "ต้องหาการ์ดครบ 11 ใบจากพูลที่ seed ไว้ได้");

  for (const card of cards) {
    await prisma.userCard.create({ data: { userId: user.id, cardId: card.id } });
  }
  for (let i = 0; i < 11; i++) {
    await assignSlot(user.id, i, cards[i].id);
  }
  return user.id;
}

async function main() {
  const userId = await createUserWithFullSquad("me");

  try {
    let expectedWins = 0;
    const N = 15; // เกินโควตาฟรี 5 ครั้ง/วัน — ที่เหลือใช้ Match Ticket (gold พอ) เพื่อกวาดผลทั้ง win/draw/lose
    for (let i = 0; i < N; i++) {
      const result = await playPvpMatch(userId);
      assert.strictEqual(result.ok, true, "แมตช์ต้องเล่นสำเร็จเสมอ (squad ครบ 11 + gold พอสำหรับ ticket)");
      if (result.ok && result.outcome === "win") expectedWins++;
    }
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { pvpTotalWins: true } });
    assert.strictEqual(
      u.pvpTotalWins,
      expectedWins,
      "pvpTotalWins ต้องตรงกับจำนวนแมตช์ที่ outcome เป็น win เป๊ะ (ไม่นับ draw/lose)",
    );
    console.log(`PASS: pvpTotalWins tracks wins only across ${N} matches (wins=${expectedWins})`);
  } finally {
    await prisma.user.delete({ where: { id: userId } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 10: Run the pvp-counter script**

Run: `npx tsx verify-achievement-pvp-counter.ts`
Expected: `PASS: pvpTotalWins tracks wins only across 15 matches (wins=N)` (N varies by RNG) then `ALL PASS`.

- [ ] **Step 11: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-achievement-pvp-counter.ts`

- [ ] **Step 12: Commit the pvp-counter change**

```bash
git add src/lib/pvp.ts
git commit -m "feat(achievements): increment pvpTotalWins on match win in playPvpMatch"
```

---

### Task 6: `ACHIEVEMENT_UNLOCKED` notification type + `notifyAchievementUnlocked()`

**Files:**
- Modify: `src/lib/constants.ts` (add `"ACHIEVEMENT_UNLOCKED"` to `NOTIFICATION_TYPES`)
- Modify: `src/lib/notifications.ts` (add `notifyAchievementUnlocked`)
- Test (temporary, not committed): `verify-achievement-notification.ts` (repo root)

**Interfaces:**
- Consumes: `createNotification` (`@/lib/notifications`, existing), `OpenedCard` (`@/lib/packs`, existing import in this file).
- Produces: `notifyAchievementUnlocked(userId, achievementLabel, reward, pack?): Promise<void>` — consumed by Task 7.

- [ ] **Step 1: Add `"ACHIEVEMENT_UNLOCKED"` to `NOTIFICATION_TYPES`**

In `src/lib/constants.ts`, current (lines 86-93):

```ts
export const NOTIFICATION_TYPES = [
  "DAILY_REWARD",
  "PACK_OPENED",
  "LEVEL_UP",
  "MISSION_CLAIMED",
  "PVP_MATCH",
  "SYSTEM",
] as const;
```

Change to:

```ts
export const NOTIFICATION_TYPES = [
  "DAILY_REWARD",
  "PACK_OPENED",
  "LEVEL_UP",
  "MISSION_CLAIMED",
  "PVP_MATCH",
  "ACHIEVEMENT_UNLOCKED",
  "SYSTEM",
] as const;
```

- [ ] **Step 2: Add `notifyAchievementUnlocked` to `src/lib/notifications.ts`**

Append this function after `notifyPvpSeasonEnd` (before `createNotification`, around line 103):

```ts
/** แจ้งเตือนปลดล็อก Achievement — silver/gold ถ้ามี + ซองฟรีถ้ามี (เช่น ครบทีม/Big6) */
export async function notifyAchievementUnlocked(
  userId: string,
  achievementLabel: string,
  reward: { silver: number; gold: number },
  pack?: { packId: string; cards: OpenedCard[] },
): Promise<void> {
  const parts: string[] = [];
  if (reward.silver) parts.push(`+${reward.silver} Silver`);
  if (reward.gold) parts.push(`+${reward.gold} Gold`);
  if (pack) parts.push(`ได้ ${PACK_NAMES[pack.packId] ?? pack.packId} ฟรี`);

  await createNotification({
    userId,
    type: "ACHIEVEMENT_UNLOCKED",
    title: `ปลดล็อก Achievement: ${achievementLabel}`,
    body: parts.join(" · "),
    href: "/achievements",
  });
}
```

- [ ] **Step 3: Write the verify script**

Create `verify-achievement-notification.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { notifyAchievementUnlocked } from "@/lib/notifications";

async function main() {
  const user = await prisma.user.create({
    data: {
      username: `verify_achievement_noti_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
    },
    select: { id: true },
  });

  try {
    await notifyAchievementUnlocked(user.id, "เปิดซองสะสมครบ 5 ครั้ง", { silver: 500, gold: 0 });
    const notis = await prisma.notification.findMany({ where: { userId: user.id } });
    assert.strictEqual(notis.length, 1);
    assert.strictEqual(notis[0].type, "ACHIEVEMENT_UNLOCKED");
    assert.strictEqual(notis[0].href, "/achievements");
    assert.ok(notis[0].body?.includes("+500 Silver"));
    console.log("PASS: notifyAchievementUnlocked creates a notification with correct type/href/body");

    await notifyAchievementUnlocked(
      user.id,
      "สะสมนักเตะครบทีม Arsenal",
      { silver: 1500, gold: 5 },
      { packId: "evolution", cards: [] },
    );
    const notis2 = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(notis2[0].body?.includes("Evolution Pack"));
    assert.ok(notis2[0].body?.includes("+5 Gold"));
    console.log("PASS: notifyAchievementUnlocked includes gold and free-pack name in the body when present");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run the script**

Run: `npx tsx verify-achievement-notification.ts`
Expected:
```
PASS: notifyAchievementUnlocked creates a notification with correct type/href/body
PASS: notifyAchievementUnlocked includes gold and free-pack name in the body when present
ALL PASS
```

- [ ] **Step 5: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-achievement-notification.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants.ts src/lib/notifications.ts
git commit -m "feat(achievements): add ACHIEVEMENT_UNLOCKED notification type"
```

---

### Task 7: Server action — `src/app/actions/achievements.ts`

**Files:**
- Create: `src/app/actions/achievements.ts`

**Interfaces:**
- Consumes: `getSessionUserId` (`@/lib/auth`); `claimAchievement`, `ClaimAchievementResult` (`@/lib/achievements`); `notifyLevelRewards`, `notifyAchievementUnlocked` (`@/lib/notifications`).
- Produces: `claimAchievementAction(achievementKey: string): Promise<ClaimAchievementResult>` — consumed by Task 8 (`AchievementList.tsx`).

**Why no verify script:** this mirrors `claimMissionAction`/`playPvpMatchAction` exactly — it's a thin `"use server"` wrapper whose only extra behavior beyond `claimAchievement()` (already tested in Task 4) is calling `getSessionUserId()`, which reads cookies via `next/headers` and only works inside a real Next.js request, not a plain `tsx` script. Verified manually in Preview as part of Task 8.

- [ ] **Step 1: Create `src/app/actions/achievements.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { claimAchievement, type ClaimAchievementResult } from "@/lib/achievements";
import { notifyLevelRewards, notifyAchievementUnlocked } from "@/lib/notifications";

export async function claimAchievementAction(achievementKey: string): Promise<ClaimAchievementResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const result = await claimAchievement(userId, achievementKey);
  if (result.ok) {
    revalidatePath("/achievements");
    revalidatePath("/profile");
    await notifyAchievementUnlocked(userId, result.achievementLabel, result.reward, result.pack);
    if (result.leveledUp) {
      await notifyLevelRewards(userId, result.level, result.levelRewards);
    }
  }
  return result;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/achievements.ts
git commit -m "feat(achievements): add claimAchievementAction server action"
```

---

### Task 8: UI — `/achievements` page + `AchievementList.tsx` + profile link

**Files:**
- Create: `src/app/achievements/page.tsx`
- Create: `src/components/AchievementList.tsx`
- Modify: `src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (`@/lib/auth`); `getAchievementStatus`, `AchievementStatus` (`@/lib/achievements`); `claimAchievementAction` (`@/app/actions/achievements`); `Reward` component (`@/components/DailyClaim`, existing export).
- Produces: `/achievements` route; `AchievementList` component (default export, props `{ achievements: AchievementStatus[] }`) — no further consumers.

- [ ] **Step 1: Create `src/app/achievements/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAchievementStatus } from "@/lib/achievements";
import AchievementList from "@/components/AchievementList";

export default async function AchievementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const achievements = await getAchievementStatus(user.id);

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Achievement</h1>
        <p className="mt-0.5 text-sm text-muted">สะสมความสำเร็จ รับรางวัล Silver / Gold / ซองฟรี</p>
      </header>
      <AchievementList achievements={achievements} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/AchievementList.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimAchievementAction } from "@/app/actions/achievements";
import { Reward } from "@/components/DailyClaim";
import type { AchievementStatus } from "@/lib/achievements";

type Tab = "activity" | "collection";

export default function AchievementList({ achievements }: { achievements: AchievementStatus[] }) {
  const [tab, setTab] = useState<Tab>("activity");

  const activity = achievements.filter((a) => a.category === "activity");
  const collection = achievements
    .filter((a) => a.category === "club" || a.category === "meta")
    .sort((a, b) => {
      if (a.category === b.category) return a.label.localeCompare(b.label);
      return a.category === "meta" ? -1 : 1; // Big6 (meta) แสดงเด่นก่อน ตามด้วยสโมสรเรียงชื่อ
    });

  const shown = tab === "activity" ? activity : collection;

  return (
    <div>
      <div className="mb-3 flex gap-2 rounded-xl bg-surface-2 p-1">
        <TabButton label="กิจกรรม" active={tab === "activity"} onClick={() => setTab("activity")} />
        <TabButton label="สะสม" active={tab === "collection"} onClick={() => setTab("collection")} />
      </div>
      <div className="space-y-2">
        {shown.map((a) => (
          <AchievementRow key={a.key} achievement={a} />
        ))}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function AchievementRow({ achievement }: { achievement: AchievementStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState(achievement.claimed);
  const [prevPropClaimed, setPrevPropClaimed] = useState(achievement.claimed);
  const [error, setError] = useState<string | null>(null);

  // sync กับ prop เสมอ (เหมือน MissionList) กัน state ค้างหลัง router.refresh()
  if (achievement.claimed !== prevPropClaimed) {
    setPrevPropClaimed(achievement.claimed);
    setClaimed(achievement.claimed);
  }

  const ready = achievement.progress >= achievement.target;

  async function claim() {
    if (pending || claimed || !ready) return;
    setPending(true);
    setError(null);
    const res = await claimAchievementAction(achievement.key);
    if (res.ok) {
      setClaimed(true);
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{achievement.label}</p>
          <p className="text-[11px] text-muted">
            {achievement.progress}/{achievement.target}
          </p>
        </div>
        <button
          onClick={claim}
          disabled={pending || claimed || !ready}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary-strong disabled:opacity-40"
        >
          {claimed ? "เคลมแล้ว" : pending ? "..." : "เคลม"}
        </button>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
        {achievement.reward.silver > 0 && (
          <Reward label="Silver" value={achievement.reward.silver} className="text-silver" />
        )}
        {achievement.reward.gold > 0 && <Reward label="Gold" value={achievement.reward.gold} className="text-gold" />}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Link to `/achievements` from the Profile page**

In `src/app/profile/page.tsx`, current (lines 36-41):

```tsx
      <Link
        href="/collection"
        className="mb-3 block w-full rounded-xl border border-border bg-surface py-3 text-center font-semibold hover:border-primary"
      >
        ดูคลังการ์ดทั้งหมด
      </Link>
```

Change to:

```tsx
      <Link
        href="/collection"
        className="mb-3 block w-full rounded-xl border border-border bg-surface py-3 text-center font-semibold hover:border-primary"
      >
        ดูคลังการ์ดทั้งหมด
      </Link>

      <Link
        href="/achievements"
        className="mb-3 block w-full rounded-xl border border-border bg-surface py-3 text-center font-semibold hover:border-primary"
      >
        Achievement
      </Link>
```

(No bottom-nav entry — the nav already has 5 items at full capacity (Home/Pack/Team/PvP/Profile); the Profile link is the entry point, per spec §8.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds with no errors (this also statically renders/type-checks the new `/achievements` route).

- [ ] **Step 6: Manual check in Preview**

In the Preview environment (do **not** run `npm run dev`/`npm start` manually — the Preview system manages the server):
1. Log in, open `/profile`, confirm the new "Achievement" link appears below "ดูคลังการ์ดทั้งหมด".
2. Tap it, confirm `/achievements` loads with "กิจกรรม"/"สะสม" tabs, 10 rows under กิจกรรม and 21 rows (20 club + 1 Big6) under สะสม.
3. Confirm progress bars and Silver/Gold reward chips render correctly, claim button is disabled until `progress >= target`.
4. On a narrow viewport (e.g. 375px), confirm no horizontal overflow and the tab buttons/rows remain comfortably tappable.
5. If any card is already fully owned for a club (or `totalPacksOpened`/`pvpTotalWins` already meets a threshold from earlier testing), tap "เคลม" and confirm a success state + a new notification appears in the notification center with the correct silver/gold/pack summary and links to `/achievements`.

- [ ] **Step 7: Commit**

```bash
git add src/app/achievements/page.tsx src/components/AchievementList.tsx src/app/profile/page.tsx
git commit -m "feat(achievements): add /achievements page and AchievementList UI"
```

---

### Task 9: Final verification + mark the task board complete

**Files:**
- Modify: `docs/TASKS.md`

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: build succeeds, `/achievements` listed among the routes in the build output.

- [ ] **Step 3: Confirm no leftover temporary scripts**

Run: `git status --short`
Expected: no untracked `verify-*.ts` files at the repo root (all were deleted at the end of their respective tasks).

- [ ] **Step 4: Manual QA checklist (Preview)**

- [ ] Open a pack via `/pack` → `totalPacksOpened` increases by 1 (spot-check on `/achievements`'s "เปิดซองสะสมครบ 5 ครั้ง" progress).
- [ ] Play a PvP match and win via `/pvp` → `pvpTotalWins` increases by 1 only on a win (spot-check "ชนะ PvP สะสมครบ 5 ครั้ง" progress); a draw/loss does not move it.
- [ ] On `/collection`, note which club you have the fewest missing players for; open enough packs to complete it; confirm the matching club achievement under "สะสม" reaches 100% progress and becomes claimable.
- [ ] Claim any ready achievement; confirm Silver/Gold/free-pack (if any) land in `/profile`'s currency tiles, and a notification appears with `href` → `/achievements`.
- [ ] Confirm re-claiming an already-claimed achievement is impossible (button shows "เคลมแล้ว" and stays disabled).
- [ ] Confirm the Big 6 meta achievement's progress only counts fully-completed Big 6 clubs, independent of whether those club achievements were individually claimed.

- [ ] **Step 5: Mark the task board items complete**

In `docs/TASKS.md`, current (lines 89-90):

```markdown
- [~] Achievement (เปิดซองครบ N, ชนะ PvP N, สะสมครบทีม/Big6)
- [~] Collection rewards (ครบทีม/ชาติ/ลีก/Big6)
```

Change to:

```markdown
- [x] Achievement (เปิดซองครบ N, ชนะ PvP N, สะสมครบทีม/Big6)
- [x] Collection rewards (ครบทีม/ชาติ/ลีก/Big6)
```

- [ ] **Step 6: Commit**

```bash
git add docs/TASKS.md
git commit -m "docs: mark Achievement/Collection rewards task board item complete"
```
