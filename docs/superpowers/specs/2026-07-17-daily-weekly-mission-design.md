# Daily / Weekly Mission System

**วันที่:** 2026-07-17
**สถานะ:** Approved — รีวิวโดย Codex แล้ว (แก้ครบ 7/7 ข้อ), ตัวเลข reward ยืนยันคงเดิม (ดูเหตุผลด้านล่าง) พร้อมเขียนแผน implementation

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

**วิเคราะห์ผลกระทบเศรษฐกิจ (ยืนยันกับ user แล้วว่ารับได้เบื้องต้น — แต่ดูหมายเหตุแก้ไขด้านล่าง):**
- เงินฟรีจริง (ไม่ต้องเสียอะไรก่อน) ต่อสัปดาห์ = `daily_login`+`daily_assign_team` (40×7=280) + `weekly_login5` (200 silver + 1 pack) = **480 silver + Standard Pack ฟรี 1 ใบ** เทียบเท่า ~2.6 ซอง เพิ่มจาก baseline เดิม (6 ซอง/สัปดาห์จาก login ล้วน) เป็น **+43%**
- Gold รวม 7 วันแรกยังเท่าเดิม (5 Gold จาก day-7 bonus) ไม่กระทบ timeline เปิด Evolution/Royal Prime ที่ tune ไว้แล้ว

> **⚠ แก้ไขหลัง Codex review (2026-07-17):** ตัวเลข "rebate ~10-13%" ที่เคยเสนอไว้ **คำนวณผิด** เพราะดูแค่มิชชั่นเดียวเทียบซองเดียวแยกกัน ไม่ได้คิดผลสะสมทั้งสัปดาห์ ตัวเลขจริงถ้าผู้เล่นเปิด ~1.43 ซอง/วันจนครบ `weekly_open_pack10` (10 ซองใน 7 วัน, เงินต้น 3,000 silver): ได้ `daily_open_pack` ทุกวัน (7×40=280) + `weekly_open_pack10` ครั้งเดียว (300) = **580 silver คืน = ~19.3%** ของเงินที่จ่าย ไม่ใช่ 10-13% — และ EXP รวม (7×10 + 30 = 100) คิดเป็น **+50% ของ EXP ที่ pack ให้เองอยู่แล้ว** (10 ซอง × 20 EXP/ซอง = 200) ถือว่าเยอะกว่าที่ตั้งใจไว้พอสมควร
>
> **ตัดสินใจแล้ว (2026-07-17): คงตัวเลขเดิมทั้งหมด** (19.3% rebate + EXP boost 50%) — เหตุผล: "เก็บการ์ดครบ 100%" ไม่ใช่ตัวชี้วัดที่ถูกต้องสำหรับตัดสินใจเรื่องนี้ เพราะเกมนี้เพิ่มการ์ดใหม่ทุกซีซั่นโดยที่ collection เดิมไม่รีเซ็ต (`gdd.txt` "ระบบ Season": "แต่ Collection และการ์ดเดิมของผู้เล่นยังคงอยู่") การเก็บครบ 100% จึงเป็น moving target ตลอดไปโดยดีไซน์ ไม่มีทางจบใน 1 ซีซั่นอยู่แล้วไม่ว่า mission จะให้เท่าไร
>
> ตัวชี้วัดที่ถูกต้องคือ **"เวลาสร้างทีม Gold-tier สโมสรเดียวที่แข่งขันได้" เทียบกับความยาว 1 ซีซั่นพรีเมียร์ลีก (~7 เดือน ≈ 30 สัปดาห์)** — คำนวณจากจำนวนการ์ด Gold จริงต่อสโมสร Big 6 (Arsenal 24, Chelsea 27, Tottenham 29, Man City 23 ใบ) แบบ coupon-collector บนเซตย่อยเฉพาะสโมสร (~11-15 ใบพอครอบตำแหน่งหลัก) ≈ 173 ซอง:
> - Baseline ไม่มี mission (6 ซอง/สัปดาห์): ~29 สัปดาห์ ≈ 6.7 เดือน — แทบไม่เหลือเวลาได้ใช้ทีมก่อนซีซั่นจบ
> - **คงตัวเลข mission เดิม (~10 ซอง/สัปดาห์): ~17 สัปดาห์ ≈ 4 เดือน** — เหลือ ~3 เดือนให้ผู้เล่นใช้ทีมจริง (PvP/Fantasy ตอนพร้อม) ก่อนซีซั่นจบ ถือว่าสมดุลกับจังหวะซีซั่นดีกว่า baseline
>
> ตัวเลขในเอกสารส่วนที่เหลือ (40+10 / 300+30) เป็นค่าสุดท้ายที่ใช้ implement ได้เลย ไม่ต้องแก้อีก

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

