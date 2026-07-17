# Daily / Weekly Mission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 daily + 2 weekly missions (login, open pack, assign team) with manual-claim rewards (silver/EXP/free pack), tracked via a single generic `MissionProgress` table and a code-driven catalog, surfaced as a new section on the Home page.

**Architecture:** A generic `MissionProgress` Prisma model (one row per user × mission × period) paired with a code-defined catalog (`MISSIONS` in `src/lib/missionConfig.ts`) — no schema changes needed to add future missions. Progress is bumped inside the *existing* transactions of `claimDaily()`, `openPack()`/`openPackWithShards()`, and `assignSlot()` (the last of which needs a transaction added first, since it currently has none). Claiming is a separate manual action (`claimMissionAction`) using an atomic `updateMany` compare-and-set, reusing `applyExp()`/`levelReward()`/`grantFreePack()` exactly as `claimDaily()`/`finalizeOpen()` already do — no new reward-granting logic.

**Tech Stack:** Next.js (App Router, TypeScript), Prisma 6 + SQLite, React 19, Tailwind CSS. No test framework installed — verification uses temporary `tsx`-run scripts at the repo root (this repo's established convention), deleted before each task's commit.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md` — implements it exactly; reviewed by Codex (7/7 issues fixed) and approved by the user. Do not deviate without checking back.
- Scope is Daily/Weekly Mission **only** — no Achievement, no Collection rewards (separate future rounds), no PvP/Fantasy-linked missions (those systems don't exist yet).
- Mission rewards are **Silver + EXP + occasional free Standard Pack only — never Gold, never Pack Ticket**.
- Missed missions (period ends before target reached) **expire silently** — no catch-up/backfill mechanism.
- `MISSION_KEYS` const object is the only source of mission-key strings — never hardcode `"daily_login"` etc. as a raw string literal outside `src/lib/missionConfig.ts`.
- `bumpMission`/`bumpLoginMissions` must always receive a `tx: Prisma.TransactionClient` — never call the top-level `prisma` client from inside them.
- `grantFreePack()`/`finalizeOpen()` must **never** call `bumpMission` — mission-bump calls for pack-opening live only in `openPack()`/`openPackWithShards()`, after `finalizeOpen()` returns.
- No emojis in UI (project rule) — `MissionList.tsx` uses plain text only.
- Mobile-first: the new Home section must not visually break existing layout on small viewports (verify in Preview before considering the UI task done).
- Never run `npm run dev` / `npm start` (Preview system manages the server) — use `npm run build` only for build verification, and `npx tsc --noEmit` for type-checking.
- Test scripts (`verify-*.ts` at repo root) are never committed — run once to confirm behavior, then `rm` before the task's commit.

---

### Task 1: Prisma schema — add `MissionProgress` model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `MissionProgress` Prisma model with `@@unique([userId, missionKey, periodKey])` (Prisma default constraint name: `userId_missionKey_periodKey`), available on the generated client as `prisma.missionProgress` / `tx.missionProgress`.
- Consumes: nothing new.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Add after the `Announcement` model (end of file):

```prisma

/// ความคืบหน้ามิชชั่น Daily/Weekly — ตารางเดียว generic ใช้ร่วมกับทุกมิชชั่นในอนาคต (ไม่ต้อง migrate เพิ่มเวลาเพิ่มมิชชั่นใหม่)
/// missionKey ต้องมาจาก MISSION_KEYS ใน src/lib/missionConfig.ts เท่านั้น — ดู docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md
model MissionProgress {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  missionKey String // เช่น "daily_login" — จาก MISSION_KEYS เท่านั้น
  periodKey  String // daily: epoch-day string / weekly: epoch-week string (ดู src/lib/missionPeriod.ts)

  progress Int     @default(0)
  claimed  Boolean @default(false)

  updatedAt DateTime @updatedAt

  @@unique([userId, missionKey, periodKey])
  @@index([userId, periodKey])
}
```

- [ ] **Step 2: Add the relation field to `User`**

In `prisma/schema.prisma`, the `User` model's relation block currently is:

```prisma
  cards         UserCard[]
  squad         Squad?
  notifications Notification[]
  announcements Announcement[] @relation("AnnouncementAuthor")
}
```

Change it to:

```prisma
  cards            UserCard[]
  squad            Squad?
  notifications    Notification[]
  announcements    Announcement[] @relation("AnnouncementAuthor")
  missionProgress  MissionProgress[]
}
```

- [ ] **Step 3: Run the migration**

Run: `npx prisma migrate dev --name add_mission_progress`
Expected: `Your database is now in sync with your schema.` — creates a new folder under `prisma/migrations/` and regenerates the Prisma client.

- [ ] **Step 4: Verify the generated client has the new delegate**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `@prisma/client` types regenerated correctly).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add MissionProgress model for daily/weekly missions"
```

---

### Task 2: Mission catalog + period-key helpers

**Files:**
- Create: `src/lib/missionConfig.ts`
- Create: `src/lib/missionPeriod.ts`
- Modify: `src/lib/daily.ts` (export `dayIndex`)
- Test (temporary, not committed): `verify-mission-config.ts` (repo root)

**Interfaces:**
- Produces: `MISSION_KEYS`, `MissionKey` type, `MissionConfig` type, `MISSIONS` catalog (from `missionConfig.ts`); `dailyPeriodKey(d: Date): string`, `weeklyPeriodKey(d: Date): string` (from `missionPeriod.ts`); `dayIndex(d: Date): number` now exported from `daily.ts`.
- Consumes: nothing new.

- [ ] **Step 1: Export `dayIndex` from `daily.ts`**

In `src/lib/daily.ts`, the function currently is:

```ts
// index วันแบบ UTC (จำนวนวันนับจาก epoch) ใช้เทียบว่าวันเดียวกัน/วันต่อกันไหม
function dayIndex(d: Date): number {
  return Math.floor(d.getTime() / 86_400_000);
}
```

Change to:

```ts
// index วันแบบ UTC (จำนวนวันนับจาก epoch) ใช้เทียบว่าวันเดียวกัน/วันต่อกันไหม — export ให้ missionPeriod.ts ใช้ boundary เดียวกัน
export function dayIndex(d: Date): number {
  return Math.floor(d.getTime() / 86_400_000);
}
```

- [ ] **Step 2: Create `src/lib/missionConfig.ts`**

```ts
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
```

- [ ] **Step 3: Create `src/lib/missionPeriod.ts`**

