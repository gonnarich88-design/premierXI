# Chemistry Full-Team Dilution + Full Unity Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the partial-squad rating exploit in Chemistry (avgOvr diluted by a constant squad size of 11 instead of the count of filled slots) and add a strict "Full Unity" reward (same-club + exact-position squad) with a small flat rating bonus and a dedicated visual on the pitch.

**Architecture:** Pure logic change lives entirely in `src/lib/chemistry.ts` + `src/lib/chemistryConfig.ts` (no DB/schema changes — `computeChemistry()` is a pure function with no side effects). The new `fullUnity` boolean flows one level up through `src/app/team/page.tsx` into the existing `TeamBuilder` client component, which renders a badge and an SVG ring overlay conditionally. Docs (`docs/system-reference.md`) are updated to match.

**Tech Stack:** Next.js (App Router, TypeScript), React 19, Tailwind CSS. No test framework is installed in this repo (no jest/vitest, no `tests/` dir) — verification of pure-function logic uses a temporary `tsx`-run script (this repo's existing convention per `docs/TASKS.md`, e.g. "verify logic ผ่านสคริปต์ทดสอบ"), which is deleted before committing since no such scripts are ever committed to this repo.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-chemistry-full-team-design.md` — this plan implements it exactly; do not deviate without checking back.
- `teamChem` (x/33) and the per-slot 0-3 chem dots must NOT change — only `avgOvr`/`rating` and the new `fullUnity` field are affected.
- Full Unity requires all three: `filled === 11`, all 11 players same `club`, all 11 players `fitPosition() === "exact"` (not `sameGroup`).
- `FULL_UNITY_RATING_BONUS` is a flat `+2`, applied after the existing `MAX_CHEM_RATING_BONUS` (10%) multiplier — not compounded into it. Mark it experimental in code comments (per spec, revisit once PvP/matchmaking exists).
- No full pairwise link mesh (FUT-style) — only a single ring/loop connecting all 11 pitch positions, shown only when `fullUnity === true`.
- Ring SVG must have `pointer-events-none` and must render below the player cards (DOM order, no explicit z-index needed since the rest of this file uses none).
- No emojis in UI (project rule) — the Full Unity badge is plain text, no icon glyph.
- Never run `npm run dev` / `npm start` (Preview system manages the server) — use `npm run build` only for build verification, and `npx tsc --noEmit` for type-checking.
- Mobile-first: badge and ring must not visually break the existing 3-column stat grid or the pitch card taps on small viewports (verify in Preview before considering the UI task done).

---

### Task 1: Chemistry core logic — 11-slot dilution + Full Unity detection/bonus

**Files:**
- Modify: `src/lib/chemistryConfig.ts`
- Modify: `src/lib/chemistry.ts`
- Test (temporary, not committed): `verify-chemistry.ts` (repo root)

**Interfaces:**
- Produces: `MAX_SQUAD_SIZE: number` (11), `FULL_UNITY_RATING_BONUS: number` (2) exported from `chemistryConfig.ts`. `ChemResult` type gains `fullUnity: boolean`. `computeChemistry()` return value's `rating` now includes the Full Unity bonus when applicable; `avgOvr` is now computed over a constant divisor of 11 instead of `filled`.
- Consumes: nothing new — `computeChemistry()` keeps its existing signature `(entries: (ChemEntry | null)[]): ChemResult`.

- [ ] **Step 1: Add the two new constants to `chemistryConfig.ts`**

Add at the end of the file:

```ts
/**
 * ขนาดทีมเต็ม (11 คน) — ใช้เป็นตัวหารคงที่สำหรับ avgOvr แทนจำนวนคนที่ลงจริง
 * กันทีมไม่ครบ 11 คนแต่ยังได้ Rating สูงเทียบเท่าทีมครบ (avgOvr เดิมหารด้วย filled ทำให้ทีม
 * ไม่กี่คนที่ OVR สูง+synergy กันดี ได้ Rating ใกล้เคียงทีมเต็มโดยไม่ต้องกรอกให้ครบเลย)
 */
export const MAX_SQUAD_SIZE = 11;

/**
 * Rating บวกพิเศษเมื่อครบเงื่อนไข Full Unity (11 คนสโมสรเดียวกันเป๊ะ + ตำแหน่ง exact ทุกคน)
 * ค่านี้เป็น experimental — ยังไม่มีระบบ PvP/Matchmaking ที่ Rating มีผลจริง (ดู docs/TASKS.md ขั้น 6)
 * ต้องกลับมาทบทวนตอนสร้างระบบนั้น ว่า +2 ยังเหมาะสมอยู่ไหม
 */
export const FULL_UNITY_RATING_BONUS = 2;
```

- [ ] **Step 2: Write the temporary verify script asserting the new behavior**

Create `verify-chemistry.ts` at the repo root:

```ts
import assert from "node:assert/strict";
import { computeChemistry, type ChemEntry } from "@/lib/chemistry";

const SLOT_POS_433 = ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "ST", "RW"];

function mkEntry(overrides: Partial<ChemEntry> & { slotPos: string }): ChemEntry {
  return {
    ovr: 80,
    position: overrides.slotPos,
    altPositions: [],
    club: "Club A",
    nation: "England",
    ...overrides,
  };
}

function emptySquad(): (ChemEntry | null)[] {
  return SLOT_POS_433.map(() => null);
}

// Scenario A: empty squad
{
  const r = computeChemistry(emptySquad());
  assert.strictEqual(r.filled, 0);
  assert.strictEqual(r.teamChem, 0);
  assert.strictEqual(r.avgOvr, 0);
  assert.strictEqual(r.rating, 0);
  assert.strictEqual(r.fullUnity, false);
  console.log("PASS: empty squad");
}

// Scenario B: partial squad (5/11), high OVR + full synergy — the exploit case.
// Old formula (÷filled): avgOvr would be 90. New formula (÷11): must be 41.
{
  const entries = emptySquad();
  for (let i = 0; i < 5; i++) {
    entries[i] = mkEntry({ slotPos: SLOT_POS_433[i], ovr: 90, club: "Man City", nation: "England" });
  }
  const r = computeChemistry(entries);
  assert.strictEqual(r.filled, 5);
  assert.strictEqual(r.avgOvr, 41, `expected avgOvr 41, got ${r.avgOvr}`);
  assert.strictEqual(r.teamChem, 15, `expected teamChem 15, got ${r.teamChem}`);
  assert.strictEqual(r.rating, 43, `expected rating 43, got ${r.rating}`);
  assert.strictEqual(r.fullUnity, false);
  console.log("PASS: partial squad dilutes avgOvr (exploit closed)");
}

// Scenario C: full squad (11/11), mixed clubs/nations, no links — regression parity check.
// At filled=11, MAX_SQUAD_SIZE and filled are the same divisor, so this must match old behavior.
{
  const entries = SLOT_POS_433.map((pos, i) =>
    mkEntry({ slotPos: pos, ovr: 80, club: `Club ${i}`, nation: `Nation ${i}` }),
  );
  const r = computeChemistry(entries);
  assert.strictEqual(r.filled, 11);
  assert.strictEqual(r.avgOvr, 80);
  assert.strictEqual(r.teamChem, 0);
  assert.strictEqual(r.rating, 80);
  assert.strictEqual(r.fullUnity, false);
  console.log("PASS: full mixed squad — no regression");
}

// Scenario D: Full Unity — 11/11, same club, exact position everywhere.
{
  const entries = SLOT_POS_433.map((pos) =>
    mkEntry({ slotPos: pos, ovr: 90, club: "Man City", nation: "England" }),
  );
  const r = computeChemistry(entries);
  assert.strictEqual(r.avgOvr, 90);
  assert.strictEqual(r.teamChem, 33);
  assert.strictEqual(r.fullUnity, true);
  assert.strictEqual(r.rating, 101, `expected rating 101 (99 + 2 bonus), got ${r.rating}`);
  console.log("PASS: Full Unity grants +2 bonus");
}

// Scenario E: one player from a different club — Full Unity must NOT trigger.
{
  const entries = SLOT_POS_433.map((pos) =>
    mkEntry({ slotPos: pos, ovr: 90, club: "Man City", nation: "England" }),
  );
  entries[10] = mkEntry({ slotPos: "RW", ovr: 90, club: "Arsenal", nation: "England" });
  const r = computeChemistry(entries);
  assert.strictEqual(r.filled, 11);
  assert.strictEqual(r.fullUnity, false);
  console.log("PASS: mismatched club blocks Full Unity");
}

// Scenario F: same club everywhere, but one player is sameGroup (not exact) — must NOT trigger.
{
  const entries = SLOT_POS_433.map((pos) =>
    mkEntry({ slotPos: pos, ovr: 90, club: "Man City", nation: "England" }),
  );
  // slot 8 is "LW"; give that player position "RW" (same ATT group, not exact, no altPositions covering LW)
  entries[8] = mkEntry({ slotPos: "LW", ovr: 90, club: "Man City", nation: "England", position: "RW" });
  const r = computeChemistry(entries);
  assert.strictEqual(r.fullUnity, false);
  console.log("PASS: sameGroup (non-exact) position blocks Full Unity");
}

// Scenario G: exact fit via altPositions — must still trigger Full Unity.
{
  const entries = SLOT_POS_433.map((pos) =>
    mkEntry({ slotPos: pos, ovr: 90, club: "Man City", nation: "England" }),
  );
  // slot 8 is "LW"; player's primary position is "RW" but altPositions includes "LW" -> fitPosition = exact
  entries[8] = mkEntry({
    slotPos: "LW",
    ovr: 90,
    club: "Man City",
    nation: "England",
    position: "RW",
    altPositions: ["LW"],
  });
  const r = computeChemistry(entries);
  assert.strictEqual(r.fullUnity, true, "exact fit via altPositions should still count");
  console.log("PASS: exact fit via altPositions still grants Full Unity");
}

// Scenario H: remove one player from a Full Unity squad — must flip back to false.
{
  const entries = SLOT_POS_433.map((pos) =>
    mkEntry({ slotPos: pos, ovr: 90, club: "Man City", nation: "England" }),
  );
  entries[10] = null;
  const r = computeChemistry(entries);
  assert.strictEqual(r.filled, 10);
  assert.strictEqual(r.fullUnity, false);
  console.log("PASS: removing a player clears Full Unity");
}

console.log("ALL PASS");
```

- [ ] **Step 3: Run the script to confirm it fails against the current implementation**

Run: `npx tsx verify-chemistry.ts`
Expected: FAILS — either a TypeScript error (`Property 'fullUnity' does not exist on type 'ChemResult'`) or, once that's worked around, an `AssertionError` on the Scenario B avgOvr check (current code gives `90`, not `41`). Either failure mode confirms the test is exercising real, not-yet-built behavior.

- [ ] **Step 4: Implement the changes in `chemistry.ts`**

Update the import block at the top:

```ts
import { POSITION_GROUP, type Position } from "@/lib/constants";
import {
  LINK_WEIGHT,
  LINK_SCORE_THRESHOLDS,
  POSITION_FACTOR,
  POSITION_OVR_PENALTY,
  MAX_TEAM_CHEM,
  MAX_CHEM_RATING_BONUS,
  MAX_SQUAD_SIZE,
  FULL_UNITY_RATING_BONUS,
} from "@/lib/chemistryConfig";
```

Update `ChemResult`:

```ts
export type ChemResult = {
  teamChem: number; // 0-33
  avgOvr: number;
  rating: number; // OVR ปรับด้วย chemistry
  filled: number;
  perSlot: number[]; // chem 0-3 ต่อผู้เล่น (ตาม index ที่ส่งเข้ามา)
  fullUnity: boolean; // ครบ 11 คน + สโมสรเดียวกันเป๊ะ + ตำแหน่ง exact ทุกคน
};
```

Update the early return for an empty squad:

```ts
  if (filled === 0) {
    return {
      teamChem: 0,
      avgOvr: 0,
      rating: 0,
      filled: 0,
      perSlot: entries.map(() => 0),
      fullUnity: false,
    };
  }
```

Replace the tail of the function (from `const teamChem = ...` to the final `return`) with:

```ts
  const teamChem = perSlot.reduce((a, b) => a + b, 0);
  // หารด้วย MAX_SQUAD_SIZE คงที่ (ไม่ใช่ filled) กันทีมไม่ครบได้ rating สูงเทียบเท่าทีมครบ
  const avgOvr = Math.round(effectiveOvrSum / MAX_SQUAD_SIZE);

  const fullUnity =
    filled === MAX_SQUAD_SIZE &&
    filledEntries.every((e) => e.club === filledEntries[0].club) &&
    filledEntries.every((e) => fitPosition(e) === "exact");

  // chemistry เต็ม MAX_TEAM_CHEM → โบนัสสูงสุด MAX_CHEM_RATING_BONUS
  const baseRating = Math.round(
    avgOvr * (1 + (teamChem / MAX_TEAM_CHEM) * MAX_CHEM_RATING_BONUS),
  );
  const rating = fullUnity ? baseRating + FULL_UNITY_RATING_BONUS : baseRating;

  return { teamChem, avgOvr, rating, filled, perSlot, fullUnity };
```

- [ ] **Step 5: Run the script to confirm it passes**

Run: `npx tsx verify-chemistry.ts`
Expected:
```
PASS: empty squad
PASS: partial squad dilutes avgOvr (exploit closed)
PASS: full mixed squad — no regression
PASS: Full Unity grants +2 bonus
PASS: mismatched club blocks Full Unity
PASS: sameGroup (non-exact) position blocks Full Unity
PASS: exact fit via altPositions still grants Full Unity
PASS: removing a player clears Full Unity
ALL PASS
```

- [ ] **Step 6: Type-check, then delete the temporary script**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `rm verify-chemistry.ts`
(This repo has no test framework and never commits ad-hoc verify scripts — see `docs/TASKS.md` for the established pattern of running a script once and discarding it.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/chemistry.ts src/lib/chemistryConfig.ts
git commit -m "fix(chemistry): dilute avgOvr by constant squad size, add Full Unity bonus"
```

---

### Task 2: Full Unity UI — badge + pitch ring, wired from the squad page

**Files:**
- Modify: `src/components/TeamBuilder.tsx`
- Modify: `src/app/team/page.tsx`

**Interfaces:**
- Consumes: `ChemResult.fullUnity: boolean` from Task 1's `computeChemistry()`.
- Produces: `TeamBuilder` accepts a new required prop `fullUnity: boolean`. No new exports beyond that — this is a leaf UI change.

- [ ] **Step 1: Pass `fullUnity` from the server component**

In `src/app/team/page.tsx`, the `<TeamBuilder ... />` call currently ends with:

```tsx
      rating={chem.rating}
      teamChem={chem.teamChem}
      filled={chem.filled}
    />
```

Change it to:

```tsx
      rating={chem.rating}
      teamChem={chem.teamChem}
      filled={chem.filled}
      fullUnity={chem.fullUnity}
    />
```

- [ ] **Step 2: Accept the new prop in `TeamBuilder`**

In `src/components/TeamBuilder.tsx`, the component's prop type currently is:

```tsx
export default function TeamBuilder({
  formation,
  formations,
  slots,
  ownedCards,
  rating,
  teamChem,
  filled,
}: {
  formation: string;
  formations: string[];
  slots: Slot[];
  ownedCards: OwnedCard[];
  rating: number;
  teamChem: number;
  filled: number;
}) {
```

Change it to:

```tsx
export default function TeamBuilder({
  formation,
  formations,
  slots,
  ownedCards,
  rating,
  teamChem,
  filled,
  fullUnity,
}: {
  formation: string;
  formations: string[];
  slots: Slot[];
  ownedCards: OwnedCard[];
  rating: number;
  teamChem: number;
  filled: number;
  fullUnity: boolean;
}) {
```

- [ ] **Step 3: Add the ring-ordering helper**

At the bottom of `src/components/TeamBuilder.tsx`, after the existing `Stat` function, add:

```tsx
function ringPoints(points: { x: number; y: number }[]): string {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const sorted = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  return sorted.map((p) => `${p.x},${p.y}`).join(" ");
}
```

This sorts the 11 pitch points by angle around their centroid, so connecting them in order traces a single non-crossing loop instead of following the formation's array order (which is not laid out as a ring and would draw a line that cuts across the pitch).

- [ ] **Step 4: Render the Full Unity badge**

The header stats block currently is:

```tsx
      {/* Header stats */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Rating" value={rating || "-"} className="text-primary" />
        <Stat label="Chemistry" value={`${teamChem}/${MAX_TEAM_CHEM}`} className="text-accent" />
        <Stat label="ผู้เล่น" value={`${filled}/11`} className="text-foreground" />
      </div>
```

Add a badge right after it:

```tsx
      {/* Header stats */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Rating" value={rating || "-"} className="text-primary" />
        <Stat label="Chemistry" value={`${teamChem}/${MAX_TEAM_CHEM}`} className="text-accent" />
        <Stat label="ผู้เล่น" value={`${filled}/11`} className="text-foreground" />
      </div>

      {fullUnity && (
        <div className="mb-3 flex justify-center">
          <span className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-400">
            Full Unity
          </span>
        </div>
      )}
```

- [ ] **Step 5: Render the pitch ring**

The pitch block currently is:

```tsx
      {/* Pitch */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-green-800/60 to-green-900/70">
        {/* markings */}
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-white/15" />

        {slots.map((s) => (
```

Insert the ring SVG between the markings and the slot map:

```tsx
      {/* Pitch */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-green-800/60 to-green-900/70">
        {/* markings */}
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-white/15" />

        {fullUnity && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <polygon
              points={ringPoints(slots)}
              fill="none"
              stroke="#4ade80"
              strokeWidth="0.6"
              strokeLinejoin="round"
              opacity="0.85"
            />
          </svg>
        )}

        {slots.map((s) => (
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (exit code 0).

- [ ] **Step 7: Verify visually in Preview**

This step cannot be automated — do it manually via the Preview button:
1. Open `/team`, build a squad with 11 players, all the same club, all in their exact primary/alt position (use the Collection/owned cards for one club if available; if not enough same-club cards exist for a full XI, note that in the report instead of skipping this check).
2. Confirm: the "Full Unity" badge appears, a thin green ring connects all 11 pitch positions without any line crossing awkwardly through the middle of the pitch, and the ring does not block tapping any card or empty slot.
3. Remove one player. Confirm the badge and ring both disappear immediately.
4. Repeat the same squad across at least one other formation (e.g. switch from 4-3-3 to 4-4-2) to confirm the ring still looks like a clean loop and not a self-crossing shape — if it looks wrong for a given formation, adjust `strokeWidth` or the ring approach and re-check, since this is a cosmetic value with no single "correct" number.
5. Check on a narrow mobile viewport width that the badge doesn't overflow or push the stat grid awkwardly.

- [ ] **Step 8: Commit**

```bash
git add src/components/TeamBuilder.tsx src/app/team/page.tsx
git commit -m "feat(team): show Full Unity badge and pitch ring when squad qualifies"
```

---

### Task 3: Update `docs/system-reference.md`

**Files:**
- Modify: `docs/system-reference.md`

**Interfaces:**
- Consumes: the final shapes of `chemistryConfig.ts` and `chemistry.ts` from Task 1.
- Produces: nothing consumed by other tasks — this is documentation only.

- [ ] **Step 1: Update the `chemistryConfig.ts` table (section 7.7)**

Current:

```markdown
### 7.7 `src/lib/chemistryConfig.ts`

| Export | ค่า | หมายเหตุ |
|---|---|---|
| `LINK_WEIGHT` | `{ club: 2, nation: 1, league: 0.5 }` | แต้ม link ต่อคู่ |
| `LINK_SCORE_THRESHOLDS` | `[{min:9,base:3},{min:5,base:2},{min:2,base:1},{min:0,base:0}]` | แปลง linkScore → base |
| `POSITION_FACTOR` | `{ exact: 1, sameGroup: 0.6, offGroup: 0.3 }` | factor ตำแหน่ง |
| `MAX_TEAM_CHEM` | `33` | 11 ช่อง × base 3 |
| `MAX_CHEM_RATING_BONUS` | `0.1` | โบนัส rating สูงสุด 10% |
```

Replace with:

```markdown
### 7.7 `src/lib/chemistryConfig.ts`

| Export | ค่า | หมายเหตุ |
|---|---|---|
| `LINK_WEIGHT` | `{ club: 2, nation: 1 }` | แต้ม link ต่อคู่ (ตัด league ออกแล้ว 2026-07-16 — ดู `docs/TASKS.md` ขั้น 10) |
| `LINK_SCORE_THRESHOLDS` | `[{min:9,base:3},{min:5,base:2},{min:2,base:1},{min:0,base:0}]` | แปลง linkScore → base |
| `POSITION_FACTOR` | `{ exact: 1, sameGroup: 0.6, offGroup: 0.3 }` | factor ตำแหน่ง |
| `MAX_TEAM_CHEM` | `33` | 11 ช่อง × base 3 |
| `MAX_CHEM_RATING_BONUS` | `0.1` | โบนัส rating สูงสุด 10% |
| `MAX_SQUAD_SIZE` | `11` | ตัวหารคงที่สำหรับ avgOvr (กันทีมไม่ครบได้ rating สูงเทียบเท่าทีมครบ) |
| `FULL_UNITY_RATING_BONUS` | `2` | Rating บวกพิเศษเมื่อครบ Full Unity — experimental, รอทบทวนตอนมีระบบ PvP |
```

- [ ] **Step 2: Update the `chemistry.ts` table and algorithm (section 7.8)**

Current:

```markdown
### 7.8 `src/lib/chemistry.ts`

| Export | ประเภท | รายละเอียด |
|---|---|---|
| `ChemEntry` | type | `{ ovr, position, altPositions, club, nation, league, slotPos }` |
| `ChemResult` | type | `{ teamChem, avgOvr, rating, filled, perSlot }` |
| `computeChemistry` | `(entries: (ChemEntry \| null)[]): ChemResult` | คำนวณ chemistry |

Algorithm:

1. สำหรับแต่ละผู้เล่น รวม `linkScore` จากเพื่อนร่วมทีม:
   - สโมสรเดียวกัน `+2`
   - ชาติเดียวกัน `+1`
   - ลีกเดียวกัน `+0.5`
2. แปลง `linkScore` เป็น base 0-3 ตาม `LINK_SCORE_THRESHOLDS`
3. คูณ factor ตำแหน่ง:
   - ลงตรงตำแหน่ง (หลัก/รอง): `1.0`
   - กลุ่มเดียวกัน: `0.6`
   - คนละกลุ่ม: `0.3`
4. `teamChem = ผลรวม perSlot` (สูงสุด 33)
5. `avgOvr = round(ผลรวม OVR / จำนวนคน)`
6. `rating = round(avgOvr * (1 + (teamChem / 33) * 0.1))`
```

Replace with:

```markdown
### 7.8 `src/lib/chemistry.ts`

| Export | ประเภท | รายละเอียด |
|---|---|---|
| `ChemEntry` | type | `{ ovr, position, altPositions, club, nation, slotPos }` |
| `ChemResult` | type | `{ teamChem, avgOvr, rating, filled, perSlot, fullUnity }` |
| `computeChemistry` | `(entries: (ChemEntry \| null)[]): ChemResult` | คำนวณ chemistry |

Algorithm:

1. สำหรับแต่ละผู้เล่น รวม `linkScore` จากเพื่อนร่วมทีม:
   - สโมสรเดียวกัน `+2`
   - ชาติเดียวกัน `+1`
2. แปลง `linkScore` เป็น base 0-3 ตาม `LINK_SCORE_THRESHOLDS`
3. คูณ factor ตำแหน่ง:
   - ลงตรงตำแหน่ง (หลัก/รอง): `1.0`
   - กลุ่มเดียวกัน: `0.6`
   - คนละกลุ่ม: `0.3`
4. `teamChem = ผลรวม perSlot` (สูงสุด 33)
5. `avgOvr = round(ผลรวม OVR / MAX_SQUAD_SIZE)` — หารด้วย 11 คงที่เสมอ ไม่ใช่จำนวนคนที่ลงจริง (2026-07-16: กันทีมไม่ครบ 11 คนได้ Rating สูงเทียบเท่าทีมครบ)
6. `fullUnity = filled === 11 && ทุกคนสโมสรเดียวกันเป๊ะ && ทุกคนตำแหน่ง exact ทุกคน`
7. `rating = round(avgOvr * (1 + (teamChem / 33) * 0.1))`, บวกเพิ่ม `FULL_UNITY_RATING_BONUS` (+2) ถ้า `fullUnity === true`
```

- [ ] **Step 3: Commit**

```bash
git add docs/system-reference.md
git commit -m "docs: sync system-reference with chemistry Full Unity changes"
```

---

## Post-implementation

- [ ] Update `docs/TASKS.md` ขั้น 4: change `- [~] Chemistry: แก้ avgOvr ...` to `- [x]` once all three tasks above are committed and verified.