ฟังก์ชันกลาง `bumpMission(tx, userId, key, now, amount=1)` ใน `src/lib/missions.ts` — upsert `MissionProgress` แบบ `increment` เรียกจากใน**ทรานแซกชันเดิม**ของแต่ละ action (ไม่เพิ่ม round-trip ใหม่) **ต้องรับ `tx` เป็น parameter เสมอ ห้ามเรียก `prisma` (top-level client) ตรงๆ จากในฟังก์ชันนี้** เพื่อให้ทุก read/write ที่เกี่ยวกับ mission อยู่ในทรานแซกชันเดียวกับ action ที่ trigger มันเสมอ

| Action เดิม | ไฟล์ | Mission ที่ bump |
|---|---|---|
| `claimDaily()` สำเร็จ (`ok: true`) | `daily.ts` | `DAILY_LOGIN` เสมอ + `WEEKLY_LOGIN_5` **เฉพาะครั้งแรกของวันนี้** |
| `openPack()` / `openPackWithShards()` สำเร็จ | `packs.ts` | `DAILY_OPEN_PACK` + `WEEKLY_OPEN_PACK_10` |
| `assignSlot()` (ทุกครั้ง รวมกดเอาการ์ดออก) | `squad.ts` | `DAILY_ASSIGN_TEAM` |

> **⚠ แก้ไขหลัง Codex review — จุด hook login ผิดที่เดิม:** เดิม spec เสนอให้ bump ที่ `loginAction`/`registerAction`/`devLoginAction` (`auth.ts`) แต่จุดนั้นเรียกแค่ตอน **สร้าง session ใหม่** (login/สมัคร/dev-login) — session cookie (`getSessionUserId()`) อยู่ได้นานหลายวันโดยไม่ต้อง login ซ้ำ ผู้เล่นที่เปิดแอปทุกวันด้วย session เดิมจะ**ไม่เคย**เรียก `loginAction` อีกเลย ทำให้ `daily_login`/`weekly_login5` แทบไม่ขยับ **แก้เป็น: hook ที่ `claimDaily()` (`src/lib/daily.ts`) แทน** เพราะเป็นจุดเดียวที่มี boundary เช็ค "ทำวันนี้ไปหรือยัง" (`lastClaimDate`) อยู่แล้วในตัว ตรงกับความหมาย "login วันนี้" ที่ต้องการจริงๆ (ผู้เล่นกดรับ Daily Login วันนี้แล้ว = ถือว่า "login วันนี้" สำเร็จ)
>
> **Distinct-day guard สำหรับ `WEEKLY_LOGIN_5`:** เช็ค + bump ต้องอยู่ใน `tx` เดียวกับ `claimDaily()` ทั้งหมด (ใช้ `tx.missionProgress.findUnique` ก่อน `tx.missionProgress.upsert` ภายใน transaction เดียวกัน) — ไม่พึ่งพา `connection_limit=1` เพียงอย่างเดียวเป็น safety net เพราะ transaction boundary ที่ถูกต้องคือสิ่งที่การันตีจริง (connection_limit=1 เป็นแค่ผลข้างเคียงของ SQLite ที่อาจเปลี่ยนได้ถ้าย้าย DB ในอนาคต)