```ts
import { dayIndex } from "@/lib/daily";

/** periodKey ของมิชชั่นรายวัน — ใช้ epoch-day เดียวกับ Daily Login (dayIndex ใน daily.ts) เพื่อให้ boundary UTC ตรงกันทั้งระบบ */
export function dailyPeriodKey(d: Date): string {
  return String(dayIndex(d));
}

/** periodKey ของมิชชั่นรายสัปดาห์ — epoch-week (ไม่ใช่ปฏิทิน Mon-Sun) เรียบง่าย ไม่ต้องพึ่ง library ปฏิทิน */
export function weeklyPeriodKey(d: Date): string {
  return String(Math.floor(dayIndex(d) / 7));
}
```

- [ ] **Step 4: Write the verify script**

Create `verify-mission-config.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { MISSION_KEYS, MISSIONS } from "@/lib/missionConfig";
import { dailyPeriodKey, weeklyPeriodKey } from "@/lib/missionPeriod";
import { dayIndex } from "@/lib/daily";

// ทุก key ใน MISSIONS ต้องมี config ตรงกับตัวเองเป๊ะ (key คงเส้นคงวา)
for (const [k, config] of Object.entries(MISSIONS)) {
  assert.strictEqual(config.key, k, `mismatched key for ${k}`);
}
console.log("PASS: MISSIONS catalog keys are self-consistent");

// ไม่มี mission ไหนให้ Gold หรือ Pack Ticket เลย (ตาม Non-goals ของสเปค)
for (const config of Object.values(MISSIONS)) {
  assert.ok(
    !("gold" in config.reward),
    `mission ${config.key} must not have a gold reward field`,
  );
}
console.log("PASS: no mission grants Gold");

// dailyPeriodKey ต้องเปลี่ยนค่าเมื่อข้ามวัน UTC และตรงกับ dayIndex() ใน daily.ts เป๊ะ
{
  const d1 = new Date("2026-07-17T23:59:59.000Z");
  const d2 = new Date("2026-07-18T00:00:01.000Z");
  assert.notStrictEqual(dailyPeriodKey(d1), dailyPeriodKey(d2));
  assert.strictEqual(dailyPeriodKey(d1), String(dayIndex(d1)));
  console.log("PASS: dailyPeriodKey changes across UTC day boundary and matches dayIndex()");
}

// weeklyPeriodKey ต้องคงที่ตลอด 7 วันติดกัน แล้วเปลี่ยนวันที่ 8
{
  const base = new Date("2026-07-13T00:00:00.000Z"); // เลือกวันที่ dayIndex หารด้วย 7 ลงตัวพอดี เพื่อให้เทสนี้ตรง edge เป๊ะ
  const startIndex = dayIndex(base);
  assert.strictEqual(startIndex % 7, 0, "test fixture ต้องเริ่มที่ epoch-week boundary พอดี");

  const week0 = weeklyPeriodKey(base);
  for (let i = 1; i < 7; i++) {
    const d = new Date(base.getTime() + i * 86_400_000);
    assert.strictEqual(weeklyPeriodKey(d), week0, `day ${i} ควรยังอยู่ epoch-week เดิม`);
  }
  const nextWeek = new Date(base.getTime() + 7 * 86_400_000);
  assert.notStrictEqual(weeklyPeriodKey(nextWeek), week0);
  console.log("PASS: weeklyPeriodKey stays constant for 7 days then rolls over");
}

console.log("ALL PASS");
```

- [ ] **Step 5: Run the script**

Run: `npx tsx verify-mission-config.ts`
Expected:
```
PASS: MISSIONS catalog keys are self-consistent
PASS: no mission grants Gold
PASS: dailyPeriodKey changes across UTC day boundary and matches dayIndex()
PASS: weeklyPeriodKey stays constant for 7 days then rolls over
ALL PASS
```

- [ ] **Step 6: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-mission-config.ts`

- [ ] **Step 7: Commit**

```bash
git add src/lib/missionConfig.ts src/lib/missionPeriod.ts src/lib/daily.ts
git commit -m "feat(missions): add mission catalog and period-key helpers"
```

---

### Task 3: Mission progress core — `bumpMission`, `bumpLoginMissions`, `getMissionStatus`

**Files:**
- Create: `src/lib/missions.ts`
- Test (temporary, not committed): `verify-mission-core.ts` (repo root)

**Interfaces:**
- Consumes: `MISSIONS`, `MISSION_KEYS`, `MissionKey` (`missionConfig.ts`); `dailyPeriodKey`, `weeklyPeriodKey` (`missionPeriod.ts`); `prisma` (`@/lib/prisma`).
- Produces: `bumpMission(tx, userId, key, now, amount?): Promise<void>`, `bumpLoginMissions(tx, userId, now): Promise<void>`, `MissionStatus` type, `getMissionStatus(userId, now): Promise<MissionStatus[]>` — all consumed by Tasks 4-8.

- [ ] **Step 1: Create `src/lib/missions.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MISSIONS, MISSION_KEYS, type MissionKey } from "@/lib/missionConfig";
import { dailyPeriodKey, weeklyPeriodKey } from "@/lib/missionPeriod";

function periodKeyFor(period: "daily" | "weekly", now: Date): string {
  return period === "daily" ? dailyPeriodKey(now) : weeklyPeriodKey(now);
}

/**
 * เพิ่ม progress ของมิชชั่น 1 ตัว — ต้องเรียกใน tx ของ action ที่ trigger เสมอ (ห้ามเรียก prisma top-level ตรงๆ)
 * เพื่อให้ progress อยู่ในทรานแซกชันเดียวกับการกระทำจริงเสมอ (atomic กับ action ที่ trigger มัน)
 */
export async function bumpMission(
  tx: Prisma.TransactionClient,
  userId: string,
  key: MissionKey,
  now: Date,
  amount = 1,
): Promise<void> {
  const periodKey = periodKeyFor(MISSIONS[key].period, now);
  await tx.missionProgress.upsert({
    where: { userId_missionKey_periodKey: { userId, missionKey: key, periodKey } },
    create: { userId, missionKey: key, periodKey, progress: amount },
    update: { progress: { increment: amount } },
  });
}

/**
 * bump DAILY_LOGIN เสมอ + WEEKLY_LOGIN_5 เฉพาะครั้งแรกของวันนี้ (กันนับซ้ำถ้ามีหลาย login/วัน)
 * ต้องเรียกใน tx เดียวกับ claimDaily() เท่านั้น — ดูเหตุผลใน docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md หัวข้อ 3
 */
export async function bumpLoginMissions(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const dailyKey = dailyPeriodKey(now);
  const existing = await tx.missionProgress.findUnique({
    where: {
      userId_missionKey_periodKey: {
        userId,
        missionKey: MISSION_KEYS.DAILY_LOGIN,
        periodKey: dailyKey,
      },
    },
  });
  const isFirstToday = !existing;

  await bumpMission(tx, userId, MISSION_KEYS.DAILY_LOGIN, now);
  if (isFirstToday) {
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_LOGIN_5, now);
  }
}

