# Daily / Weekly Mission System

**วันที่:** 2026-07-17
**สถานะ:** Draft — รอ Codex review ก่อนขอ user approve

## บริบท / ปัญหา

`docs/TASKS.md` ขั้น 5 (สะสมแต้ม) เหลือ 3 หัวข้อ: Daily/Weekly Mission, Achievement, Collection rewards — Daily Login เดิมเสร็จแล้ว (`src/lib/daily.ts`) เอกสาร `docs/progress.md` ระบุ Mission เป็นงานถัดไปชัดเจน

สโคปรอบนี้: **เฉพาะ Daily/Weekly Mission เท่านั้น** — Achievement และ Collection rewards แยกเป็นรอบถัดไป (ตัดสินใจกับ user แล้วว่าแต่ละอย่างมีดีไซน์ของตัวเอง ทำทีละก้อนคุมสโคปง่ายกว่า)

`gdd.txt` ระบุตัวอย่าง Daily Mission ว่ามี Login/เปิดซอง/แข่ง PvP/จัดทีม/Fantasy Prediction — แต่ PvP (ขั้น 6) และ Fantasy (ขั้น 7) ยังไม่ถูกสร้างในโค้ดเลย ดังนั้น catalog รอบนี้ต้อง**จำกัดเฉพาะ action ที่มีอยู่จริงในระบบตอนนี้**: login, เปิดซอง, จัดทีม

## Non-goals

- ไม่ทำ Achievement หรือ Collection rewards (รอบถัดไป)
- ไม่ทำมิชชั่นที่ผูกกับ PvP/Fantasy Prediction (ยังไม่มีระบบให้ผูก)
- ไม่ให้ Gold จาก mission เลย — ใน `gdd.txt` ตาราง source ของ Gold Coin คือ ฝากเงินจริง/Seasonal Reward/Top Ranking/Event เท่านั้น ไม่มี Mission อยู่ในนั้น (Mission อยู่แค่ใน source list ของ Silver) ให้ Gold จาก mission จะทำลายความหายากที่ระบบตั้งใจไว้
- ไม่ฟื้น Pack Ticket — โปรเจคเลิกแจกไปแล้วตั้งแต่ขั้น 3.5 (เก็บ field ไว้เฉยๆ) ไม่มีเหตุผลให้กลับมาแจกอีกจาก mission
- ไม่ทำกลไกสะสม/เคลมย้อนหลังข้ามรอบ — มิชชั่นที่ทำไม่ทันตอนหมดรอบ (วัน/สัปดาห์) **หายเงียบๆ** เหมือน Daily Login เดิม (ขาด 1 วัน = streak รีเซ็ต ไม่มีชดเชย) เพื่อให้ทั้งสองระบบมีพฤติกรรมสอดคล้องกัน
- ไม่ทำ pruning ข้อมูลเก่าของ `MissionProgress` ในรอบนี้ (ดูหัวข้อ "งานที่เลื่อนไปอนาคต")

## ดีไซน์

### 1. Mission Catalog + ตัวเลข reward

Calibrate จากรายได้ Daily Login เดิม (130-610 silver/วัน ตาม streak, ~1 Standard Pack/1-1.5 วัน) ให้ mission เป็น "ตัวเสริม" ไม่ทำให้เงินเฟ้อ:

**Daily** (reset ทุก UTC day, ใช้ boundary เดียวกับ `dayIndex()` ใน `daily.ts`):

| Mission key | เงื่อนไข | Reward |
|---|---|---|
| `daily_login` | login วันนี้แล้ว (auto-complete) | 15 silver + 5 EXP |
| `daily_open_pack` | เปิดซอง ≥1 ครั้งวันนี้ (ทุกประเภท รวมแลก shard) | 40 silver + 10 EXP |
| `daily_assign_team` | assign/เปลี่ยนการ์ดในช่องใดก็ได้ ≥1 ครั้งวันนี้ | 25 silver + 5 EXP |

รวม daily ถ้าทำครบ = **80 silver + 20 EXP/วัน** (~13-62% ของ Daily Login วันนั้นๆ แล้วแต่ day ใน streak)

**Weekly** (reset ทุก epoch-week, ดูหัวข้อ 2 เรื่อง period key):

| Mission key | เงื่อนไข | Reward |
|---|---|---|
| `weekly_login5` | login สะสมครบ 5 วัน (ไม่ต้องติดกัน) ในสัปดาห์นี้ | 200 silver + Standard Pack ฟรี 1 ใบ |
| `weekly_open_pack10` | เปิดซองสะสมครบ 10 ครั้งในสัปดาห์นี้ | 300 silver + 30 EXP |