**สำคัญ — ตำแหน่งเรียก `bumpMission` สำหรับเปิดซอง:** ต้องเรียกใน `openPack()`/`openPackWithShards()` (ฟังก์ชันชั้นนอก) **หลังจาก** เรียก `finalizeOpen()` เสร็จแล้วเท่านั้น **ห้ามเรียกจากภายใน `finalizeOpen()` เอง** เพราะ `grantFreePack()` ก็เรียก `finalizeOpen()` เหมือนกัน — ถ้า hook ไว้ใน `finalizeOpen()` จะทำให้ซองฟรีจาก level-up/milestone/weekly-mission-reward ถูกนับเป็น "เปิดซอง" ไปด้วยโดยไม่ตั้งใจ

**เหตุผลที่ `grantFreePack()` ไม่นับเป็น "เปิดซอง" (ปรับคำอธิบายให้ตรงกับ implementation จริง):** `grantFreePack()` สุ่มการ์ดจริงเหมือนเปิดซองปกติทุกประการ (เรียก `resolvePackCards`+`finalizeOpen` เดียวกัน) เหตุผลที่ไม่นับ**ไม่ใช่**เพราะมันไม่ใช่การสุ่มจริง แต่เพราะ (1) กัน **feedback loop**: ซองฟรีจาก `weekly_login5`/level-up milestone ต้องไม่ป้อนกลับมานับความสำเร็จของ `daily_open_pack`/`weekly_open_pack10` ซ้ำอีกที และ (2) กันผู้เล่น**ฟาร์ม mission แบบ passive** ผ่านของฟรีที่ระบบอื่นแจกให้เอง (level-up, login milestone) โดยไม่ต้องลงมือเปิดซองด้วยเงินตัวเองเลย

### 4. Flow การเคลมรางวัล (manual claim — ตัดสินใจกับ user แล้วเพื่อเพิ่มการมีส่วนร่วม)

Server Action ใหม่ `claimMissionAction(missionKey: string)` ใน `src/app/actions/missions.ts`:
1. **Validate `missionKey` runtime** — เช็คว่าเป็น key ที่มีจริงใน `MISSIONS` catalog ก่อนทำอะไรทั้งสิ้น (parameter มาจาก client ผ่าน wire, TypeScript type ไม่การันตีตอน runtime — ถ้าไม่ valid คืน error ทันทีไม่แตะ DB)
2. หา `periodKey` ปัจจุบันตาม `config.period`
3. **Atomic compare-and-set แทนอ่านแล้วค่อยเขียน** — ใช้ `tx.missionProgress.updateMany({ where: { userId, missionKey, periodKey, claimed: false, progress: { gte: config.target } }, data: { claimed: true } })` แล้วเช็ค `result.count === 1` ถ้า `0` แปลว่ายังไม่ครบเงื่อนไขหรือเคลมไปแล้ว (query แยกเพื่อบอก error message ที่ถูกต้องให้ user เท่านั้น ไม่ใช่เพื่อ correctness) — แพทเทิร์นนี้ปลอดภัยกว่า find-then-update เพราะเป็น atomic ระดับ SQL เดียว ไม่ต้องพึ่ง transaction-serialization ของ SQLite เป็น safety net หลัก (สำคัญถ้าย้าย DB ในอนาคต ตาม concern ที่บันทึกไว้แล้วใน `docs/TASKS.md` ขั้น 10 เรื่อง atomic conditional update)
4. แจกรางวัล **ผ่านฟังก์ชันเดิมที่มีอยู่แล้วเท่านั้น** — `applyExp()` + `levelReward()` แพทเทิร์นเดียวกับ `finalizeOpen`/`claimDaily`, และ `grantFreePack()` ถ้ามี `freePackId` (ไม่เขียน logic แจกรางวัลใหม่ซ้ำ)
5. ทั้งหมดอยู่ใน `prisma.$transaction` เดียว