export type MissionStatus = {
  key: MissionKey;
  label: string;
  period: "daily" | "weekly";
  progress: number;
  target: number;
  claimed: boolean;
  reward: { silver: number; exp: number; freePackId?: string };
};

/** สถานะมิชชั่นทั้งหมด (daily+weekly) ของ user ตอนนี้ — fill ค่า default (progress 0, claimed false) ให้มิชชั่นที่ยังไม่มีแถวใน DB */
export async function getMissionStatus(userId: string, now: Date): Promise<MissionStatus[]> {
  const dailyKey = dailyPeriodKey(now);
  const weeklyKey = weeklyPeriodKey(now);

  const rows = await prisma.missionProgress.findMany({
    where: {
      userId,
      OR: Object.values(MISSIONS).map((config) => ({
        missionKey: config.key,
        periodKey: config.period === "daily" ? dailyKey : weeklyKey,
      })),
    },
  });
  const byKey = new Map(rows.map((r) => [r.missionKey, r]));

  return Object.values(MISSIONS).map((config) => {
    const row = byKey.get(config.key);
    return {
      key: config.key,
      label: config.label,
      period: config.period,
      progress: row?.progress ?? 0,
      target: config.target,
      claimed: row?.claimed ?? false,
      reward: config.reward,
    };
  });
}
```

- [ ] **Step 2: Write the verify script**

Create `verify-mission-core.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { bumpMission, bumpLoginMissions, getMissionStatus } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";