**วิเคราะห์ผลกระทบเศรษฐกิจ (ยืนยันกับ user แล้วว่ารับได้):**
- เงินฟรีจริง (ไม่ต้องเสียอะไรก่อน) ต่อสัปดาห์ = `daily_login`+`daily_assign_team` (40×7=280) + `weekly_login5` (200 silver + 1 pack) = **480 silver + Standard Pack ฟรี 1 ใบ** เทียบเท่า ~2.6 ซอง เพิ่มจาก baseline เดิม (6 ซอง/สัปดาห์จาก login ล้วน) เป็น **+43%**
- ส่วนที่ผูกกับเปิดซอง (`daily_open_pack`, `weekly_open_pack10`) **ไม่ใช่เงินฟรี** เป็นแค่ rebate ~10-13% ของเงินที่จ่ายไปแล้ว ไม่กระทบ balance การสุ่ม/rebate ที่ tune ไว้แล้วใน `docs/game-guide.md` §13.2
- Gold รวม 7 วันแรกยังเท่าเดิม (5 Gold จาก day-7 bonus) ไม่กระทบ timeline เปิด Evolution/Royal Prime ที่ tune ไว้แล้ว

### 2. Data Model

```prisma
model MissionProgress {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  missionKey String   // ต้องมาจาก MISSION_KEYS const เท่านั้น ห้าม hardcode string
  periodKey  String   // daily: UTC date string / weekly: epoch-week index (string)
  progress   Int      @default(0)
  claimed    Boolean  @default(false)
  updatedAt  DateTime @updatedAt

  @@unique([userId, missionKey, periodKey])
  @@index([userId, periodKey])
}
```

**เหตุผลเลือกตารางเดียว generic แทนคอลัมน์แยกต่อมิชชั่น:** (ตัดสินใจร่วมกับ user แล้วหลังเทียบ 2 แนวทาง)
1. เพิ่ม/แก้มิชชั่นในอนาคต (ตอน PvP/Fantasy พร้อม) ไม่ต้อง migrate DB เลย — ลด migration risk สะสมตลอดอายุเกม
2. **ป้องกันบั๊คคลาสเดียวกับที่โปรเจคนี้เคยเจอจริง** — logic level-up เดิม copy ซ้ำ 3 ที่ (`economy.ts`/`packs.ts`/`daily.ts`) จนรายงานค่าคลาดเคลื่อน ต้องรวมเป็น `applyExp()`/`levelReward()` (ดู `docs/TASKS.md` ขั้น 5) แนวทางคอลัมน์แยกจะพาโค้ดกลับไปเสี่ยงแบบเดียวกัน (logic เคลม/เช็คเงื่อนไขกระจายต่อคอลัมน์) ส่วนตารางเดียว + catalog เป็นโค้ด (`MISSIONS` object) ให้ UI และฟังก์ชันเคลมอ่าน single source of truth เดียวกัน
3. Type-safety risk จาก string key แก้ด้วย `MISSION_KEYS` const object (compiler จับ typo ให้เหมือนใช้คอลัมน์จริง)

**Catalog** — `src/lib/missionConfig.ts`:
```ts
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
export const MISSIONS: Record<MissionKey, MissionConfig> = { /* ตามตารางหัวข้อ 1 */ };
```

**Period key helpers** — `src/lib/missionPeriod.ts`, ใช้ epoch-day เดียวกับ `dayIndex()` ใน `daily.ts` เป็นฐาน เพื่อ boundary UTC ตรงกันทั้งระบบ:
```ts
export function dailyPeriodKey(d: Date): string   // จาก dayIndex(d)
export function weeklyPeriodKey(d: Date): string  // String(Math.floor(dayIndex(d) / 7)) — epoch-week ไม่ใช่ปฏิทิน Mon-Sun
```

### 3. จุด Hook เข้าโค้ดเดิม

ฟังก์ชันกลาง `bumpMission(tx, userId, key, now, amount=1)` ใน `src/lib/missions.ts` — upsert `MissionProgress` แบบ `increment` เรียกจากใน**ทรานแซกชันเดิม**ของแต่ละ action (ไม่เพิ่ม round-trip ใหม่):

| Action เดิม | ไฟล์ | Mission ที่ bump |
|---|---|---|
| `loginAction`/`registerAction`/`devLoginAction` สำเร็จ | `auth.ts` | `DAILY_LOGIN` เสมอ + `WEEKLY_LOGIN_5` **เฉพาะครั้งแรกของวันนี้** (เช็ค `daily_login` วันนี้ยังไม่มี progress ก่อนค่อย bump ทั้งคู่ — กันนับซ้ำถ้า login หลายครั้ง/วัน) |
| `openPack()` / `openPackWithShards()` สำเร็จ (`finalizeOpen`) | `packs.ts` | `DAILY_OPEN_PACK` + `WEEKLY_OPEN_PACK_10` |
| `assignSlot()` (ทุกครั้ง รวมกดเอาการ์ดออก) | `squad.ts` | `DAILY_ASSIGN_TEAM` |