**Notification:** เพิ่ม `"MISSION_CLAIMED"` เข้า `NOTIFICATION_TYPES` ใน `constants.ts` (แค่เพิ่ม string ใน array ไม่ใช่ migration) + ฟังก์ชัน `notifyMissionClaimed()` ใน `notifications.ts` แพทเทิร์นเดียวกับ `notifyLevelRewards()` เป๊ะ

หลังเคลมสำเร็จ: `revalidatePath("/")` ให้ Home รีเฟรช (แพทเทิร์นเดียวกับ `assignSlotAction`) — **ต้องเช็คตอน implement ว่ากระดิ่ง notification บน header (`getUnreadCount()`) ที่อยู่ใน root layout รีเฟรชตามด้วยจริงไหม** เพราะ `revalidatePath` แบบ default อาจรีเฟรชแค่ page segment ไม่รวม layout ที่ห่อทุกหน้า ถ้าไม่รีเฟรชให้ใช้ `revalidatePath("/", "layout")` แทน

### 5. UI — section ใหม่บน Home

**เหตุผลเลือกอยู่บน Home แทนหน้า/`modal` แยก:** bottom nav เต็มแล้ว (Home/Pack/Team/PvP/Profile = 5 ช่อง ตาม mobile-first ไม่ควรเกินนี้) และ gdd.txt เน้นว่าระบบทั้งหมดออกแบบให้ "ผู้เล่นมีเหตุผลกลับมาเล่นทุกวัน" — ซ่อนไว้หลัง modal/หน้าแยกจะลดการมองเห็น ลดแรงจูงใจ

**ขอบเขตของ "จัดทีม 1 ครั้ง" (`DAILY_ASSIGN_TEAM`):** หมายถึงเฉพาะ `assignSlot()` (วาง/ถอดการ์ดในช่อง) เท่านั้น **ไม่รวม** `setFormation()` (เปลี่ยนสูตรทีม 4-3-3/4-4-2/ฯลฯ) — ต้องเขียน label ใน UI ให้ชัดว่า "วางการ์ดในช่องอย่างน้อย 1 ครั้ง" ไม่ใช่แค่ "จัดทีม" เฉยๆ กันผู้เล่นสับสนว่าทำไมเปลี่ยนสูตรแล้วมิชชั่นไม่ขยับ

- `getMissionStatus(userId)` ใน `src/lib/missions.ts`: หา periodKey ปัจจุบันของ daily/weekly แล้ว query ทุกแถวที่ตรง รวมกับ catalog fill ค่า default (progress 0, claimed false) ให้มิชชั่นที่ยังไม่มีแถว (user ใหม่)
- `src/app/page.tsx` เพิ่ม `<MissionList missions={await getMissionStatus(userId)} />` ต่อจาก `<DailyClaim />`
- Component ใหม่ `src/components/MissionList.tsx` (`"use client"`, แพทเทิร์น `useState` pending/error ต่อมิชชั่น + `router.refresh()` หลังเคลม เหมือน `DailyClaim.tsx` เป๊ะ, ใช้ `Reward` component เดิมซ้ำ ไม่สร้างใหม่)
  - แบ่ง 2 กลุ่มในการ์ดเดียว: "มิชชั่นวันนี้" (3 แถว) / "มิชชั่นสัปดาห์นี้" (2 แถว)
  - แต่ละแถว: ชื่อ + progress bar (`{progress}/{target}`) + preview reward + ปุ่มเคลม (disabled ถ้ายังไม่ครบ target, เปลี่ยนข้อความเป็น "เคลมแล้ว" ถ้า claimed)
  - **ไม่ใช้ emoji** (กติกาโปรเจค — `DailyClaim.tsx` เดิมมี 🎁 หลงเหลือ 1 จุด แต่โค้ดใหม่จะไม่เอาแพทเทิร์นนั้นมาใช้ต่อ)
  - Mobile-first: layout แนวตั้งกะทัดรัด ปุ่มเคลมชิดขวาแบบเดียวกับปุ่ม "รับรางวัล" ใน `DailyClaim.tsx`