async function main() {
  const user = await prisma.user.create({
    data: {
      username: `verify_mission_core_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
    },
    select: { id: true },
  });

  try {
    const now = new Date("2026-07-17T10:00:00.000Z");

    // bumpMission เพิ่ม progress ทีละ amount (default 1) ผ่าน upsert
    await prisma.$transaction(async (tx) => {
      await bumpMission(tx, user.id, MISSION_KEYS.DAILY_ASSIGN_TEAM, now);
      await bumpMission(tx, user.id, MISSION_KEYS.DAILY_ASSIGN_TEAM, now);
    });
    let status = await getMissionStatus(user.id, now);
    let assignTeam = status.find((m) => m.key === MISSION_KEYS.DAILY_ASSIGN_TEAM)!;
    assert.strictEqual(assignTeam.progress, 2, "bumpMission ต้อง increment สะสม");
    console.log("PASS: bumpMission increments progress");

    // bumpLoginMissions ครั้งแรกของวัน ต้อง bump ทั้ง daily_login และ weekly_login5
    await prisma.$transaction((tx) => bumpLoginMissions(tx, user.id, now));
    status = await getMissionStatus(user.id, now);
    let dailyLogin = status.find((m) => m.key === MISSION_KEYS.DAILY_LOGIN)!;
    let weeklyLogin = status.find((m) => m.key === MISSION_KEYS.WEEKLY_LOGIN_5)!;
    assert.strictEqual(dailyLogin.progress, 1);
    assert.strictEqual(weeklyLogin.progress, 1);
    console.log("PASS: bumpLoginMissions bumps both daily+weekly on first login of the day");

    // bumpLoginMissions ครั้งที่สองในวันเดียวกัน ต้อง bump แค่ daily_login ไม่ bump weekly ซ้ำ
    await prisma.$transaction((tx) => bumpLoginMissions(tx, user.id, now));
    status = await getMissionStatus(user.id, now);
    dailyLogin = status.find((m) => m.key === MISSION_KEYS.DAILY_LOGIN)!;
    weeklyLogin = status.find((m) => m.key === MISSION_KEYS.WEEKLY_LOGIN_5)!;
    assert.strictEqual(dailyLogin.progress, 2, "daily_login bump ได้ทุกครั้ง");
    assert.strictEqual(weeklyLogin.progress, 1, "weekly_login5 ต้อง bump แค่ครั้งแรกของวันเท่านั้น");
    console.log("PASS: second login same day does not double-count weekly_login5");

    // getMissionStatus fill default (progress 0, claimed false) ให้มิชชั่นที่ยังไม่เคยถูก bump
    const openPackMission = status.find((m) => m.key === MISSION_KEYS.DAILY_OPEN_PACK)!;
    assert.strictEqual(openPackMission.progress, 0);
    assert.strictEqual(openPackMission.claimed, false);
    console.log("PASS: getMissionStatus fills default for missions with no row yet");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Run the script**

Run: `npx tsx verify-mission-core.ts`
Expected:
```
PASS: bumpMission increments progress
PASS: bumpLoginMissions bumps both daily+weekly on first login of the day
PASS: second login same day does not double-count weekly_login5
PASS: getMissionStatus fills default for missions with no row yet
ALL PASS
```

- [ ] **Step 4: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-mission-core.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/missions.ts
git commit -m "feat(missions): add bumpMission/bumpLoginMissions/getMissionStatus"
```

---

### Task 4: Refactor `assignSlot()` into a transaction + hook `DAILY_ASSIGN_TEAM`

**Files:**
- Modify: `src/lib/squad.ts`
- Test (temporary, not committed): `verify-assign-mission.ts` (repo root)

**Interfaces:**
- Consumes: `bumpMission` (`@/lib/missions`), `MISSION_KEYS` (`@/lib/missionConfig`).
- Produces: `getOrCreateSquad(userId, tx?)` now accepts an optional `tx` (backward compatible — existing callers like `src/app/team/page.tsx` pass no `tx` and keep working unchanged). `assignSlot()`'s public signature is unchanged.

- [ ] **Step 1: Rewrite `src/lib/squad.ts`**

The current file is:

```ts
import { prisma } from "@/lib/prisma";
import { FORMATIONS, DEFAULT_FORMATION } from "@/lib/formations";

const slotInclude = {
  slots: {
    orderBy: { index: "asc" as const },
    include: { card: { include: { player: true } } },
  },
};

export async function getOrCreateSquad(userId: string) {
  const existing = await prisma.squad.findUnique({
    where: { userId },
    include: slotInclude,
  });
  if (existing) return existing;

  return prisma.squad.create({
    data: {
      userId,
      formation: DEFAULT_FORMATION,
      slots: { create: Array.from({ length: 11 }, (_, i) => ({ index: i })) },
    },
    include: slotInclude,
  });
}

export async function setFormation(userId: string, formation: string) {
  if (!(formation in FORMATIONS)) throw new Error("ไม่พบ formation นี้");
  const squad = await getOrCreateSquad(userId);
  await prisma.squad.update({ where: { id: squad.id }, data: { formation } });
}

export async function assignSlot(
  userId: string,
  index: number,
  cardId: string | null,
) {
  if (index < 0 || index > 10) throw new Error("ช่องไม่ถูกต้อง");
  const squad = await getOrCreateSquad(userId);

  if (cardId) {
    const owned = await prisma.userCard.findUnique({
      where: { userId_cardId: { userId, cardId } },
      select: { id: true },
    });
    if (!owned) throw new Error("ไม่ได้เป็นเจ้าของการ์ดนี้");
    // ถ้าการ์ดนี้อยู่ช่องอื่นในทีมแล้ว ย้ายออกก่อน (กันใช้ซ้ำ)
    await prisma.squadSlot.updateMany({
      where: { squadId: squad.id, cardId },
      data: { cardId: null },
    });
  }

  await prisma.squadSlot.update({
    where: { squadId_index: { squadId: squad.id, index } },
    data: { cardId },
  });
}
```

Replace it entirely with:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FORMATIONS, DEFAULT_FORMATION } from "@/lib/formations";
import { bumpMission } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";

const slotInclude = {
  slots: {
    orderBy: { index: "asc" as const },
    include: { card: { include: { player: true } } },
  },
};

export async function getOrCreateSquad(userId: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const existing = await db.squad.findUnique({
    where: { userId },
    include: slotInclude,
  });
  if (existing) return existing;

  return db.squad.create({
    data: {
      userId,
      formation: DEFAULT_FORMATION,
      slots: { create: Array.from({ length: 11 }, (_, i) => ({ index: i })) },
    },
    include: slotInclude,
  });
}

export async function setFormation(userId: string, formation: string) {
  if (!(formation in FORMATIONS)) throw new Error("ไม่พบ formation นี้");
  const squad = await getOrCreateSquad(userId);
  await prisma.squad.update({ where: { id: squad.id }, data: { formation } });
}

// จัดทีมไม่นับสูตร (setFormation) เป็นมิชชั่น — เฉพาะการวาง/ถอดการ์ดในช่อง (assignSlot) เท่านั้น
export async function assignSlot(
  userId: string,
  index: number,
  cardId: string | null,
) {
  if (index < 0 || index > 10) throw new Error("ช่องไม่ถูกต้อง");

  await prisma.$transaction(async (tx) => {
    const squad = await getOrCreateSquad(userId, tx);

    if (cardId) {
      const owned = await tx.userCard.findUnique({
        where: { userId_cardId: { userId, cardId } },
        select: { id: true },
      });
      if (!owned) throw new Error("ไม่ได้เป็นเจ้าของการ์ดนี้");
      // ถ้าการ์ดนี้อยู่ช่องอื่นในทีมแล้ว ย้ายออกก่อน (กันใช้ซ้ำ)
      await tx.squadSlot.updateMany({
        where: { squadId: squad.id, cardId },
        data: { cardId: null },
      });
    }

    await tx.squadSlot.update({
      where: { squadId_index: { squadId: squad.id, index } },
      data: { cardId },
    });

    await bumpMission(tx, userId, MISSION_KEYS.DAILY_ASSIGN_TEAM, new Date());
  });
}
```

- [ ] **Step 2: Write the verify script**

Create `verify-assign-mission.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { assignSlot } from "@/lib/squad";
import { getMissionStatus } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";

async function main() {
  const user = await prisma.user.create({
    data: {
      username: `verify_assign_mission_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
    },
    select: { id: true },
  });
  const card = await prisma.card.findFirstOrThrow({ select: { id: true } });

  try {
    await prisma.userCard.create({ data: { userId: user.id, cardId: card.id } });

    await assignSlot(user.id, 0, card.id);
    let status = await getMissionStatus(user.id, new Date());
    let assignTeam = status.find((m) => m.key === MISSION_KEYS.DAILY_ASSIGN_TEAM)!;
    assert.strictEqual(assignTeam.progress, 1, "assignSlot ต้อง bump DAILY_ASSIGN_TEAM");
    console.log("PASS: assigning a card bumps DAILY_ASSIGN_TEAM");

    await assignSlot(user.id, 0, null);
    status = await getMissionStatus(user.id, new Date());
    assignTeam = status.find((m) => m.key === MISSION_KEYS.DAILY_ASSIGN_TEAM)!;
    assert.strictEqual(assignTeam.progress, 2, "ถอดการ์ดออกก็ต้องนับเป็น assign อีกครั้ง");
    console.log("PASS: removing a card also bumps DAILY_ASSIGN_TEAM (target=1 already satisfied either way)");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Run the script**

Run: `npx tsx verify-assign-mission.ts`
Expected:
```
PASS: assigning a card bumps DAILY_ASSIGN_TEAM
PASS: removing a card also bumps DAILY_ASSIGN_TEAM (target=1 already satisfied either way)
ALL PASS
```

- [ ] **Step 4: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-assign-mission.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/squad.ts
git commit -m "fix(squad): wrap assignSlot in a transaction, bump DAILY_ASSIGN_TEAM mission"
```

---

### Task 5: Hook `DAILY_LOGIN` / `WEEKLY_LOGIN_5` into `claimDaily()`

**Files:**
- Modify: `src/lib/daily.ts`
- Test (temporary, not committed): `verify-daily-mission.ts` (repo root)

**Interfaces:**
- Consumes: `bumpLoginMissions` (`@/lib/missions`).
- Produces: nothing new — `claimDaily()`'s signature and `ClaimResult` type are unchanged.

- [ ] **Step 1: Add the import and hook call in `src/lib/daily.ts`**

Add to the top of the file (after the existing imports):

```ts
import { bumpLoginMissions } from "@/lib/missions";
```

In `claimDaily()`, the current body is:

```ts
export async function claimDaily(userId: string): Promise<ClaimResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: {
        loginStreak: true,
        lastClaimDate: true,
        level: true,
        exp: true,
        totalLogins: true,
        evoMilestoneClaimed: true,
        primeMilestoneClaimed: true,
      },
    });

    const now = new Date();
    const today = dayIndex(now);
    const last = user.lastClaimDate ? dayIndex(user.lastClaimDate) : null;

    if (last === today) return { ok: false, error: "วันนี้รับไปแล้ว" };

    const streak = last === today - 1 ? user.loginStreak + 1 : 1;
```

Change the last two lines to:

```ts
    if (last === today) return { ok: false, error: "วันนี้รับไปแล้ว" };

    await bumpLoginMissions(tx, userId, now);

    const streak = last === today - 1 ? user.loginStreak + 1 : 1;
```

(Placed right after the "already claimed today" guard, so the mission bump only ever runs on a genuine new claim — never on the early-return path.)

- [ ] **Step 2: Write the verify script**

Create `verify-daily-mission.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { claimDaily } from "@/lib/daily";
import { getMissionStatus } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";

async function main() {
  const user = await prisma.user.create({
    data: {
      username: `verify_daily_mission_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
    },
    select: { id: true },
  });

  try {
    const first = await claimDaily(user.id);
    assert.strictEqual(first.ok, true, "claimDaily แรกต้องสำเร็จ");

    const now = new Date();
    let status = await getMissionStatus(user.id, now);
    const dailyLogin = status.find((m) => m.key === MISSION_KEYS.DAILY_LOGIN)!;
    const weeklyLogin = status.find((m) => m.key === MISSION_KEYS.WEEKLY_LOGIN_5)!;
    assert.strictEqual(dailyLogin.progress, 1);
    assert.strictEqual(weeklyLogin.progress, 1);
    console.log("PASS: claimDaily success bumps DAILY_LOGIN and WEEKLY_LOGIN_5");

    const second = await claimDaily(user.id);
    assert.strictEqual(second.ok, false, "claim ซ้ำวันเดียวกันต้อง fail");
    status = await getMissionStatus(user.id, now);
    const dailyLoginAfter = status.find((m) => m.key === MISSION_KEYS.DAILY_LOGIN)!;
    assert.strictEqual(dailyLoginAfter.progress, 1, "claim ที่ fail ต้องไม่ bump มิชชั่นซ้ำ");
    console.log("PASS: failed re-claim same day does not double-bump mission progress");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Run the script**

Run: `npx tsx verify-daily-mission.ts`
Expected:
```
PASS: claimDaily success bumps DAILY_LOGIN and WEEKLY_LOGIN_5
PASS: failed re-claim same day does not double-bump mission progress
ALL PASS
```

- [ ] **Step 4: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-daily-mission.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/daily.ts
git commit -m "feat(missions): bump DAILY_LOGIN/WEEKLY_LOGIN_5 from claimDaily"
```

---

### Task 6: Hook `DAILY_OPEN_PACK` / `WEEKLY_OPEN_PACK_10` into `openPack()`/`openPackWithShards()`

**Files:**
- Modify: `src/lib/packs.ts`
- Test (temporary, not committed): `verify-pack-mission.ts` (repo root)

**Interfaces:**
- Consumes: `bumpMission` (`@/lib/missions`).
- Produces: nothing new — `openPack()`/`openPackWithShards()`/`grantFreePack()` signatures unchanged.

- [ ] **Step 1: Add the import in `src/lib/packs.ts`**

Add to the top of the file (after the existing imports):

```ts
import { bumpMission } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";
```

- [ ] **Step 2: Hook `openPack()`**

Current:

```ts
export async function openPack(userId: string, packId: string): Promise<OpenResult> {
  const config = PACKS[packId];
  if (!config) throw new Error("ไม่พบซองนี้");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { [config.currency]: true } as Record<string, true>,
    });
    const have = (user as unknown as Record<Currency, number>)[config.currency];
    if (have < config.cost) throw new InsufficientFundsError(config.currency, have, config.cost);

    await tx.user.update({
      where: { id: userId },
      data: { [config.currency]: { decrement: config.cost } },
    });

    const picks = await resolvePackCards(tx, config);
    return finalizeOpen(tx, userId, picks);
  });
}
```

Change the last two lines of the transaction body to:

```ts
    const picks = await resolvePackCards(tx, config);
    const result = await finalizeOpen(tx, userId, picks);
    await bumpMission(tx, userId, MISSION_KEYS.DAILY_OPEN_PACK, new Date());
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_OPEN_PACK_10, new Date());
    return result;