**สำคัญ:** `grantFreePack()` (ซองฟรีจาก level-up/login-milestone/weekly-mission-reward) **ไม่นับเป็น "เปิดซอง"** — ไม่ต่อสาย `bumpMission()` เข้าไปเลย เพราะไม่ใช่การกระทำที่ผู้เล่นตั้งใจเปิดเอง (กันฟาร์ม mission แบบ passive ผ่านของฟรีระบบอื่น และกัน feedback loop: ซองฟรีจาก `weekly_open_pack10`/`weekly_login5` เอง)

### 4. Flow การเคลมรางวัล (manual claim — ตัดสินใจกับ user แล้วเพื่อเพิ่มการมีส่วนร่วม)

Server Action ใหม่ `claimMissionAction(missionKey: MissionKey)` ใน `src/app/actions/missions.ts`:
1. หา `periodKey` ปัจจุบันตาม `config.period`
2. อ่าน `MissionProgress` แถวนั้น — ถ้าไม่มีแถว หรือ `progress < target` → error "ยังทำไม่ครบเงื่อนไข"; ถ้า `claimed` แล้ว → error "เคลมไปแล้ว"
3. mark `claimed = true`
4. แจกรางวัล **ผ่านฟังก์ชันเดิมที่มีอยู่แล้วเท่านั้น** — `applyExp()` + `levelReward()` แพทเทิร์นเดียวกับ `finalizeOpen`/`claimDaily`, และ `grantFreePack()` ถ้ามี `freePackId` (ไม่เขียน logic แจกรางวัลใหม่ซ้ำ)
5. ทั้งหมดอยู่ใน `prisma.$transaction` เดียว (atomic check-and-set กันกดรัว/double-claim — SQLite `connection_limit=1` ที่แก้ deadlock ไปแล้วทำให้ทรานแซกชันเรียงคิวกันเองอยู่แล้ว)

**Notification:** เพิ่ม `"MISSION_CLAIMED"` เข้า `NOTIFICATION_TYPES` ใน `constants.ts` (แค่เพิ่ม string ใน array ไม่ใช่ migration) + ฟังก์ชัน `notifyMissionClaimed()` ใน `notifications.ts` แพทเทิร์นเดียวกับ `notifyLevelRewards()` เป๊ะ

หลังเคลมสำเร็จ: `revalidatePath("/")` ให้ Home รีเฟรช (แพทเทิร์นเดียวกับ `assignSlotAction`)

### 5. UI — section ใหม่บน Home

**เหตุผลเลือกอยู่บน Home แทนหน้า/`modal` แยก:** bottom nav เต็มแล้ว (Home/Pack/Team/PvP/Profile = 5 ช่อง ตาม mobile-first ไม่ควรเกินนี้) และ gdd.txt เน้นว่าระบบทั้งหมดออกแบบให้ "ผู้เล่นมีเหตุผลกลับมาเล่นทุกวัน" — ซ่อนไว้หลัง modal/หน้าแยกจะลดการมองเห็น ลดแรงจูงใจ

- `getMissionStatus(userId)` ใน `src/lib/missions.ts`: หา periodKey ปัจจุบันของ daily/weekly แล้ว query ทุกแถวที่ตรง รวมกับ catalog fill ค่า default (progress 0, claimed false) ให้มิชชั่นที่ยังไม่มีแถว (user ใหม่)
- `src/app/page.tsx` เพิ่ม `<MissionList missions={await getMissionStatus(userId)} />` ต่อจาก `<DailyClaim />`
- Component ใหม่ `src/components/MissionList.tsx` (`"use client"`, แพทเทิร์น `useState` pending/error ต่อมิชชั่น + `router.refresh()` หลังเคลม เหมือน `DailyClaim.tsx` เป๊ะ, ใช้ `Reward` component เดิมซ้ำ ไม่สร้างใหม่)
  - แบ่ง 2 กลุ่มในการ์ดเดียว: "มิชชั่นวันนี้" (3 แถว) / "มิชชั่นสัปดาห์นี้" (2 แถว)
  - แต่ละแถว: ชื่อ + progress bar (`{progress}/{target}`) + preview reward + ปุ่มเคลม (disabled ถ้ายังไม่ครบ target, เปลี่ยนข้อความเป็น "เคลมแล้ว" ถ้า claimed)
  - **ไม่ใช้ emoji** (กติกาโปรเจค — `DailyClaim.tsx` เดิมมี 🎁 หลงเหลือ 1 จุด แต่โค้ดใหม่จะไม่เอาแพทเทิร์นนั้นมาใช้ต่อ)
  - Mobile-first: layout แนวตั้งกะทัดรัด ปุ่มเคลมชิดขวาแบบเดียวกับปุ่ม "รับรางวัล" ใน `DailyClaim.tsx`

