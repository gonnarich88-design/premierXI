# Achievement + Collection Rewards System

**วันที่:** 2026-07-20
**สถานะ:** Approved — ออกแบบร่วมกับ user, รีวิวโดย Codex แล้ว (แก้ครบทุกจุดที่แจ้ง), พร้อมเขียนแผน implementation

## บริบท / ปัญหา

`docs/TASKS.md` ขั้น 5 เหลือ 2 หัวข้อสุดท้าย:
- Achievement (เปิดซองครบ N, ชนะ PvP N, สะสมครบทีม/Big6)
- Collection rewards (ครบทีม/ชาติ/ลีก/Big6)

ทั้งสองยังไม่มีโค้ดใดๆ รองรับเลย (ยืนยันจากการสำรวจโค้ดจริง) ต้องสร้างใหม่ทั้งหมด — schema, catalog, lib functions, notification, UI

## Non-goals

- **ไม่ทำ "ครบลีก"** — `Player.league` มีค่าเดียว ("Premier League") ทั้ง 613 คนในระบบ (ตัดออกจาก chemistry ไปแล้วตั้งแต่ขั้น 10 ด้วยเหตุผลเดียวกัน) เงื่อนไข "ครบลีก" จะ auto-complete ทันทีที่มีการ์ดใบแรก ไม่มีความหมายเป็น achievement ได้เลยด้วยข้อมูลปัจจุบัน — deferred จนกว่าจะมีหลายลีกจริง (ไม่ใช่แค่ unchecked เฉยๆ)
- **ไม่ทำ "ครบชาติ"** — 67 ชาติ, กระจายไม่สม่ำเสมอมาก ไม่ได้อยู่ใน bullet ของ Achievement ใน TASKS.md (มีแค่ใน Collection-rewards bullet) และเนื้อหา/UI surface เยอะเกินไปสำหรับรอบนี้ — เลื่อนเป็นงานอนาคต
- **ไม่ backfill ประวัติ** เปิดซอง/ชนะ PvP ย้อนหลัง — ไม่มี ledger เก็บไว้ (`pvpWinStreak` รีเซ็ตเมื่อแพ้ ไม่ใช่ lifetime total) เป็นไปไม่ได้ที่จะคำนวณย้อนหลังให้ถูกต้อง ผู้เล่นเก่าเริ่มนับ 0 ตั้งแต่ deploy ระบบนี้ (ต่างจาก "ครบทีม" ที่ backfill ได้เป๊ะเพราะคำนวณสดจาก `UserCard` ที่มีอยู่แล้ว)
- **ไม่รวม Starter Pack เข้า `totalPacksOpened`** — ตาม precedent เดิมในระบบ (`src/lib/starter.ts` ไม่เรียก `bumpMission` เลย ถือเป็น onboarding event แยกจาก "เปิดซอง" ทุกที่ในระบบอยู่แล้ว)
- **ไม่รวม pack ที่แจกฟรีจาก milestone อื่น** (level-up, login milestone, mission claim) เข้า `totalPacksOpened` — ตาม precedent เดียวกับที่ mission system ห้าม `finalizeOpen()`/`grantFreePack()` bump มิชชั่นเปิดซอง (ดู `docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md`) กันการนับซ้อนจาก nested `grantFreePack()` calls
- **ไม่ทำสโมสรที่มีนักเตะ 1 คน** (West Ham United, Leicester City, Burnley — ข้อมูล seed ไม่ครบ, การ์ดที่มีเป็น Evolution/Royal Prime ล้วนไม่ใช่ normal ธรรมดา) เข้า MVP ของ Club Collection — เหลือ 20 สโมสร

## ดีไซน์

### 1. โครงสร้างระบบ — รวม Achievement + Collection rewards เป็นระบบเดียว

ตัดสินใจร่วมกับ user + ยืนยันโดย Codex: ทั้งสองมี lifecycle เดียวกันเป๊ะ (สะสม progress ถาวร → ปลดล็อก → เคลมรางวัลครั้งเดียว) จึงใช้ backend ตัวเดียว แยกด้วย `category` แทนการสร้าง 2 ระบบคู่ขนาน:

| category | ตัวอย่าง | ใช้ที่ไหน |
|---|---|---|
| `activity` | เปิดซองครบ N, ชนะ PvP ครบ N | tab "กิจกรรม" |
| `club` | ครบทีม Arsenal, ครบทีม Chelsea, ... (20 รายการ) | tab "สะสม" |
| `meta` | Big 6 Complete | tab "สะสม" (แสดงแยกเด่น) |

### 2. Data Model — เก็บแค่สถานะเคลม ไม่เก็บ progress ซ้ำ

**จุดสำคัญที่ Codex แก้ให้ (ต่างจาก MissionProgress โดยตั้งใจ):** ห้ามมี "สอง source of truth" สำหรับตัวเลขเดียวกัน — `progress` ต้องคำนวณสดจากแหล่งข้อมูลจริงเสมอ (lifetime counter บน `User` สำหรับ `activity`, join `UserCard`→`Card`→`Player` สำหรับ `club`/`meta`) ไม่ใช่ column ที่ sync เอง เหมือน mission ที่มี `bumpMission()` เขียนซ้ำ

```prisma
/// สถานะเคลม Achievement — ตัวเดียว generic ใช้ร่วมทุกหมวด (activity/club/meta)
/// progress ไม่เก็บในตารางนี้ — คำนวณสดเสมอจาก User counter (activity) หรือ UserCard join (club/meta)
/// achievementKey ต้องมาจาก ACHIEVEMENT_KEYS ใน src/lib/achievementConfig.ts เท่านั้น
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

เพิ่มใน `User`:
```prisma
totalPacksOpened Int @default(0) // นับเฉพาะ openPack()/openPackWithShards() ที่ user กดเอง — ไม่รวม starter/free pack จาก milestone อื่น (ดู Non-goals)
pvpTotalWins     Int @default(0) // นับชนะสะสมตลอดกาล (ต่างจาก pvpWinStreak ที่รีเซ็ตเมื่อแพ้)