```

- [ ] **Step 3: Hook `openPackWithShards()`**

Current:

```ts
export async function openPackWithShards(userId: string, exchangeId: string): Promise<OpenResult> {
  const exchange = SHARD_EXCHANGE[exchangeId];
  if (!exchange) throw new Error("ไม่พบรายการแลกนี้");
  const config = PACKS[exchange.packId];

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { [exchange.field]: true } as Record<string, true>,
    });
    const have = (user as unknown as Record<Currency, number>)[exchange.field];
    if (have < exchange.cost)
      throw new InsufficientFundsError(exchange.field as Currency, have, exchange.cost);

    await tx.user.update({
      where: { id: userId },
      data: { [exchange.field]: { decrement: exchange.cost } },
    });

    const picks = await resolvePackCards(tx, config);
    return finalizeOpen(tx, userId, picks);
  });
}
```

Change the last two lines of the transaction body to:

```ts
    const picks = await resolvePackCards(tx, config);
    const result = await finalizeOpen(tx, userId, picks);
    await bumpMission(tx, userId, MISSION_KEYS.DAILY_OPEN_PACK, new Date());
    await bumpMission(tx, userId, MISSION_KEYS.WEEKLY_OPEN_PACK_10, new Date());
    return result;
```

**Note:** `grantFreePack()` is deliberately left untouched — it must never bump pack-opening missions (see Global Constraints).

- [ ] **Step 4: Write the verify script**

Create `verify-pack-mission.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { openPack, grantFreePack } from "@/lib/packs";
import { getMissionStatus } from "@/lib/missions";
import { MISSION_KEYS } from "@/lib/missionConfig";