## Edge cases

1. **Double-claim/กดรัว** — ปุ่ม disable ระหว่าง `pending` + `claimMissionAction` ใช้ `updateMany` แบบ atomic compare-and-set (ดูหัวข้อ 4) ไม่ใช่แค่พึ่ง SQLite serialize ทรานแซกชัน
2. **User ใหม่ไม่มีแถว `MissionProgress` เลย** — `getMissionStatus()` fill default จาก catalog เอง ไม่ error
3. **ลบบัญชี test (`resetTestUserAction`)** — `onDelete: Cascade` ลบ `MissionProgress` ตามอัตโนมัติ ไม่มี orphan row
4. **จัดทีมซ้ำหลายครั้ง/วัน** — นับทุกครั้งที่ `assignSlot` ถูกเรียก แต่ target=1 ครั้งแรกก็ครบแล้ว เกิน target ได้ไม่ error (ไม่มีทาง exploit เพราะ reward แจกครั้งเดียวต่อรอบไม่ว่า progress จะเกิน target แค่ไหน — จุดนี้ต้องทบทวนใหม่ถ้าในอนาคตมีมิชชั่นที่ target > 1 ครั้ง/วัน แล้วอยาก cap ไม่ให้ progress ขยับเกินจำเป็น)
5. **ซองฟรีจาก `weekly_login5` ต้องไม่ป้อนกลับเข้ามานับเป็น "เปิดซอง" ซ้ำ** — `claimMissionAction` เรียก `grantFreePack()` ตรงๆ ไม่ผ่าน `openPack()`, และ `grantFreePack()`/`finalizeOpen()` ไม่ต่อสาย `bumpMission()` เข้าไปเลย (ดูหัวข้อ 3) จึงไม่เกิด feedback loop
6. **Guest (ยังไม่ login)** — section มิชชั่นไม่ render เลย (Home แยกมุมมอง guest/logged-in อยู่แล้วเหมือน `DailyClaim`)
7. **`assignSlot()` ปัจจุบันไม่มี transaction เลย** (ยืนยันจากโค้ดจริง `src/lib/squad.ts`) — เป็น 3 query แยก (`getOrCreateSquad`, `userCard.findUnique`/`squadSlot.updateMany`, `squadSlot.update`) เรียก `prisma` ตรงๆ ไม่ผ่าน `tx` เลย ต้อง **refactor ให้ห่อด้วย `prisma.$transaction` ก่อน** ถึงจะเพิ่ม `bumpMission` เข้าไปได้อย่างปลอดภัย (ไม่งั้น mission bump จะเป็น query แยกที่ไม่ atomic กับการ assign จริง) — เพิ่มเป็นงาน refactor ในแผน implementation ไม่ใช่แค่ "เพิ่ม 1 บรรทัด"
8. **`periodKey` เป็น string เทียบกันแบบ lexical ได้ผิดพลาด** — `weeklyPeriodKey` คืนค่าเป็น `String(number)` เช่น `"9"`, `"10"` ถ้ามีโค้ดในอนาคตเทียบ `periodKey` แบบ string ตรงๆ (เช่น pruning job ที่จะทำทีหลัง) `"10" < "9"` แบบ lexical จะผิด — ต้อง `parseInt()` ก่อนเปรียบเทียบเสมอ ไม่เทียบ string ดิบ (บันทึกไว้เป็น constraint สำหรับงาน pruning ในอนาคตด้วย)

## งานที่เลื่อนไปอนาคต (บันทึกไว้ใน `docs/TASKS.md` ไม่ทำรอบนี้)