achievementProgress AchievementProgress[]
```

**Query "progress สด" สำหรับแต่ละ category:**
- `activity`: อ่านตรงจาก `user.totalPacksOpened` / `user.pvpTotalWins` เทียบกับ threshold ใน catalog
- `club`: `SELECT COUNT(DISTINCT Card.playerId) FROM UserCard JOIN Card WHERE UserCard.userId = ? AND Card.playerId IN (frozen player id list ของสโมสรนั้น)` เทียบกับ `target` ใน catalog (= ความยาวของ frozen list ตอนสร้าง)
- `meta` (Big 6): ครบเมื่อ progress ของ club achievement ทั้ง 6 สโมสร Big 6 ถึง target ครบทุกตัว (derive จากผลลัพธ์ club query ด้านบน ไม่ผูกกับ `claimed` ของ club เพื่อไม่ผูกกับ "กดเคลมหรือยัง")

### 3. Club Catalog — frozen snapshot ห้าม query สดจาก `COUNT(*)`

**จุดที่ Codex แก้ให้:** ถ้า target ของแต่ละสโมสรคำนวณสดจาก `COUNT(*)` ของ `Player` ตอนนั้น การ import การ์ดเพิ่มในอนาคต (เช่น เพิ่ม Evolution ใหม่ของสโมสรเดิม ที่ทำให้มี Player แถวใหม่ถ้าเป็นนักเตะคนใหม่) จะเปลี่ยนความหมายของ achievement ที่เคลมไปแล้ว หรือทำให้ progress ที่ใกล้ครบถอยหลัง

**แก้:** สร้าง static catalog เก็บ **รายชื่อ `Player.id` ที่ frozen ไว้ตายตัว** ต่อสโมสร ผ่านสคริปต์ query DB ครั้งเดียวตอน implement (pattern เดียวกับ `data/extracted/*.json` ที่ใช้ import การ์ดพิเศษ) เขียนเป็นไฟล์ data:

`data/achievements/club-collection.json` — โครงสร้าง:
```json
{
  "clubs": [
    { "key": "club_arsenal", "clubName": "Arsenal", "playerIds": ["<cuid>", "..."], "size": 31, "tier": "large" },
    { "key": "club_aston_villa", "clubName": "Aston Villa", "playerIds": ["<cuid>", "..."], "size": 23, "tier": "small" }
  ]
}
```

`src/lib/achievementConfig.ts` import ไฟล์นี้แล้วประกอบเป็น catalog entry ต่อสโมสร — ถ้ามีสโมสรใหม่/นักเตะเพิ่มในอนาคตและต้องการอัพเดต target ต้องรัน generate script ใหม่โดยตั้งใจ (deliberate content update เหมือนที่ import script อื่นทำ) ไม่ใช่ drift แบบเงียบๆ

**นับที่ระดับ `Player` ไม่ใช่ `Card`:** มีการ์ดเวอร์ชันไหนของนักเตะคนนั้นก็ได้ (normal/evolution/royalprime) นับว่า "มีนักเตะคนนี้แล้ว" — กันนักเตะที่มีหลายเวอร์ชัน (เช่น Salah normal+evolution) ถูกนับสองครั้งหรือบังคับให้ต้องมีครบทุกเวอร์ชัน

20 สโมสรที่เข้า MVP (ตัด West Ham United/Leicester City/Burnley ที่มี 1 คนออก) แบ่ง 2 tier ตามขนาด:

| tier | สโมสร (จำนวนนักเตะ) |
|---|---|
| **small** (≤25 คน) | Aston Villa(23), Fulham(23), Everton(24), Hull City(25), Coventry City(25), Newcastle United(25), Nottingham Forest(25) |
| **large** (>25 คน) | Ipswich Town(27), Leeds United(28), Sunderland(28), AFC Bournemouth(29), Brentford(29), Crystal Palace(30), Arsenal(31), Brighton & Hove Albion(34), Liverpool(37), Manchester City(39), Chelsea(42), Manchester United(43), Tottenham Hotspur(43) |

Big 6 (Arsenal, Chelsea, Liverpool, Manchester City, Manchester United, Tottenham Hotspur) ทั้งหมดอยู่ใน tier `large` อยู่แล้ว ไม่มี conflict กับสโมสรที่ถูกตัด

### 4. รางวัล

**จุดที่ Codex แก้ให้:** ห้าม scale รางวัลแบบ linear ตามจำนวนนักเตะ (สโมสร 1 คนไม่ใช่ "ฟรีง่าย" — เป็นการ์ดพิเศษล้วนที่ยากกว่าด้วยซ้ำ ถูกตัดออกไปแล้วในข้อ 3) ใช้ 2 tier คงที่แทน:

**Activity (เปิดซองสะสม / ชนะ PvP สะสม)** — โครงสร้างเดียวกันทั้งสองสาย, เทียบตัวเลขกับ level-milestone reward เดิม (`levelReward()`) ให้อยู่ในสเกลใกล้เคียงกัน:

| threshold | reward |
|---|---|
| 5 | Silver 500 |
| 20 | Silver 500 + Standard Pack ฟรี 1 |
| 50 | Gold 5 + Evolution Pack ฟรี 1 |
| 150 | Gold 10 + Royal Prime Pack ฟรี 1 |
| 300 | Gold 20 + Royal Prime Pack ฟรี 1 |

(รวม 5 milestone/สาย × 2 สาย = 10 achievement)

**Club Collection:**

| tier | reward |
|---|---|
| small (≤25 คน) | Silver 1000 + Standard Pack ฟรี 1 |
| large (>25 คน) | Silver 1500 + Gold 5 + Evolution Pack ฟรี 1 |

(20 achievement — 1 ต่อสโมสร)

**Big 6 Complete (meta, ปลดล็อกเมื่อครบทั้ง 6 สโมสร Big 6):**

Silver 2000 + Gold 15 + Royal Prime Pack ฟรี 1

รวมทั้งหมด: 10 (activity) + 20 (club) + 1 (Big6) = **31 achievement**

### 5. Increment counter — ตำแหน่งที่แก้ในโค้ดเดิม

- `User.totalPacksOpened`: increment ใน `openPack()` และ `openPackWithShards()` (`src/lib/packs.ts`) เท่านั้น — **ห้าม**ใส่ใน `finalizeOpen()` หรือ `grantFreePack()` (กันนับซ้อนจาก nested call ตอนแจก pack จาก level-up/mission/login-milestone — ดู Non-goals) ตาม precedent เดียวกับที่ mission system ใช้กับ `bumpMission`
- `User.pvpTotalWins`: increment คู่กับ `pvpWinStreak` ที่จุดเดิมใน `playPvpMatch()` (`src/lib/pvp.ts` ใกล้ line 388/419) — เพิ่มเฉพาะตอนชนะเท่านั้น (ไม่รวม ticket match ที่แพ้ได้ EXP/Silver = 0 อยู่แล้ว แต่ชนะด้วย ticket ยังนับ win ปกติ)

### 6. Claim flow — atomic, reuse ของเดิม

`claimAchievement(userId, achievementKey)`:
1. หา config จาก `ACHIEVEMENTS[achievementKey]` (404 ถ้าไม่มี)
2. `prisma.$transaction`: query progress สดตาม category (ข้อ 2) → ถ้ายังไม่ถึง target → throw `AchievementNotReadyError`
3. `updateMany`/`upsert` แบบ atomic compare-and-set บน `AchievementProgress` (`claimed: false` → `true`, เหมือน `claimMission()` ใน `src/lib/missions.ts`) กันเคลมซ้ำจาก race
4. แจกรางวัลด้วย primitive เดิมทั้งหมด (`addCurrency`, `applyExp`/`levelReward`, `grantFreePack`) ใน tx เดียวกัน — ไม่สร้างฟังก์ชัน grant ใหม่
5. คืนผลลัพธ์ให้ server action ยิง notification

### 7. Notification

เพิ่ม `"ACHIEVEMENT_UNLOCKED"` เข้า `NOTIFICATION_TYPES` (`src/lib/constants.ts:86-93`) แล้วเขียน `notifyAchievementUnlocked()` ใน `src/lib/notifications.ts` ตาม pattern เดียวกับ `notifyMissionClaimed()` — body สรุป silver/gold/pack ที่ได้, `href: "/achievements"`

### 8. UI

หน้าใหม่ `/achievements` (แยกจาก Home ต่างจาก Mission เพราะมี 31 รายการ ยาวเกินจะแปะบน Home) — 2 tab: "กิจกรรม" (activity) / "สะสม" (club + meta) แต่ละรายการแสดง progress bar (`progress/target`) + ปุ่มเคลมที่ disable จนกว่าจะครบ, ใช้ `Reward` component เดิมจาก `DailyClaim.tsx` เหมือน `MissionList.tsx`

Header/bottom-nav อาจต้องเพิ่ม entry point ไปหน้านี้ (พิจารณาใน implementation plan — ดู bottom nav ปัจจุบันที่ Home/Pack/Team/PvP/Profile เต็มแล้ว น่าจะลิงก์จาก Profile page แทนเพิ่ม nav item ใหม่)

## สรุปสิ่งที่ Codex แก้ให้ (ก่อน implement)

1. รวม Achievement + Collection rewards เป็น backend เดียว, แยก UI ด้วย `category` — approved
2. ครบทีม = นับที่ `Player` (มีการ์ดเวอร์ชันไหนก็ได้) ไม่ใช่ `Card`
3. Target ต่อสโมสร frozen เป็น static snapshot (`data/achievements/club-collection.json`) ห้าม live `COUNT(*)`
4. ตัดสโมสร 1-คนออกจาก MVP, เลิก scale รางวัลแบบ linear ตามขนาดทีม ใช้ 2-tier คงที่แทน
5. `AchievementProgress` เก็บแค่ `claimed`/`claimedAt` ไม่เก็บ `progress` ซ้ำ — คำนวณสดเสมอ กัน dual source of truth
6. Migration policy ชัดเจน: `totalPacksOpened`/`pvpTotalWins` เริ่มนับ 0 ตั้งแต่ deploy (ไม่ backfill, เอกสารระบุชัดว่า "ตั้งแต่มีระบบนี้"), ครบทีม backfill ได้ถูกต้องเพราะคำนวณสดจากข้อมูลเดิม