## Edge cases

1. **Double-claim/กดรัว** — ปุ่ม disable ระหว่าง `pending` + เช็ค `claimed` ในทรานแซกชันเดียวกับ mark `claimed=true` (atomic, SQLite เรียงคิวทรานแซกชันอยู่แล้ว)
2. **User ใหม่ไม่มีแถว `MissionProgress` เลย** — `getMissionStatus()` fill default จาก catalog เอง ไม่ error
3. **ลบบัญชี test (`resetTestUserAction`)** — `onDelete: Cascade` ลบ `MissionProgress` ตามอัตโนมัติ ไม่มี orphan row
4. **จัดทีมซ้ำหลายครั้ง/วัน** — นับทุกครั้งที่ `assignSlot` ถูกเรียก แต่ target=1 ครั้งแรกก็ครบแล้ว เกิน target ได้ไม่ error
5. **ซองฟรีจาก `weekly_login5` ต้องไม่ป้อนกลับเข้ามานับเป็น "เปิดซอง" ซ้ำ** — `claimMissionAction` เรียก `grantFreePack()` ตรงๆ ไม่ผ่าน `openPack()`, และ `grantFreePack()` ไม่ต่อสาย `bumpMission()` (ดูหัวข้อ 3) จึงไม่เกิด feedback loop
6. **Guest (ยังไม่ login)** — section มิชชั่นไม่ render เลย (Home แยกมุมมอง guest/logged-in อยู่แล้วเหมือน `DailyClaim`)

## งานที่เลื่อนไปอนาคต (บันทึกไว้ใน `docs/TASKS.md` ไม่ทำรอบนี้)

- **Pruning ข้อมูลเก่า** — `MissionProgress` โตแบบ unbounded ตามจำนวนผู้เล่น×เวลา (มากกว่าถ้าใช้แนวทางคอลัมน์แยกที่โตแค่ตามจำนวนรอบ ไม่ใช่ตามจำนวนมิชชั่น) ต้องมี cron/admin action ลบ periodKey ที่พ้นรอบไปแล้วเกิน ~4 สัปดาห์ (เคลมไม่ได้อีกต่อไปตามกติกา "หายเงียบๆ")
- Mission ที่ผูกกับ PvP/Fantasy — รอ ขั้น 6/7 สร้างจริงก่อน

## ไฟล์ที่กระทบ

- `prisma/schema.prisma` — เพิ่ม model `MissionProgress` + migrate
- `src/lib/missionConfig.ts` — ใหม่ (catalog)
- `src/lib/missionPeriod.ts` — ใหม่ (period key helpers)
- `src/lib/missions.ts` — ใหม่ (`bumpMission`, `getMissionStatus`)
- `src/app/actions/missions.ts` — ใหม่ (`claimMissionAction`)
- `src/app/actions/auth.ts` — เพิ่ม bump `DAILY_LOGIN`/`WEEKLY_LOGIN_5` ใน login actions
- `src/lib/packs.ts` — เพิ่ม bump `DAILY_OPEN_PACK`/`WEEKLY_OPEN_PACK_10` ใน `finalizeOpen`
- `src/lib/squad.ts` — เพิ่ม bump `DAILY_ASSIGN_TEAM` ใน `assignSlot`
- `src/lib/constants.ts` — เพิ่ม `"MISSION_CLAIMED"` ใน `NOTIFICATION_TYPES`
- `src/lib/notifications.ts` — เพิ่ม `notifyMissionClaimed()`
- `src/components/MissionList.tsx` — ใหม่
- `src/app/page.tsx` — render `<MissionList />`
- `docs/TASKS.md` — ตัด checklist ขั้น 5 มิชชั่น + บันทึกงาน pruning ที่เลื่อนไปอนาคต

## Verification

- Test script (`tsx`, ทิ้งหลังผ่าน) ครอบคลุม: bump progress ถูกต้องตาม action, claim สำเร็จเมื่อครบ target เท่านั้น, claim ซ้ำ error, weekly login นับเฉพาะวันแรกของวันนั้น, `grantFreePack` ไม่ทำให้ progress ขยับ
- `npx tsc --noEmit`, `npm run build` ผ่าน
- Browser check ผ่าน Preview: ทำแต่ละ action จริง (login/เปิดซอง/จัดทีม) แล้วดู progress bar ขยับ, กดเคลมได้เมื่อครบ, ปุ่มหายไปเป็น "เคลมแล้ว", รีเฟรชแล้ว state ยังอยู่ถูกต้อง, ข้าม UTC day/week boundary แล้ว reset ตามที่ออกแบบ