async function main() {
  const user = await prisma.user.create({
    data: {
      username: `verify_pack_mission_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
      silver: 10_000,
    },
    select: { id: true },
  });

  try {
    await openPack(user.id, "standard");
    let status = await getMissionStatus(user.id, new Date());
    let daily = status.find((m) => m.key === MISSION_KEYS.DAILY_OPEN_PACK)!;
    let weekly = status.find((m) => m.key === MISSION_KEYS.WEEKLY_OPEN_PACK_10)!;
    assert.strictEqual(daily.progress, 1);
    assert.strictEqual(weekly.progress, 1);
    console.log("PASS: openPack bumps DAILY_OPEN_PACK and WEEKLY_OPEN_PACK_10");

    await openPack(user.id, "standard");
    status = await getMissionStatus(user.id, new Date());
    weekly = status.find((m) => m.key === MISSION_KEYS.WEEKLY_OPEN_PACK_10)!;
    assert.strictEqual(weekly.progress, 2, "weekly ต้องสะสมข้ามการเปิดหลายครั้ง");
    console.log("PASS: WEEKLY_OPEN_PACK_10 accumulates across multiple opens");

    // grantFreePack (ซองฟรีจาก level-up/milestone/weekly-mission) ต้องไม่ bump มิชชั่นเปิดซองเลย
    await prisma.$transaction((tx) => grantFreePack(tx, user.id, "standard"));
    status = await getMissionStatus(user.id, new Date());
    weekly = status.find((m) => m.key === MISSION_KEYS.WEEKLY_OPEN_PACK_10)!;
    assert.strictEqual(weekly.progress, 2, "grantFreePack ต้องไม่ทำให้ progress ขยับ");
    console.log("PASS: grantFreePack does not bump open-pack missions (no farming loop)");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Run the script**

Run: `npx tsx verify-pack-mission.ts`
Expected:
```
PASS: openPack bumps DAILY_OPEN_PACK and WEEKLY_OPEN_PACK_10
PASS: WEEKLY_OPEN_PACK_10 accumulates across multiple opens
PASS: grantFreePack does not bump open-pack missions (no farming loop)
ALL PASS
```

- [ ] **Step 6: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-pack-mission.ts`

- [ ] **Step 7: Commit**

```bash
git add src/lib/packs.ts
git commit -m "feat(missions): bump DAILY_OPEN_PACK/WEEKLY_OPEN_PACK_10 from pack opening"
```

---

### Task 7: Claim flow — `claimMission()` + `claimMissionAction` + notification

**Files:**
- Modify: `src/lib/missions.ts` (add `claimMission`)
- Modify: `src/lib/constants.ts` (add `"MISSION_CLAIMED"`)
- Modify: `src/lib/notifications.ts` (add `notifyMissionClaimed`)
- Create: `src/app/actions/missions.ts`
- Test (temporary, not committed): `verify-claim-mission.ts` (repo root)

**Interfaces:**
- Consumes: `MISSIONS`, `MissionKey` (`missionConfig.ts`); `applyExp`, `levelReward` (`economy.ts`); `grantFreePack`, `LevelUpReward`, `OpenedCard` (`packs.ts`); `getSessionUserId` (`auth.ts`); `createNotification` (`notifications.ts`).
- Produces: `ClaimMissionResult` type, `claimMission(userId, missionKey, now): Promise<ClaimMissionResult>` (`missions.ts`, no session/cookie access — directly testable); `claimMissionAction(missionKey: string): Promise<ClaimMissionResult>` (`actions/missions.ts`, "use server" thin wrapper — consumed by Task 8's `MissionList.tsx`); `notifyMissionClaimed(userId, missionLabel, reward, pack?): Promise<void>`.

**Why split `claimMission` (plain function) from `claimMissionAction` ("use server"):** mirrors the existing `claimDaily()`/`claimDailyAction()` split in `daily.ts`/`actions/daily.ts` exactly. `claimMissionAction` calls `getSessionUserId()`, which reads cookies via `next/headers` — that only works inside a real Next.js request, not in a plain `tsx` script. Keeping the actual claim logic in `claimMission()` (a plain async function taking `userId` as a parameter) makes it directly testable, same as `claimDaily()` already is.

- [ ] **Step 1: Add `"MISSION_CLAIMED"` to `NOTIFICATION_TYPES`**

In `src/lib/constants.ts`, current:

```ts
export const NOTIFICATION_TYPES = [
  "DAILY_REWARD",
  "PACK_OPENED",
  "LEVEL_UP",
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
  "SYSTEM",
] as const;
```

- [ ] **Step 2: Add `claimMission` to `src/lib/missions.ts`**

Add these imports to the top of `src/lib/missions.ts` (alongside the existing ones):

```ts
import { applyExp, levelReward } from "@/lib/economy";
import { grantFreePack, type LevelUpReward, type OpenedCard } from "@/lib/packs";
```

Append to the end of the file:

```ts
export type ClaimMissionResult =
  | {
      ok: true;
      reward: { silver: number; exp: number };
      pack?: { packId: string; cards: OpenedCard[] };
      leveledUp: boolean;
      level: number;
      levelRewards: LevelUpReward[];
      missionLabel: string;
    }
  | { ok: false; error: string };

/**
 * เคลมรางวัลมิชชั่น — atomic compare-and-set (updateMany + เช็ค count) แทนอ่านแล้วค่อยเขียน
 * ไม่ต้องพึ่ง transaction-serialization ของ SQLite เป็น safety net หลัก (สำคัญถ้าย้าย DB ในอนาคต)
 * แจกรางวัลผ่าน applyExp()/levelReward()/grantFreePack() เดิมเท่านั้น — แพทเทิร์นเดียวกับ claimDaily()/finalizeOpen()
 */
export async function claimMission(
  userId: string,
  missionKey: string,
  now: Date,
): Promise<ClaimMissionResult> {
  const config = MISSIONS[missionKey as MissionKey];
  if (!config) return { ok: false, error: "ไม่พบมิชชั่นนี้" };

  return prisma.$transaction(async (tx) => {
    const periodKey = periodKeyFor(config.period, now);

    const claim = await tx.missionProgress.updateMany({
      where: {
        userId,
        missionKey: config.key,
        periodKey,
        claimed: false,
        progress: { gte: config.target },
      },
      data: { claimed: true },
    });
    if (claim.count === 0) {
      const row = await tx.missionProgress.findUnique({
        where: { userId_missionKey_periodKey: { userId, missionKey: config.key, periodKey } },
      });
      return { ok: false, error: row?.claimed ? "เคลมไปแล้ว" : "ยังทำไม่ครบเงื่อนไข" };
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { level: true, exp: true },
    });
    const { level, exp, levelsGained } = applyExp(user.level, user.exp, config.reward.exp);
    const rewardsByLevel = levelsGained.map((lv) => ({ lv, reward: levelReward(lv) }));
    const levelSilverBonus = rewardsByLevel.reduce((sum, r) => sum + r.reward.silver, 0);
    const levelGoldBonus = rewardsByLevel.reduce((sum, r) => sum + r.reward.gold, 0);

    await tx.user.update({
      where: { id: userId },
      data: {
        silver: { increment: config.reward.silver + levelSilverBonus },
        gold: { increment: levelGoldBonus },
        level,
        exp,
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

    let pack: { packId: string; cards: OpenedCard[] } | undefined;
    if (config.reward.freePackId) {
      const bonus = await grantFreePack(tx, userId, config.reward.freePackId);
      pack = { packId: config.reward.freePackId, cards: bonus.cards };
      levelRewards.push(...bonus.levelRewards);
      finalLevel = Math.max(finalLevel, bonus.level);
    }

    return {
      ok: true,
      reward: { silver: config.reward.silver, exp: config.reward.exp },
      pack,
      leveledUp: finalLevel > user.level,
      level: finalLevel,
      levelRewards,
      missionLabel: config.label,
    };
  });
}
```

- [ ] **Step 3: Add `notifyMissionClaimed` to `src/lib/notifications.ts`**

Change the top-of-file import from:

```ts
import type { LevelUpReward } from "@/lib/packs";
```

to:

```ts
import type { LevelUpReward, OpenedCard } from "@/lib/packs";
```

Append this function after `notifyLevelRewards` (before `createNotification`):

```ts
/** แจ้งเตือนเคลมมิชชั่นสำเร็จ — silver/EXP เสมอ + ซองฟรีถ้ามี (เช่น weekly_login5) */
export async function notifyMissionClaimed(
  userId: string,
  missionLabel: string,
  reward: { silver: number; exp: number },
  pack?: { packId: string; cards: OpenedCard[] },
): Promise<void> {
  const parts = [`+${reward.silver} Silver`];
  if (reward.exp) parts.push(`+${reward.exp} EXP`);
  if (pack) parts.push(`ได้ ${PACK_NAMES[pack.packId] ?? pack.packId} ฟรี`);

  await createNotification({
    userId,
    type: "MISSION_CLAIMED",
    title: `เคลมมิชชั่นสำเร็จ: ${missionLabel}`,
    body: parts.join(" · "),
    href: "/",
  });
}
```

- [ ] **Step 4: Create `src/app/actions/missions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { claimMission, type ClaimMissionResult } from "@/lib/missions";
import { notifyLevelRewards, notifyMissionClaimed } from "@/lib/notifications";

export async function claimMissionAction(missionKey: string): Promise<ClaimMissionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const result = await claimMission(userId, missionKey, new Date());
  if (result.ok) {
    revalidatePath("/", "layout");
    await notifyMissionClaimed(userId, result.missionLabel, result.reward, result.pack);
    if (result.leveledUp) {
      await notifyLevelRewards(userId, result.level, result.levelRewards);
    }
  }
  return result;
}
```

- [ ] **Step 5: Write the verify script**

Create `verify-claim-mission.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { claimMission } from "@/lib/missions";
import { MISSION_KEYS, MISSIONS } from "@/lib/missionConfig";

async function main() {
  const user = await prisma.user.create({
    data: {
      username: `verify_claim_mission_${Date.now()}`,
      phone: `0${Date.now()}`.slice(0, 10),
      passwordHash: hashPassword("x"),
    },
    select: { id: true },
  });

  try {
    const now = new Date("2026-07-17T10:00:00.000Z");

    // ยังไม่ครบ target → error
    const tooEarly = await claimMission(user.id, MISSION_KEYS.DAILY_ASSIGN_TEAM, now);
    assert.strictEqual(tooEarly.ok, false);
    console.log("PASS: claim fails when progress < target");

    // missionKey ที่ไม่มีจริง → error โดยไม่แตะ DB
    const invalid = await claimMission(user.id, "not_a_real_mission", now);
    assert.strictEqual(invalid.ok, false);
    console.log("PASS: invalid missionKey rejected at runtime");

    // ตั้ง progress ให้ครบ target ตรงๆ (ไม่ผ่าน bumpMission เพราะเทสนี้เทสแค่ claim flow)
    const periodKeyDaily = String(Math.floor(now.getTime() / 86_400_000));
    await prisma.missionProgress.create({
      data: {
        userId: user.id,
        missionKey: MISSION_KEYS.DAILY_ASSIGN_TEAM,
        periodKey: periodKeyDaily,
        progress: MISSIONS[MISSION_KEYS.DAILY_ASSIGN_TEAM].target,
      },
    });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { silver: true } });

    const claimed = await claimMission(user.id, MISSION_KEYS.DAILY_ASSIGN_TEAM, now);
    assert.strictEqual(claimed.ok, true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { silver: true } });
    assert.strictEqual(
      after.silver,
      before.silver + MISSIONS[MISSION_KEYS.DAILY_ASSIGN_TEAM].reward.silver,
      "silver ต้องเพิ่มตาม reward",
    );
    console.log("PASS: claim grants reward silver correctly");

    // เคลมซ้ำ → error
    const again = await claimMission(user.id, MISSION_KEYS.DAILY_ASSIGN_TEAM, now);
    assert.strictEqual(again.ok, false);
    console.log("PASS: double-claim rejected");

    // weekly_login5 ให้ Standard Pack ฟรีด้วย — เช็ค pack ถูกส่งกลับมาจริง
    const periodKeyWeekly = String(Math.floor(Math.floor(now.getTime() / 86_400_000) / 7));
    await prisma.missionProgress.create({
      data: {
        userId: user.id,
        missionKey: MISSION_KEYS.WEEKLY_LOGIN_5,
        periodKey: periodKeyWeekly,
        progress: MISSIONS[MISSION_KEYS.WEEKLY_LOGIN_5].target,
      },
    });
    const weeklyClaim = await claimMission(user.id, MISSION_KEYS.WEEKLY_LOGIN_5, now);
    assert.strictEqual(weeklyClaim.ok, true);
    if (weeklyClaim.ok) {
      assert.ok(weeklyClaim.pack, "weekly_login5 ต้องได้ Standard Pack ฟรีติดมาด้วย");
      assert.strictEqual(weeklyClaim.pack!.cards.length, 5);
    }
    console.log("PASS: weekly_login5 claim grants a free 5-card Standard Pack");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("ALL PASS");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Run the script**

Run: `npx tsx verify-claim-mission.ts`
Expected:
```
PASS: claim fails when progress < target
PASS: invalid missionKey rejected at runtime
PASS: claim grants reward silver correctly
PASS: double-claim rejected
PASS: weekly_login5 claim grants a free 5-card Standard Pack
ALL PASS
```

- [ ] **Step 7: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-claim-mission.ts`

- [ ] **Step 8: Commit**

```bash
git add src/lib/missions.ts src/lib/constants.ts src/lib/notifications.ts src/app/actions/missions.ts
git commit -m "feat(missions): add claim flow with atomic compare-and-set + notification"
```

---

### Task 8: UI — `MissionList` section on Home

**Files:**
- Modify: `src/components/DailyClaim.tsx` (export the `Reward` helper)
- Create: `src/components/MissionList.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getMissionStatus` (`@/lib/missions`), `MissionStatus` type (`@/lib/missions`), `claimMissionAction` (`@/app/actions/missions`), `Reward` (`@/components/DailyClaim`).
- Produces: `MissionList` React component rendered from `page.tsx`.

- [ ] **Step 1: Export `Reward` from `DailyClaim.tsx`**

In `src/components/DailyClaim.tsx`, current:

```ts
function Reward({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
```

Change to:

```ts
export function Reward({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
```

- [ ] **Step 2: Create `src/components/MissionList.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimMissionAction } from "@/app/actions/missions";
import { Reward } from "@/components/DailyClaim";
import type { MissionStatus } from "@/lib/missions";

export default function MissionList({ missions }: { missions: MissionStatus[] }) {
  const daily = missions.filter((m) => m.period === "daily");
  const weekly = missions.filter((m) => m.period === "weekly");

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-surface p-4">
      <h2 className="mb-2 font-bold">มิชชั่นวันนี้</h2>
      <div className="space-y-2">
        {daily.map((m) => (
          <MissionRow key={m.key} mission={m} />
        ))}
      </div>

      <h2 className="mb-2 mt-4 font-bold">มิชชั่นสัปดาห์นี้</h2>
      <div className="space-y-2">
        {weekly.map((m) => (
          <MissionRow key={m.key} mission={m} />
        ))}
      </div>
    </div>
  );
}

function MissionRow({ mission }: { mission: MissionStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState(mission.claimed);
  const [error, setError] = useState<string | null>(null);

  const ready = mission.progress >= mission.target;

  async function claim() {
    if (pending || claimed || !ready) return;
    setPending(true);
    setError(null);
    const res = await claimMissionAction(mission.key);
    if (res.ok) {
      setClaimed(true);
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{mission.label}</p>
          <p className="text-[11px] text-muted">
            {mission.progress}/{mission.target}
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
          style={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
        <Reward label="Silver" value={mission.reward.silver} className="text-silver" />
        {mission.reward.exp > 0 && (
          <Reward label="EXP" value={mission.reward.exp} className="text-primary" />
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Wire `MissionList` into `src/app/page.tsx`**

Add these imports (alongside the existing ones at the top of the file):

```tsx
import MissionList from "@/components/MissionList";
import { getMissionStatus } from "@/lib/missions";
```

In `LoggedInHome`, current:

```tsx
  const cardCount = await prisma.userCard.count({ where: { userId } });
  const daily = await getDailyStatus(userId);
```

Change to:

```tsx
  const cardCount = await prisma.userCard.count({ where: { userId } });
  const daily = await getDailyStatus(userId);
  const missions = await getMissionStatus(userId, new Date());
```

Then, current:

```tsx
      {/* Daily login */}
      <DailyClaim
        canClaim={daily.canClaim}
        streak={daily.streak}
        nextReward={daily.nextReward}
        totalLogins={daily.totalLogins}
      />

      {/* Quick actions */}
```

Change to:

```tsx
      {/* Daily login */}
      <DailyClaim
        canClaim={daily.canClaim}
        streak={daily.streak}
        nextReward={daily.nextReward}
        totalLogins={daily.totalLogins}
      />

      {/* Missions */}
      <MissionList missions={missions} />

      {/* Quick actions */}
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (exit code 0).

- [ ] **Step 5: Verify visually in Preview**

This step cannot be automated — do it manually via the Preview button:
1. Log in (use the `test` dev-login account, or `qatester` — both already exist in this environment).
2. On Home, confirm the "มิชชั่นวันนี้" / "มิชชั่นสัปดาห์นี้" section renders below the Daily Login card, above "เปิดซอง"/"จัดทีม" quick actions.
3. Assign a card in `/team` → return to Home → confirm "วางการ์ดในช่องอย่างน้อย 1 ครั้ง" now shows `1/1` and the "เคลม" button is enabled.
4. Tap "เคลม" → confirm it becomes "เคลมแล้ว" immediately, silver balance in the currency bar increases, and a `MISSION_CLAIMED` notification appears in `/notifications`.
5. Open a pack in `/pack` → return to Home → confirm "เปิดซอง 1 ครั้ง" progress updates.
6. Check on a narrow mobile viewport width that the mission rows don't overflow or push other Home sections awkwardly.

- [ ] **Step 6: Commit**

```bash
git add src/components/DailyClaim.tsx src/components/MissionList.tsx src/app/page.tsx
git commit -m "feat(home): show Daily/Weekly Mission list with claim buttons"
```

---

### Task 9: Update `docs/TASKS.md`

**Files:**
- Modify: `docs/TASKS.md`

**Interfaces:**
- Consumes: nothing — documentation only.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Mark the Mission checklist item done**

Current (ขั้น 5):

```markdown
- [ ] Daily Mission / Weekly Mission (track ความคืบหน้า + รับรางวัล)
```

Replace with:

```markdown
- [x] Daily Mission / Weekly Mission (track ความคืบหน้า + รับรางวัล) — 3 daily (login/เปิดซอง/จัดทีม) + 2 weekly (login 5 วัน/เปิดซองครบ 10) ผูกกับ action จริงที่มีอยู่แล้ว (ยังไม่ผูก PvP/Fantasy เพราะยังไม่สร้าง), manual claim (ปุ่มกดเอง), ไม่มี Gold/Pack Ticket จาก mission เลย, `MissionProgress` เป็นตารางเดียว generic + catalog เป็นโค้ด (`src/lib/missionConfig.ts`) กันเพิ่มมิชชั่นใหม่ต้อง migrate — ดีไซน์เต็มรีวิวโดย Codex แล้วที่ `docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md`
```

- [ ] **Step 2: Add the deferred pruning task to ขั้น 10**

Current (ขั้น 10, inside the balance sub-list, right after the Royal Prime/Evolution LB bullet):

```markdown
  - Royal Prime/Evolution pool ไม่มีการ์ดตำแหน่ง LB เลย (Royal Prime ไม่มี RB ด้วย) — ต้องมี asset รูปการ์ดใหม่ก่อนถึงจะเพิ่มได้ เป็นงาน content แยกต่างหาก
- [ ] Responsive ครบทุกหน้า (มือถือเป็นหลัก)
```

Replace with:

```markdown
  - Royal Prime/Evolution pool ไม่มีการ์ดตำแหน่ง LB เลย (Royal Prime ไม่มี RB ด้วย) — ต้องมี asset รูปการ์ดใหม่ก่อนถึงจะเพิ่มได้ เป็นงาน content แยกต่างหาก
  - [ ] Pruning ข้อมูลเก่าของ `MissionProgress` — โตแบบ unbounded ตามจำนวนผู้เล่น×เวลา (1 แถว/มิชชั่น/รอบ/ผู้เล่น) ต้องมี cron/admin action ลบ periodKey ที่พ้นรอบไปแล้วเกิน ~4 สัปดาห์ (เคลมไม่ได้อีกต่อไปตามกติกา "หายเงียบๆ") — ดู `docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md` หัวข้อ "งานที่เลื่อนไปอนาคต"
- [ ] Responsive ครบทุกหน้า (มือถือเป็นหลัก)
```

- [ ] **Step 3: Commit**

```bash
git add docs/TASKS.md
git commit -m "docs: mark Daily/Weekly Mission task board item complete"
```

---

## Post-implementation

- [ ] Run the full verification suite one more time after all 9 tasks: `npx tsc --noEmit` and `npm run build` — both must pass with zero errors.
- [ ] Confirm in Preview (per Task 8 Step 5) that the full loop works end-to-end: login → assign team → open pack → claim each mission → notification appears → Home reflects updated state after `router.refresh()`.