- **Pruning ข้อมูลเก่า** — `MissionProgress` โตแบบ unbounded ตามจำนวนผู้เล่น×เวลา (มากกว่าถ้าใช้แนวทางคอลัมน์แยกที่โตแค่ตามจำนวนรอบ ไม่ใช่ตามจำนวนมิชชั่น) ต้องมี cron/admin action ลบ periodKey ที่พ้นรอบไปแล้วเกิน ~4 สัปดาห์ (เคลมไม่ได้อีกต่อไปตามกติกา "หายเงียบๆ")
- Mission ที่ผูกกับ PvP/Fantasy — รอ ขั้น 6/7 สร้างจริงก่อน

## ไฟล์ที่กระทบ

- `prisma/schema.prisma` — เพิ่ม model `MissionProgress` + migrate
- `src/lib/missionConfig.ts` — ใหม่ (catalog)
- `src/lib/missionPeriod.ts` — ใหม่ (period key helpers)
- `src/lib/missions.ts` — ใหม่ (`bumpMission`, `getMissionStatus`)
- `src/app/actions/missions.ts` — ใหม่ (`claimMissionAction`)
- `src/lib/daily.ts` — เพิ่ม bump `DAILY_LOGIN`/`WEEKLY_LOGIN_5` ใน `claimDaily()` (ไม่ใช่ `auth.ts` — แก้ตาม Codex review)
- `src/lib/packs.ts` — เพิ่ม bump `DAILY_OPEN_PACK`/`WEEKLY_OPEN_PACK_10` ใน `openPack()`/`openPackWithShards()` (ชั้นนอก **หลัง** เรียก `finalizeOpen()` เสร็จ ไม่ใช่ในตัว `finalizeOpen()` เอง)
- `src/lib/squad.ts` — **refactor `assignSlot()` ให้ห่อด้วย `prisma.$transaction`ก่อน** (ปัจจุบันไม่มี transaction เลย) แล้วค่อยเพิ่ม bump `DAILY_ASSIGN_TEAM` เข้าไปในนั้น
- `src/lib/constants.ts` — เพิ่ม `"MISSION_CLAIMED"` ใน `NOTIFICATION_TYPES`
- `src/lib/notifications.ts` — เพิ่ม `notifyMissionClaimed()`
- `src/components/MissionList.tsx` — ใหม่
- `src/app/page.tsx` — render `<MissionList />`
- `docs/TASKS.md` — ตัด checklist ขั้น 5 มิชชั่น + บันทึกงาน pruning ที่เลื่อนไปอนาคต

## Verification

- Test script (`tsx`, ทิ้งหลังผ่าน) ครอบคลุม: bump progress ถูกต้องตาม action, claim สำเร็จเมื่อครบ target เท่านั้น, claim ซ้ำ error, weekly login นับเฉพาะวันแรกของวันนั้น, `grantFreePack` ไม่ทำให้ progress ขยับ, missionKey ที่ไม่มีจริงถูก reject — **ต้อง inject `Date` คงที่เข้า `dailyPeriodKey`/`weeklyPeriodKey`/`bumpMission` ตอนเทส boundary ข้ามวัน/สัปดาห์ ห้ามพึ่ง `new Date()` จริงตอนรัน** (ฟังก์ชันเหล่านี้ออกแบบให้รับ `Date` เป็น parameter อยู่แล้วเพื่อจุดประสงค์นี้)
- `npx tsc --noEmit`, `npm run build` ผ่าน
- Browser check ผ่าน Preview: ทำแต่ละ action จริง (login/เปิดซอง/จัดทีม) แล้วดู progress bar ขยับ, กดเคลมได้เมื่อครบ, ปุ่มหายไปเป็น "เคลมแล้ว", รีเฟรชแล้ว state ยังอยู่ถูกต้อง, ข้าม UTC day/week boundary แล้ว reset ตามที่ออกแบบ
