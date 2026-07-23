# Premier XI — System Reference

เอกสารอ้างอิงโครงสร้างระบบ สร้างจากโค้ดจริงใน repository วันที่ 2026-07-15 อัปเดตล่าสุด 2026-07-22 (PvP เต็ม + Fantasy Premier XI 7A/7B/hub redesign + Bottom nav/My Club/ชื่อทีม redesign ขั้น 11-12) ใช้สำหรับอ่านก่อนแก้ไข/ต่อเติม feature ใด ๆ

---

## 1. ภาพรวมระบบ

Premier XI เป็นเกมสะสมการ์ดนักฟุตบอลพรีเมียร์ลีกแบบ mobile-first โดยใช้:

- **Framework:** Next.js 16.2.10 (App Router) + React 19.2.4
- **Language:** TypeScript 5 (strict mode)
- **Database:** SQLite + Prisma 6.19.3
- **Styling:** Tailwind CSS v4
- **Font:** Geist (via `next/font/google`)
- **Auth:** scrypt password hashing + HMAC-signed session cookie
- **Runtime:** Node.js Server Actions เป็นหลัก

ฟีเจอร์ที่ implement ครบแล้ว (ณ วันที่สร้างเอกสาร):

- สมัคร / เข้าสู่ระบบ / ออกจากระบบ
- Starter Pack (11 ใบ + Silver 300) เปิดครั้งแรกในหน้า `/pack`
- เปิดซอง 3 ประเภท เปิดทีละ **5 ใบ/ครั้ง**: Standard (silver), Evolution (gold, การันตีการ์ด Evolution 1 ใบ), Royal Prime (gold, การันตีการ์ด Royal Prime 1 ใบ) — ไม่มี pity/Premium/Ticket pack แล้ว (ยกเลิกไปตั้งแต่ 2026-07-16)
- Duplicate → shards pool เดียว (รวม evoShards/primeShards เข้า shards แล้วตั้งแต่ 2026-07-24) แลกเปิดซองฟรีได้ (Shard Exchange)
- Launch promotion: login สะสมครบ 15/30 วัน แจก Evolution/Royal Prime pack ฟรีครั้งเดียว, weekly gold trickle, First Deposit Bonus +20%
- คลังการ์ด (`/collection`)
- จัดทีม 11 คน (`/team`) พร้อม formation, chemistry, rating
- เช็คอินรายวัน (`DailyClaim` ในหน้า `/`)
- Notification Center (`/notifications`) + Announcement admin (`/admin/news`)
- Mission รายวัน/รายสัปดาห์ (`MissionList` ในหน้า `/`) — 3 daily + 2 weekly กดรับรางวัลเอง
- PvP (`/pvp`) — matchmaking ผู้เล่น/บอท, simulate สกอร์, RP + 6 tier, season รายเดือน, ฟรี 5 แมตช์/วัน
- Achievement + Collection rewards (`/achievements`) — 31 รายการ (10 activity + 20 club + 1 meta)
- Fantasy Premier XI (`/fantasy` bento hub + subpages) — จัดทีม 15 คน (11 ตัวจริง + 4 สำรอง) ต่อ Gameweek, admin กรอกผลบอล (`/admin/fantasy`) คิดคะแนนอัตโนมัติ + auto-substitution + captain 2x, Weekly leaderboard, TOTW, ตารางแข่ง, ข่าว — ครบ phase 7A/7B, **7C (รางวัลรายเดือน) และ 7D (sync ผลจริงจาก API-Football) ยังไม่ทำ**
- Bottom nav 5 แท็บใหม่ (Home/Store/PvP/Fantasy/My Club) + หน้า My Club hub (`/club`) + ชื่อทีมที่ตั้งเองได้ (`User.teamName`) โชว์แทน username ใน Fantasy leaderboard + Header แสดง Silver/Gold ค้างทุกหน้า

---

## 2. โครงสร้างไฟล์

```
.
├── docs/
│   ├── TASKS.md                 # แผนงานทั้งหมด (checklist)
│   ├── progress.md              # สรุปสถานะ + งานที่ค้าง
│   ├── game-guide.md            # กลไกเกม/ตัวเลข balance (source of truth ของตัวเลข)
│   ├── system-reference.md      # เอกสารฉบับนี้
│   ├── database.dbml            # Schema ที่ gen จาก SQLite จริง (npm run db:dbml)
│   └── superpowers/specs/       # สเปคดีไซน์รายฟีเจอร์ (mission/pvp/achievement/chemistry)
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── import-cards.ts          # Script import การ์ด normal จากรูป + JSON (20 ทีม)
│   ├── import-special-cards.ts  # Script import การ์ด Evolution/Royal Prime (ไม่มีโฟลเดอร์ทีมย่อย)
│   ├── generate-achievement-clubs.ts # Gen club achievement catalog → data/achievements/club-collection.json
│   ├── generate-dbml.ts         # Gen docs/database.dbml จาก SQLite schema จริง
│   ├── seed-qa-admin.ts         # สร้างบัญชี qa_admin (isAdmin, การ์ดครบ, ไม่ถูกลบโดยปุ่ม "เริ่มใหม่") — ดูหัวข้อ 10
│   ├── dev.db                   # SQLite database
│   └── migrations/              # Migration files
├── data/extracted/              # JSON ข้อมูลการ์ด 20 ทีม + evolution.json + royalprime.json
├── data/achievements/           # club-collection.json (catalog achievement รายสโมสร)
├── public/card/normal/          # รูปการ์ด PNG จริง 20 ทีม
├── public/card/evolution/       # รูปการ์ด Evolution 44 ใบ (flat, ไม่มีโฟลเดอร์ทีมย่อย)
├── public/card/royalprime/      # รูปการ์ด Royal Prime 44 ใบ (flat, ไม่มีโฟลเดอร์ทีมย่อย)
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout + AppHeader + BottomNav
│   │   ├── page.tsx             # หน้าหลัก
│   │   ├── globals.css          # Tailwind theme + animations
│   │   ├── login/page.tsx       # เข้าสู่ระบบ
│   │   ├── register/page.tsx    # สมัครสมาชิก
│   │   ├── profile/page.tsx     # โปรไฟล์
│   │   ├── team/page.tsx        # จัดทีม (Squad จริง — คนละระบบกับ Fantasy)
│   │   ├── collection/page.tsx  # คลังการ์ด
│   │   ├── club/page.tsx        # My Club hub — ลิงก์ /team + /collection + ตั้งชื่อทีม
│   │   ├── pack/page.tsx        # เปิดซอง (แท็บ "Store")
│   │   ├── pvp/page.tsx         # PvP
│   │   ├── fantasy/
│   │   │   ├── page.tsx         # Fantasy bento hub (5 การ์ดลิงก์ subpage, read-only preview)
│   │   │   ├── team/page.tsx    # จัดทีม Fantasy (FantasyPitch, จุดเดียวที่เรียก getOrCreateEntry)
│   │   │   ├── fixtures/page.tsx # ตารางแข่ง GW ปัจจุบันเท่านั้น (ไม่มี prev/next)
│   │   │   ├── news/page.tsx    # ข่าว (อ่านอย่างเดียว, แยกจาก /notifications)
│   │   │   ├── leaderboard/page.tsx # Weekly leaderboard ของ GW ล่าสุดที่ SCORED
│   │   │   └── totw/page.tsx    # Team of the Week (คำนวณสด ไม่ persist)
│   │   ├── achievements/page.tsx # Achievement + Collection rewards
│   │   ├── notifications/page.tsx # Notification center
│   │   ├── admin/news/page.tsx  # Admin จัดการข่าว
│   │   ├── admin/fantasy/
│   │   │   ├── page.tsx         # List/สร้าง Gameweek
│   │   │   └── [gameweekId]/page.tsx # เพิ่มแมตช์ + กรอกสถิติผู้เล่น + ปิด Gameweek
│   │   └── actions/             # Server Actions
│   │       ├── auth.ts
│   │       ├── daily.ts
│   │       ├── pack.ts
│   │       ├── squad.ts
│   │       ├── starter.ts
│   │       ├── missions.ts
│   │       ├── pvp.ts
│   │       ├── achievements.ts
│   │       ├── notifications.ts
│   │       ├── club.ts          # setTeamNameAction
│   │       ├── fantasy.ts       # saveEntryAction
│   │       └── fantasyAdmin.ts  # createGameweekAction/upsertMatchAction/upsertPlayerStatAction/closeGameweekAction
│   ├── components/
│   │   ├── AuthForm.tsx
│   │   ├── AppHeader.tsx
│   │   ├── BottomNav.tsx
│   │   ├── DailyClaim.tsx
│   │   ├── MissionList.tsx
│   │   ├── PackShop.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── PvpMatch.tsx
│   │   ├── AchievementList.tsx
│   │   ├── StarterPackModal.tsx
│   │   ├── TeamBuilder.tsx
│   │   ├── TeamNameEditor.tsx
│   │   ├── MarkNotificationsRead.tsx
│   │   ├── FantasyPitch.tsx
│   │   └── FantasyLeaderboard.tsx
│   └── lib/
│       ├── auth.ts              # Session + password hashing
│       ├── cardgen.ts           # Derive tier + generate 6 stats
│       ├── chemistry.ts         # คำนวณ chemistry
│       ├── chemistryConfig.ts   # ค่าคงที่ chemistry
│       ├── clubs.ts             # Map folder → club name
│       ├── constants.ts         # Constants (tier, position, currency, notification type)
│       ├── daily.ts             # Daily login logic
│       ├── economy.ts           # Add/spend currency + EXP/level up
│       ├── formations.ts        # Formation definitions + slot coordinates
│       ├── notifications.ts     # Notification center logic + ข่าว (getNews)
│       ├── packs.ts             # Pack config + open pack RNG + shard exchange
│       ├── prisma.ts            # PrismaClient singleton
│       ├── squad.ts             # Squad CRUD
│       ├── starter.ts           # Starter pack distribution
│       ├── missionConfig.ts     # Catalog มิชชั่น (3 daily + 2 weekly)
│       ├── missionPeriod.ts     # periodKey รายวัน/รายสัปดาห์
│       ├── missions.ts          # Mission progress + claim
│       ├── pvp.ts               # Matchmaking + simulate + RP/tier/season
│       ├── achievementConfig.ts # Catalog achievement 31 รายการ
│       ├── achievements.ts      # Achievement progress (คำนวณสด) + claim
│       ├── fantasyConfig.ts     # Catalog กลาง Fantasy (scoring table/squad quota/reward)
│       ├── fantasyScoring.ts    # Pure scoring engine (ไม่แตะ prisma)
│       ├── fantasy.ts           # Entry CRUD + closeGameweek state machine + leaderboard
│       ├── fantasyAdmin.ts      # Admin service: createGameweek/upsertMatch/upsertPlayerStat
│       ├── fantasyFixtures.ts   # getFixtures(gameweekId)
│       └── fantasyTotw.ts       # getTeamOfTheWeek(gameweekId) — คำนวณสด
├── next.config.ts               # Preview proxy origin allowlist
├── package.json
├── tsconfig.json
└── gdd.md                       # Game Design Document
```

---

## 3. Database Schema

ไฟล์ต้นฉบับ: `prisma/schema.prisma`

> หมายเหตุ: SQLite ไม่รองรับ native enum ค่าต่าง ๆ เช่น tier/position/category/type จึงเก็บเป็น `String` และใช้ constants ใน `src/lib/constants.ts` เป็นตัวกลาง

### 3.1 `User`

ผู้เล่น / บัญชีผู้ใช้ หนึ่งคนต่อหนึ่ง row

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | Primary key |
| `username` | `String` | - | Unique, ใช้ login |
| `teamName` | `String?` | - | ชื่อทีมตั้งเอง — **ไม่ unique**, nullable; โชว์แทน username ใน public context (เช่น Fantasy leaderboard) ผ่าน `displayName = teamName ?? username`; แก้ได้จาก `/club` (`setTeamNameAction`) |
| `phone` | `String` | - | Unique, ใช้สมัคร |
| `passwordHash` | `String` | - | `salt:hash` จาก scrypt |
| `isAdmin` | `Boolean` | `false` | Gate หน้า `/admin/news` |
| `level` | `Int` | `1` | Level ผู้เล่น |
| `exp` | `Int` | `0` | EXP ปัจจุบัน |
| `silver` | `Int` | `0` | สกุลเงิน Silver |
| `gold` | `Int` | `0` | สกุลเงิน Gold |
| `shards` | `Int` | `0` | Shard รวม pool เดียวจากการ์ดซ้ำทุก tier — ใช้แลกเปิดซองฟรีได้ทั้ง Standard/Evolution/Royal Prime (`packTicket`/`evoShards`/`primeShards` ถูกลบออกจาก schema แล้วเมื่อ 2026-07-24 หลังรวม/เลิกใช้) |
| `pityCounter` | `Int` | `0` | **ไม่ได้ใช้แล้ว** หลังยกเลิก Premium pack (เก็บ field ไว้เผื่ออนาคต) |
| `loginStreak` | `Int` | `0` | Streak เช็คอินรายวัน (รีเซ็ตถ้าขาด 1 วัน) — ใช้คำนวณ silver/gold รายวัน |
| `lastClaimDate` | `DateTime?` | - | วันล่าสุดที่เคลม daily |
| `totalLogins` | `Int` | `0` | จำนวนวันที่เคย login รวม (**ไม่รีเซ็ต** แม้ streak ขาด) — ใช้เช็ค login milestone 15/30 วัน |
| `starterClaimed` | `Boolean` | `false` | รับ Starter Pack แล้วหรือยัง |
| `evoMilestoneClaimed` | `Boolean` | `false` | รับ Evolution Pack ฟรีจาก login milestone (15 วัน) แล้วหรือยัง — ครั้งเดียวตลอดไป |
| `primeMilestoneClaimed` | `Boolean` | `false` | รับ Royal Prime Pack ฟรีจาก login milestone (30 วัน) แล้วหรือยัง — ครั้งเดียวตลอดไป |
| `hasDeposited` | `Boolean` | `false` | เติมเงินจริงมาแล้วหรือยัง — กัน First Deposit Bonus ใช้ซ้ำ |
| `lastReadNewsAt` | `DateTime?` | - | ใช้คำนวณ unread news |
| `pvpRP` | `Int` | `0` | Ranking Point ปัจจุบัน — **tier ไม่ store แยก** derive จาก `pvpRP` ผ่าน `tierForRP()` (`src/lib/pvp.ts`) เสมอ |
| `pvpSeasonKey` | `String?` | - | `"YYYY-MM"` แบบ UTC (ดู `seasonKey()`) — `null` = ยังไม่เคยแข่งเลย ใช้ lazy season reset |
| `pvpWinStreak` | `Int` | `0` | Streak ชนะติดต่อกัน (รีเซ็ตเมื่อแพ้) — ใช้คำนวณ EXP bonus |
| `pvpMatchesToday` | `Int` | `0` | จำนวนแมตช์ PvP ที่เล่นไปวันนี้ (รวม ticket match) |
| `pvpMatchesDate` | `DateTime?` | - | วันที่ใช้เทียบ `dayIndex()` (เหมือน `daily.ts`) เพื่อรีเซ็ตโควตารายวัน |
| `totalPacksOpened` | `Int` | `0` | Lifetime counter เปิดซอง — ใช้ progress achievement หมวด `activity`; นับเฉพาะ `openPack()`/`openPackWithShards()` ที่ user กดเอง ไม่นับ starter/ซองฟรี |
| `pvpTotalWins` | `Int` | `0` | Lifetime counter ชนะ PvP สะสม (ต่างจาก `pvpWinStreak` ที่รีเซ็ตเมื่อแพ้) — ใช้ progress achievement |
| `createdAt` | `DateTime` | `now()` | - |
| `lastLoginAt` | `DateTime?` | - | - |

Relations:

- `cards` → `UserCard[]`
- `squad` → `Squad?` (1-to-1)
- `notifications` → `Notification[]`
- `announcements` → `Announcement[]` (as author)
- `missionProgress` → `MissionProgress[]`
- `achievementProgress` → `AchievementProgress[]`
- `fantasyEntries` → `FantasyEntry[]`
- `fantasyScores` → `FantasyGameweekScore[]`
- `fantasyRewards` → `FantasyRewardGrant[]`

### 3.2 `Player`

นักเตะจริง หนึ่งคนมีได้หลายการ์ด/หลายเวอร์ชัน

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `name` | `String` | - | ชื่อนักเตะ |
| `club` | `String` | - | สโมสร |
| `nation` | `String` | - | สัญชาติ |
| `league` | `String` | `"Premier League"` | ลีก |
| `position` | `String` | - | ตำแหน่งหลัก |
| `cards` | `Card[]` | - | Reverse relation |
| `matchStats` | `PlayerMatchStat[]` | - | Reverse relation (Fantasy) |
| `fantasySlots` | `FantasyEntrySlot[]` | - | Reverse relation (Fantasy) |
| `createdAt` | `DateTime` | `now()` | - |

Constraint: `@@unique([name, club])` — stable identity สำหรับ card-import upsert (`prisma/card-import.ts`) กัน reimport สร้าง id ใหม่ทุกครั้ง

### 3.3 `Card`

การ์ดหนึ่งเวอร์ชันของนักเตะ

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `playerId` | `String` | - | FK → Player |
| `tier` | `String` | - | Bronze/Silver/Gold/Elite/Hero/Icon/Event/TOTW/TOTS/Legend — ใช้จริงตอนนี้: Bronze/Silver/Gold (normal), Hero (evolution), Legend (royalprime) |
| `category` | `String` | `"normal"` | `normal` (566 ใบ, OVR 55-90) \| `evolution` (44 ใบ, OVR 90-92) \| `royalprime` (44 ใบ, OVR 92-98) — comment เดิมในสคีมาเขียนว่า `normal \| special` แต่โค้ดจริงใช้ 3 ค่านี้ |
| `position` | `String` | - | ตำแหน่งหลักบนการ์ด |
| `ovr` | `Int` | - | Overall rating |
| `pace` | `Int` | - | - |
| `shooting` | `Int` | - | - |
| `passing` | `Int` | - | - |
| `dribbling` | `Int` | - | - |
| `defending` | `Int` | - | - |
| `physical` | `Int` | - | - |
| `altPositions` | `String?` | - | คั่นด้วย comma เช่น `"LM,ST"` |
| `foot` | `String?` | - | `"R"` \| `"L"` |
| `skillMoves` | `Int?` | - | 1-5 |
| `weakFoot` | `Int?` | - | 1-5 |
| `indexRating` | `Float?` | - | เลขในกรอบสีเขียวมุมล่างขวา |
| `imageUrl` | `String?` | - | Path รูปการ์ด |
| `isStarter` | `Boolean` | `false` | ใช้ใน Starter Pack ได้หรือไม่ |
| `owners` | `UserCard[]` | - | Reverse relation |
| `squadSlots` | `SquadSlot[]` | - | Reverse relation |
| `fantasySlots` | `FantasyEntrySlot[]` | - | Reverse relation (Fantasy) |
| `createdAt` | `DateTime` | `now()` | - |

Constraint: `@@unique([playerId, category])` — stable identity สำหรับ card-import upsert (`prisma/card-import.ts`) · Indexes: `@@index([tier])`, `@@index([category])`

### 3.4 `UserCard`

ความเป็นเจ้าของการ์ดของผู้เล่น ถือได้ 1 ใบต่อการ์ด

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | `String` | PK |
| `userId` | `String` | FK → User |
| `cardId` | `String` | FK → Card |
| `acquiredAt` | `DateTime` | `now()` |

Constraints: `@@unique([userId, cardId])`, `@@index([userId])`

### 3.5 `Squad`

ทีมของผู้เล่น หนึ่งทีมต่อผู้ใช้

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `userId` | `String` | - | Unique, FK → User |
| `formation` | `String` | `"4-3-3"` | Formation ปัจจุบัน |
| `slots` | `SquadSlot[]` | - | 11 ช่อง |
| `cachedRating` | `Int` | `0` | เพิ่มโดย migration PvP (`20260718082658_add_pvp_fields`) — **แค่ query filter หา matchmaking เท่านั้น** ไม่ใช่ source of truth ของแมตช์จริง (`playPvpMatch` คำนวณ `computeChemistry()` สดเสมอ) อัปเดตผ่าน `refreshCachedRating()` ทุกครั้งที่ `setFormation`/`assignSlot` |
| `updatedAt` | `DateTime` | `@updatedAt` | - |

Index: `@@index([cachedRating])`

### 3.6 `SquadSlot`

ช่องในทีม 0-10

| Field | Type | หมายเหตุ |
|---|---|---|
| `id` | `String` | PK |
| `squadId` | `String` | FK → Squad |
| `index` | `Int` | 0-10 |
| `cardId` | `String?` | FK → Card, nullable |
| `card` | `Card?` | Relation |

Constraints: `@@unique([squadId, index])`

### 3.7 `Notification`

การแจ้งเตือนส่วนตัวของผู้เล่น

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `userId` | `String` | - | FK → User |
| `type` | `String` | - | ดู `NOTIFICATION_TYPES` |
| `title` | `String` | - | - |
| `body` | `String?` | - | - |
| `href` | `String?` | - | Deep link |
| `idempotencyKey` | `String?` | - | **Unique.** เพิ่มโดย Fantasy migration (`20260722060000_fantasy_notification_idempotency`) — คีย์กันสร้างซ้ำสำหรับ noti ที่ผูกกับ resumable operation เช่น Fantasy scoring ที่ resume ได้หลัง crash รูปแบบ `"fantasy:score:<gameweekId>:<userId>"` — `null` สำหรับ noti ทั่วไปที่ยังสร้างซ้ำได้ปกติ (pack/PvP/mission ฯลฯ) ดู `createNotificationOnce()` ใน `src/lib/notifications.ts` |
| `read` | `Boolean` | `false` | - |
| `createdAt` | `DateTime` | `now()` | - |

Indexes: `@@index([userId, read])`, `@@index([userId, createdAt])`

### 3.8 `Announcement`

ข่าว/ประกาศ broadcast จาก admin

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `title` | `String` | - | - |
| `body` | `String` | - | - |
| `published` | `Boolean` | `true` | - |
| `createdAt` | `DateTime` | `now()` | - |
| `authorId` | `String?` | - | FK → User |
| `author` | `User?` | Relation `AnnouncementAuthor` |

Index: `@@index([published, createdAt])`

### 3.9 `MissionProgress`

ความคืบหน้ามิชชั่นรายรอบ — ตารางเดียว generic ใช้ร่วมทุกมิชชั่น (catalog อยู่ในโค้ด ไม่ใช่ DB) เพิ่มมิชชั่นใหม่จึงไม่ต้อง migrate

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `userId` | `String` | - | FK → User (cascade) |
| `missionKey` | `String` | - | จาก `MISSION_KEYS` เท่านั้น |
| `periodKey` | `String` | - | daily = epoch-day / weekly = epoch-week (ดู `missionPeriod.ts`) |
| `progress` | `Int` | `0` | - |
| `claimed` | `Boolean` | `false` | - |
| `updatedAt` | `DateTime` | `@updatedAt` | - |

Constraints: `@@unique([userId, missionKey, periodKey])` · Index: `@@index([userId, periodKey])`

> โตแบบ unbounded (1 แถว/มิชชั่น/รอบ/ผู้เล่น) — ยังไม่มี pruning ดู `docs/progress.md` หัวข้อหนี้ทางเทคนิค

### 3.10 `AchievementProgress`

สถานะ **เคลม** achievement — ตัวเดียว generic ใช้ร่วมทุกหมวด (activity/club/meta)

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `userId` | `String` | - | FK → User (cascade) |
| `achievementKey` | `String` | - | จาก `ACHIEVEMENTS` เท่านั้น |
| `claimed` | `Boolean` | `false` | - |
| `claimedAt` | `DateTime?` | - | - |

Constraints: `@@unique([userId, achievementKey])` · Index: `@@index([userId])`

> **ต่างจาก `MissionProgress` 2 จุด:** (1) ไม่เก็บ `progress` — คำนวณสดเสมอจาก `User` counter (activity) หรือ join `UserCard` (club/meta) (2) row ถูกสร้างก็ต่อเมื่อ **เคลมสำเร็จ** เท่านั้น ไม่มี progress row สร้างล่วงหน้า — `@@unique` จึงทำหน้าที่กันเคลมซ้ำแบบ atomic (ชน P2002)

### 3.11 `Gameweek`

รอบการแข่งขัน Fantasy (1 สัปดาห์) — เพิ่มโดย `20260720170255_add_fantasy_core`

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `number` | `Int` | - | Unique, เลข GW |
| `deadline` | `DateTime` | - | เวลาปิดรับทีม — พ้นเวลานี้ล็อกทีมทุกคนทันที |
| `monthKey` | `String` | - | `"YYYY-MM"` UTC — **freeze จาก `deadline` ตอนสร้าง** (ห้าม derive จากวันที่ปิดทีหลัง) ใช้จัดกลุ่ม monthly reward (7C) |
| `status` | `String` | `"UPCOMING"` | `UPCOMING \| LOCKED \| SCORING \| SCORED` — state machine ดู `closeGameweek()` |
| `scoringStartedAt` | `DateTime?` | - | Fencing token ของ lease ตอนกำลังคิดคะแนน (กัน resume/takeover ซ้อนกัน) |
| `scoredAt` | `DateTime?` | - | เวลาที่ปิดคิดคะแนนสำเร็จ |
| `createdAt` | `DateTime` | `now()` | - |

Relations: `matches` → `Match[]`, `entries` → `FantasyEntry[]`, `scores` → `FantasyGameweekScore[]` · Indexes: `@@index([status])`, `@@index([monthKey])`

### 3.12 `Match`

แมตช์จริงใน Gameweek — admin กรอกที่ `/admin/fantasy/[gameweekId]`

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `gameweekId` | `String` | - | FK → Gameweek (cascade) |
| `homeClub` / `awayClub` | `String` | - | ชื่อสโมสร (dropdown จาก `PREMIER_LEAGUE_CLUBS` ตอนกรอก แต่ column ไม่บังคับ allowlist) |
| `homeScore` / `awayScore` | `Int?` | - | `null` = ยังไม่มีผล/POSTPONED/CANCELLED |
| `kickoffAt` | `DateTime?` | - | - |
| `status` | `String` | `"SCHEDULED"` | `SCHEDULED \| PLAYED \| POSTPONED \| CANCELLED` |
| `providerFixtureId` | `String?` | - | Unique — จาก API-Football กัน sync ซ้ำ (**Phase 7D ยังไม่ implement**) |
| `stats` | `PlayerMatchStat[]` | - | Reverse relation |

Index: `@@index([gameweekId])`

### 3.13 `PlayerMatchStat`

สถิติรายนักเตะต่อแมตช์ — admin กรอก, ใช้คิดคะแนน Fantasy + TOTW

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `matchId` | `String` | - | FK → Match (cascade) |
| `playerId` | `String` | - | FK → Player (cascade) |
| `clubSide` | `String` | - | `HOME \| AWAY` — **freeze ตอนกรอก** ไม่ derive จาก `Player.club` สด |
| `positionGroup` | `String` | - | `GK \| DEF \| MID \| ATT` — **freeze ตอนกรอกจาก `Player.position` ขณะนั้น** (เหตุผลเดียวกับ `clubSide`) เพิ่มโดย migration `20260722123732_add_playermatchstat_position_group` (Codex review รอบ 1 ของขั้น 12) กัน re-import การ์ด (`prisma/card-import.ts` แก้ `Player.position` ได้) เปลี่ยนกลุ่มตำแหน่งย้อนหลังของสถิติที่กรอกไปแล้ว (เช่น TOTW/scoring ที่อ่านค่านี้ ห้าม derive จาก `Player.position` สดตอน query) — นักเตะที่มี 2 แมตช์ใน GW เดียวกัน (Double Gameweek) ใช้ `positionGroup` เดิมที่เคย freeze ไว้ในสัปดาห์นั้นซ้ำเสมอ (`upsertPlayerStat` เช็คสถิติที่มีอยู่ก่อน) |
| `minutes` / `goals` / `assists` / `yellow` / `red` / `ownGoals` | `Int` | `0` | สถิติดิบ ใช้ผ่าน `scorePlayer()` (`src/lib/fantasyScoring.ts`) |

Constraint: `@@unique([matchId, playerId])` · Index: `@@index([playerId])`

### 3.14 `FantasyEntry`

ทีม Fantasy ของ user สำหรับ Gameweek หนึ่งๆ — immutable หลัง deadline

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `userId` | `String` | - | FK → User (cascade) |
| `gameweekId` | `String` | - | FK → Gameweek (cascade) |
| `formation` | `String` | - | - |
| `submittedAt` | `DateTime?` | - | `null` = clone อัตโนมัติจาก entry ก่อนหน้า ยังไม่เคยกด save เอง → **ไม่มีสิทธิ์รับรางวัล/ไม่เข้า leaderboard** (`runScoring` กรอง draft ทิ้งก่อนคำนวณ) |
| `updatedAt` | `DateTime` | `@updatedAt` | - |
| `slots` | `FantasyEntrySlot[]` | - | Reverse relation |

Constraint: `@@unique([userId, gameweekId])` · Index: `@@index([gameweekId])`

### 3.15 `FantasyEntrySlot`

ช่องในทีม Fantasy (0-10 = ตัวจริง, 11-14 = สำรอง) — snapshot freeze ไว้คิดคะแนนย้อนหลัง

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `entryId` | `String` | - | FK → FantasyEntry (cascade) |
| `cardId` | `String` | - | FK → Card — **`onDelete: Restrict`** (ไม่ Cascade) เปลี่ยนโดย migration `20260721075821_fantasy_slot_restrict_delete` กันลบ Card ต้นทางแล้ว slot ที่ส่งไปแล้วหายเงียบๆ |
| `playerId` | `String` | - | FK → Player — **`onDelete: Restrict`** เหมือนกัน — freeze ใช้ join กับ `PlayerMatchStat` ตอนคิดคะแนน |
| `fantasyPositionGroup` | `String` | - | `GK \| DEF \| MID \| ATT` — freeze ตอน save ห้าม derive สด |
| `slotIndex` | `Int` | - | 0-10 ตัวจริง, 11-14 สำรอง |
| `isStarter` | `Boolean` | - | - |
| `benchPriority` | `Int?` | - | 1-4 สำหรับตัวสำรองเท่านั้น |
| `isCaptain` / `isViceCaptain` | `Boolean` | `false` | - |

Constraints: `@@unique([entryId, slotIndex])`, `@@unique([entryId, cardId])` · Index: `@@index([playerId])`

### 3.16 `FantasyGameweekScore`

คะแนนที่คำนวณแล้ว + อันดับ ต่อ user ต่อ Gameweek — freeze ตอน `closeGameweek`, ไม่คำนวณสด

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `userId` | `String` | - | FK → User (cascade) |
| `gameweekId` | `String` | - | FK → Gameweek (cascade) |
| `points` | `Int` | - | - |
| `rank` | `Int?` | - | Competition ranking (1,2,2,4) |
| `rewardTier` | `String?` | - | key จาก `WEEKLY_REWARDS` ถ้าเข้าเกณฑ์รับรางวัล |
| `createdAt` | `DateTime` | `now()` | - |

Constraint: `@@unique([userId, gameweekId])` · Index: `@@index([gameweekId, points])`

### 3.17 `FantasyRewardGrant`

Ledger การแจกรางวัล — unique กันแจกซ้ำตอน retry/resume

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `userId` | `String` | - | FK → User (cascade) |
| `periodType` | `String` | - | `WEEKLY \| MONTHLY` |
| `periodKey` | `String` | - | weekly: `gameweekId` / monthly: `"YYYY-MM"` |
| `rewardType` | `String` | - | `SILVER \| GOLD \| PACK` |
| `amount` | `Int?` | - | - |
| `packId` | `String?` | - | - |
| `grantedAt` | `DateTime` | `now()` | - |

Constraint: `@@unique([userId, periodType, periodKey, rewardType])` — จุดนี้เองที่ทำให้ `grantOnce()` เป็น atomic idempotent · Index: `@@index([periodType, periodKey])`

### 3.18 `FantasySettlement`

Global claim record ของ monthly settlement — **มีอยู่ในสคีมาแล้วแต่ยังไม่มีโค้ดฝั่งไหนอ่าน/เขียนตารางนี้เลย รอ Phase 7C**

| Field | Type | Default | หมายเหตุ |
|---|---|---|---|
| `id` | `String` | `cuid()` | PK |
| `periodType` | `String` | - | - |
| `periodKey` | `String` | - | - |
| `status` | `String` | `"PENDING"` | `PENDING \| PROCESSING \| COMPLETED` |
| `startedAt` / `completedAt` | `DateTime?` | - | - |

Constraint: `@@unique([periodType, periodKey])`

---

## 4. Routes / Pages

| Route | File | ประเภท | Login required | Admin only | Server Actions ที่ใช้ |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Page | No | No | `devLoginAction`, `resetTestUserAction`, `claimDailyAction`, `claimMissionAction` |
| `/login` | `src/app/login/page.tsx` | Page | Redirect ถ้า login | No | `loginAction`, `devLoginAction`, `resetTestUserAction` |
| `/register` | `src/app/register/page.tsx` | Page | Redirect ถ้า login | No | `registerAction` |
| `/profile` | `src/app/profile/page.tsx` | Page | Yes | No | `logoutAction` |
| `/team` | `src/app/team/page.tsx` | Page | Yes (redirect `/login`) | No | `setFormationAction`, `assignSlotAction` (ผ่าน `TeamBuilder`) |
| `/collection` | `src/app/collection/page.tsx` | Page | Yes | No | - |
| `/club` | `src/app/club/page.tsx` | Page | Yes (redirect `/login`) | No | `setTeamNameAction` (ผ่าน `TeamNameEditor`) |
| `/pack` | `src/app/pack/page.tsx` | Page | Yes | No | - |
| `/pvp` | `src/app/pvp/page.tsx` | Page | Yes (redirect `/login`) | No | `playPvpMatchAction` |
| `/fantasy` | `src/app/fantasy/page.tsx` | Page | Yes (redirect `/login`) | No | - (bento hub, read-only preview เท่านั้น — ห้ามเรียก `getOrCreateEntry`/mutation ที่นี่) |
| `/fantasy/team` | `src/app/fantasy/team/page.tsx` | Page | Yes (redirect `/login`) | No | `saveEntryAction` (ผ่าน `FantasyPitch`) |
| `/fantasy/fixtures` | `src/app/fantasy/fixtures/page.tsx` | Page | Yes (redirect `/login`) | No | - |
| `/fantasy/news` | `src/app/fantasy/news/page.tsx` | Page | Yes (redirect `/login`) | No | - |
| `/fantasy/leaderboard` | `src/app/fantasy/leaderboard/page.tsx` | Page | Yes (redirect `/login`) | No | - |
| `/fantasy/totw` | `src/app/fantasy/totw/page.tsx` | Page | Yes (redirect `/login`) | No | - |
| `/achievements` | `src/app/achievements/page.tsx` | Page | Yes (redirect `/login`) | No | `claimAchievementAction` |
| `/notifications` | `src/app/notifications/page.tsx` | Page | Yes | No | `markNotificationsReadAction` (ผ่าน `MarkNotificationsRead`, mount effect) |
| `/admin/news` | `src/app/admin/news/page.tsx` | Page | Yes | Yes | `createAnnouncementAction`, `toggleAnnouncementAction`, `deleteAnnouncementAction` |
| `/admin/fantasy` | `src/app/admin/fantasy/page.tsx` | Page | Yes (redirect `/login`) | Yes (redirect `/`) | `createGameweekAction` |
| `/admin/fantasy/[gameweekId]` | `src/app/admin/fantasy/[gameweekId]/page.tsx` | Page | Yes (redirect `/login`) | Yes (redirect `/`) | `upsertMatchAction`, `upsertPlayerStatAction`, `closeGameweekAction` |

หมายเหตุ:

- หน้า `/team` ตอนนี้ redirect ไป `/login` ถ้าไม่ login แล้ว (ต่างจากเอกสารฉบับก่อนหน้า) — ตรวจโค้ดจริงพบ `getSessionUserId()` + `redirect("/login")` ตั้งแต่ต้นฟังก์ชัน
- `/fantasy` (hub) กับ `/fantasy/team` (จัดทีมจริง) เป็นคนละหน้ากันตั้งแต่ขั้น 12 — **`/fantasy` ไม่ใช่หน้าจัดทีมอีกต่อไป** เป็นแค่ bento hub ลิงก์ไป subpage ทั้ง 5 เท่านั้น `getOrCreateEntry` (มี side-effect เขียน draft entry ลง DB) เรียกได้จาก `/fantasy/team` เพียงจุดเดียว หน้า hub ใช้ `prisma.fantasyEntry.findUnique` read-only แทน

---

## 5. Server Actions

ทั้งหมดอยู่ใน `src/app/actions/`

### 5.1 `src/app/actions/auth.ts`

Directive: `"use server"`

| Export | Signature | บทบาท |
|---|---|---|
| `AuthState` | `{ error?: string } \| undefined` | Type สำหรับ `useActionState` |
| `registerAction` | `(_prev, formData) => Promise<AuthState>` | สมัครสมาชิก ตั้ง session แล้ว redirect `/` |
| `loginAction` | `(_prev, formData) => Promise<AuthState>` | เข้าสู่ระบบ ตั้ง session แล้ว redirect `/` |
| `logoutAction` | `() => Promise<void>` | ลบ session cookie, redirect `/login` |
| `devLoginAction` | `() => Promise<void>` | **TEMP** login บัญชี test/test1234 |
| `resetTestUserAction` | `() => Promise<void>` | **TEMP** ลบบัญชี test แล้วสร้างใหม่ |

Validation rules:

- username: `/^[a-zA-Z0-9_]{3,20}$/`
- phone: `/^0\d{8,9}$/` (เบอร์ไทย 10 หลัก)
- password: ยาวอย่างน้อย 6 ตัว

### 5.2 `src/app/actions/daily.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `claimDailyAction` | `() => Promise<ClaimResult>` | เคลมรางวัลรายวัน, revalidate `/`, สร้าง notification (รวม milestone notification ถ้าได้ Evolution/Royal Prime pack ฟรี) |

### 5.3 `src/app/actions/pack.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `OpenPackResponse` | `{ ok: true; result: OpenResult } \| { ok: false; error: string }` | `OpenResult.cards` เป็น array 5 ใบ |
| `openPackAction` | `(packId: string) => Promise<OpenPackResponse>` | เปิดซองจ่าย currency, สร้าง notification `PACK_OPENED` (สรุปใบเด่น+จำนวนซ้ำ) และ `LEVEL_UP` ถ้าเลเวลอัพ |
| `openPackWithShardsAction` | `(exchangeId: string) => Promise<OpenPackResponse>` | แลก shard เปิดซองฟรี (`SHARD_EXCHANGE`) |

### 5.4 `src/app/actions/squad.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `SquadActionResult` | `{ ok: boolean; error?: string }` | - |
| `setFormationAction` | `(formation: string) => Promise<SquadActionResult>` | เปลี่ยน formation |
| `assignSlotAction` | `(index: number, cardId: string \| null) => Promise<SquadActionResult>` | ใส่/ถอดการ์ดในช่อง |

### 5.5 `src/app/actions/starter.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `OpenStarterResponse` | `{ ok: true; cards: StarterCard[] } \| { ok: false; error: string }` | - |
| `openStarterPackAction` | `() => Promise<OpenStarterResponse>` | เปิด Starter Pack ครั้งแรก |

### 5.6 `src/app/actions/notifications.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `markNotificationsReadAction` | `(cutoffIso: string) => Promise<void>` | เรียกจาก `MarkNotificationsRead.tsx` ตอนเปิด `/notifications` — mark ทุก noti+ข่าวที่ `createdAt <= cutoff` ว่าอ่านแล้ว แล้ว `revalidatePath("/", "layout")` (ต้องเป็น Server Action ไม่ใช่เรียกตรงจาก render ไม่งั้น unread badge ที่ header จาก root layout จะไม่ถูกสั่ง refresh) `cutoffIso` capture จาก page.tsx **ก่อน**หน้าโหลด snapshot กันรายการที่เพิ่งถูกสร้างระหว่างเปิดหน้าโดนนับว่าอ่านแล้วทั้งที่ไม่เคยเห็น |
| `createAnnouncementAction` | `(formData: FormData) => Promise<void>` | Admin สร้างข่าว |
| `toggleAnnouncementAction` | `(formData: FormData) => Promise<void>` | Admin toggle published |
| `deleteAnnouncementAction` | `(formData: FormData) => Promise<void>` | Admin ลบข่าว |

3 ตัวหลังตรวจสอบ `isAdmin` ผ่าน `requireAdmin()` (คืน `null` เงียบๆ ถ้าไม่ใช่ admin ไม่ throw/redirect)

### 5.7 `src/app/actions/missions.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `claimMissionAction` | `(missionKey: string) => Promise<ClaimMissionResult>` | เคลมรางวัลมิชชั่น, สร้าง notification `MISSION_CLAIMED` + `LEVEL_UP` ถ้าเลเวลอัพ |

### 5.8 `src/app/actions/pvp.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `playPvpMatchAction` | `() => Promise<PvpMatchResult>` | เล่น PvP 1 แมตช์, สร้าง notification `PVP_MATCH` / season end / `LEVEL_UP` |

> ไม่มีพารามิเตอร์ `useTicket` — `isTicketMatch` derive ฝั่ง server จาก `pvpMatchesToday` เสมอ ไม่รับ input จาก client

### 5.9 `src/app/actions/achievements.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `claimAchievementAction` | `(achievementKey: string) => Promise<ClaimAchievementResult>` | เคลมรางวัล achievement, สร้าง notification `ACHIEVEMENT_UNLOCKED` + `LEVEL_UP` ถ้าเลเวลอัพ |

### 5.10 `src/app/actions/club.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `ClubActionResult` | `{ ok: boolean; error?: string }` | - |
| `setTeamNameAction` | `(name: string) => Promise<ClubActionResult>` | ตั้ง/แก้/เคลียร์ `User.teamName` — validate `/^[\p{L}\p{M}\p{N} ]{2,20}$/u` (ไทย/อังกฤษ/ตัวเลข/เว้นวรรค 2-20 ตัวอักษร, ต้องมี `\p{M}` กันสระ/วรรณยุกต์ไทยไม่ผ่าน) `normalize("NFC")` + `trim()` ก่อนเช็ค ค่าว่าง = เคลียร์กลับเป็น `null`; `revalidatePath("/club")` + `revalidatePath("/fantasy")` |

### 5.11 `src/app/actions/fantasy.ts`

| Export | Signature | บทบาท |
|---|---|---|
| `FantasyActionResult` | `{ ok: boolean; error?: string }` | - |
| `saveEntryAction` | `(gameweekId: string, formation: string, lineup: LineupInput[]) => Promise<FantasyActionResult>` | บันทึกทีม Fantasy ทั้งทีม (`saveEntry()` ใน `src/lib/fantasy.ts`) แล้ว `revalidatePath("/fantasy")` |

### 5.12 `src/app/actions/fantasyAdmin.ts`

Directive: `"use server"` — ทุกฟังก์ชัน `await requireAdmin()` ก่อนเสมอ (redirect `/` ถ้าไม่ใช่ admin) รับ `FormData` แล้ว redirect กลับพร้อม `?error=` ผ่าน `errorRedirect()` ถ้าล้มเหลว (ไม่ throw ให้ error boundary จับ)

| Export | Signature | บทบาท |
|---|---|---|
| `createGameweekAction` | `(formData: FormData) => Promise<void>` | สร้าง Gameweek ใหม่ (`number` + `deadline`) แล้ว redirect ไปหน้า detail ของ GW ที่สร้าง |
| `upsertMatchAction` | `(formData: FormData) => Promise<void>` | สร้าง/แก้แมตช์ (ไม่มี `matchId` = สร้างใหม่) |
| `upsertPlayerStatAction` | `(formData: FormData) => Promise<void>` | บันทึกสถิตินักเตะ 1 คนต่อ 1 แมตช์ (นาที/ประตู/แอสซิสต์/ใบเหลือง/ใบแดง/OG) |
| `closeGameweekAction` | `(formData: FormData) => Promise<void>` | ปิด Gameweek → คิดคะแนน (`closeGameweek()`) — เรียกซ้ำได้ปลอดภัยถ้าค้างกลางทาง (ปุ่ม "ลองปิดอีกครั้ง") |

---

## 6. Components

### 6.1 `src/components/AuthForm.tsx`

- Type: Client component (`"use client"`)
- Props: `{ mode: "login" | "register"; action: (prev, formData) => Promise<AuthState> }`
- Hook: `useActionState<AuthState, FormData>`
- แสดงฟอร์ม username / phone / password ตาม mode

### 6.2 `src/components/AppHeader.tsx` — เขียนใหม่ขั้น 11 (currency ค้าง + ไอคอนโปรไฟล์ แทน logout)

- Type: Server component
- Props: `{ unread: number; silver: number; gold: number }` — `layout.tsx` (root) query wallet แล้วส่งเข้ามา
- แสดงโลโก้ซ้าย, Silver/Gold ค้างขวาบน, กระดิ่งแจ้งเตือนพร้อม badge (ไปหน้า `/notifications`), ไอคอนโปรไฟล์ (ไปหน้า `/profile`)
- **ไม่มีปุ่ม logout แล้ว** — ย้าย logout ไปอยู่แค่ในหน้า `/profile` เท่านั้น

### 6.3 `src/components/BottomNav.tsx` — เขียนใหม่ขั้น 11 (5 แท็บใหม่)

- Type: Client component
- แถบนำทาง 5 ปุ่ม: หน้าหลัก (`/`), Store (`/pack`), PvP (`/pvp`), Fantasy (`/fantasy`), My Club (`/club`)
- Highlight ตาม `usePathname` — แท็บ "My Club" ครอบ 3 path พร้อมกัน (`matches: ["/club", "/team", "/collection"]`), แท็บ Fantasy ครอบ `/fantasy/*` ทุก subpath โดย default (ไม่ตั้ง `matches` = ใช้ `pathname.startsWith(item.href)`)
- **ตัดแท็บ "โปรไฟล์" ออกจาก bottom nav ทั้งหมด** (ย้ายไปเป็นไอคอนที่ header แทน — ดู 6.2), **ตัดแท็บ "จัดทีม" แยกออก** (รวมเข้า My Club hub แทน)

### 6.4 `src/components/DailyClaim.tsx`

- Type: Client component
- Props: `{ canClaim: boolean; streak: number; nextReward: DailyReward; totalLogins: number }`
- เรียก `claimDailyAction`
- แสดง preview "login สะสมอีกกี่วันจะได้ Evolution/Royal Prime Pack ฟรี" (`nextMilestone()` helper) + ผลลัพธ์ milestone ตอนได้รับ

### 6.5 `src/components/PackShop.tsx`

- Type: Client component
- State: phase, reveal (`{cards, isStarter}`), error
- เรียก `openPackAction`, `openPackWithShardsAction`, `openStarterPackAction`
- แสดง overlay reveal แบบ grid เดียวกันทั้ง Starter Pack (11 ใบ) และซองปกติ (5 ใบ) — badge เด่นบนใบที่ `isSpecial=true`, ข้อความ "ซ้ำ +N" บนใบซ้ำ
- ปุ่มซื้อปกติ + ปุ่ม "แลก N Shard" แยกต่างหากถ้า pack นั้นมี shard exchange

### 6.6 `src/components/PlayerCard.tsx`

- Type: Server component
- Props: `{ imageUrl?: string \| null; name: string; ovr: number; position: string; className?: string }`
- Render รูปการ์ดด้วย `encodeURI(imageUrl)` หรือ fallback placeholder

### 6.7 `src/components/StarterPackModal.tsx`

- Type: Client component
- ไม่มี props
- Modal แจ้งว่ามี Starter Pack ฟรี กดแล้ว push ไป `/pack`

### 6.8 `src/components/TeamBuilder.tsx`

- Type: Client component
- Props หลัก: `{ formation; formations: string[]; slots: Slot[]; ownedCards: OwnedCard[]; rating; teamChem; filled; fullUnity }` (เพิ่ม `fullUnity` หลังฟีเจอร์ Full Unity rating bonus)
- เรียก `setFormationAction`, `assignSlotAction`
- Import จาก lib: `POSITION_GROUP`, `Position`, `MAX_TEAM_CHEM`
- แสดงสนาม, เปลี่ยน formation, เปิด bottom sheet เลือกการ์ด

### 6.9 `src/components/MissionList.tsx`

- Type: Client component
- Props: `{ missions: MissionStatus[] }`
- เรียก `claimMissionAction`
- แสดงในหน้า `/` — progress bar ต่อมิชชั่น + ปุ่มรับรางวัล (เปิดเมื่อ `progress >= target` และยังไม่ `claimed`)

### 6.10 `src/components/PvpMatch.tsx`

- Type: Client component
- Props: `{ status: PvpStatus }`
- เรียก `playPvpMatchAction`
- แสดง RP/tier ปัจจุบัน, โควตาแมตช์ที่เหลือวันนี้, ปุ่มแข่ง (เป็น ticket match อัตโนมัติเมื่อโควตาฟรีหมด) แล้ว render สกอร์ + goal events + RP ที่ได้/เสีย

### 6.11 `src/components/AchievementList.tsx`

- Type: Client component
- Props: `{ achievements: AchievementStatus[] }`
- State: `Tab = "activity" | "collection"` (แท็บ collection รวม category `club` + `meta`)
- เรียก `claimAchievementAction` — แสดง chip รางวัล Silver/Gold/ซองฟรี ต่อรายการ

### 6.12 `src/components/TeamNameEditor.tsx`

- Type: Client component
- Props: `{ initialName: string | null }`
- State: `editing`/`value`/`pending`/`error` — โหมดแสดงผลอย่างเดียว vs. โหมดแก้ไข (input + ปุ่มบันทึก/ยกเลิก)
- เรียก `setTeamNameAction` แล้ว `router.refresh()` ถ้าสำเร็จ — ใช้ในหน้า `/club`

### 6.13 `src/components/MarkNotificationsRead.tsx`

- Type: Client component, **ไม่ render อะไร** (คืน `null` เสมอ)
- Props: `{ cutoff: string }`
- `useEffect` เรียก `markNotificationsReadAction(cutoff)` ครั้งเดียวตอน mount — ใช้ trigger mark-as-read + revalidate unread badge ที่ header โดยไม่ต้องผูกกับ UI ใดๆ

### 6.14 `src/components/FantasyPitch.tsx`

- Type: Client component
- Props หลัก: `{ gameweekId; gameweekNumber; deadline; locked; formation; formations: string[]; starters: StarterSlot[]; bench: BenchSlot[]; ownedCards: OwnedCard[] }`
- State: `slotCard` (map slotIndex→cardId), `captainSlot`/`viceSlot`, `pickerSlot` (bottom sheet เลือกผู้เล่น), `pending`/`error`
- สลับ formation ฝั่ง client จะเคลียร์ตัวจริงทั้งหมด (กันตำแหน่ง/กลุ่มค้างผิดช่องเมื่อ layout เปลี่ยน) — ตัวสำรอง (4 ช่อง) ไม่ถูกเคลม
- Bottom sheet เลือกผู้เล่นกรองด้วย `POSITION_GROUP` ให้ตรงกลุ่มของ slot, disable การ์ดที่ผู้เล่นคนเดียวกันถูกใช้ไปแล้วช่องอื่น (`usedPlayerIds`), ปุ่มตั้งกัปตัน/รองกัปตัน (เฉพาะตัวจริง)
- เรียก `saveEntryAction` แล้ว `router.refresh()` — ถ้า `locked` (พ้น deadline) ซ่อนปุ่มบันทึก/ปิด interaction ทั้งหมด

### 6.15 `src/components/FantasyLeaderboard.tsx`

- Type: Server component
- Props: `{ gameweekNumber; rows: LeaderboardRow[]; myRow: LeaderboardRow | null; myUserId: string }`
- Render list พร้อม rank/`displayName`/points/`rewardTier` badge — highlight แถวของตัวเอง; ถ้าตัวเองไม่อยู่ใน `rows` (นอก `limit`) แสดง sticky row แยกด้านล่างจาก `myRow`

---

## 7. Lib / Services

### 7.1 `src/lib/auth.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `hashPassword` | `(password: string): string` | scrypt + salt → `"salt:hash"` |
| `verifyPassword` | `(password: string, stored: string): boolean` | แยก salt/hash แล้ว `timingSafeEqual` |
| `createSession` | `async (userId: string): Promise<void>` | ตั้ง cookie `px_session` (httpOnly, sameSite lax, secure ใน prod, maxAge 30 วัน) |
| `destroySession` | `async (): Promise<void>` | ลบ cookie |
| `getSessionUserId` | `async (): Promise<string \| null>` | อ่าน token จาก cookie แล้วคืน `uid` |
| `getCurrentUser` | `async ()` | ดึง user จาก Prisma โดย select ข้อมูลสำคัญรวมถึง `starterClaimed`, `pityCounter` |

Internal:

- `SECRET = process.env.AUTH_SECRET \|\| "px-dev-insecure-secret-change-me"`
- Token format: `base64url(body).base64url(hmac)`
- Cookie name: `px_session`

### 7.2 `src/lib/prisma.ts`

- สร้าง `PrismaClient` singleton
- ใน dev เก็บ instance บน `globalThis` เพื่อป้องกัน hot-reload สร้าง connection ซ้ำ
- log: dev แสดง `error` + `warn`, นอกนั้นแสดงแค่ `error`

### 7.3 `src/lib/constants.ts`

| Export | ค่า | หมายเหตุ |
|---|---|---|
| `CARD_TIERS` | `["Bronze","Silver","Gold","Elite","Hero","Icon","Event","TOTW","TOTS","Legend"]` | - |
| `CardTier` | `(typeof CARD_TIERS)[number]` | Type |
| `POSITIONS` | `["GK","LB","LWB","CB","RB","RWB","CDM","CM","CAM","LM","RM","LW","RW","ST","CF"]` | - |
| `Position` | `(typeof POSITIONS)[number]` | Type |
| `POSITION_GROUP` | `Record<Position, "GK" \| "DEF" \| "MID" \| "ATT">` | แมปตำแหน่งไปกลุ่ม |
| `CURRENCIES` | `["silver","gold","shards"]` | - (ก่อน 2026-07-24 มี `packTicket`/`evoShards`/`primeShards` ด้วย — ลบทิ้งแล้ว) |
| `Currency` | `(typeof CURRENCIES)[number]` | Type |
| `TIER_COLOR` | `Record<CardTier, string>` | สี hex ต่อ tier |
| `DEPOSIT_RATE_GOLD_PER_BAHT` | `10 / 100` | อัตราแลกเงินบาทเป็น Gold |
| `NOTIFICATION_TYPES` | `["DAILY_REWARD","PACK_OPENED","LEVEL_UP","SYSTEM"]` | - |
| `NotificationType` | `(typeof NOTIFICATION_TYPES)[number]` | Type |

`POSITION_GROUP` mapping:

- `GK`: GK
- `DEF`: LB, LWB, CB, RB, RWB
- `MID`: CDM, CM, CAM, LM, RM
- `ATT`: LW, RW, ST, CF

### 7.4 `src/lib/formations.ts`

| Export | ประเภท | ค่า |
|---|---|---|
| `Slot` | type | `{ pos: string; x: number; y: number }` |
| `FORMATIONS` | `Record<string, Slot[]>` | `"4-3-3"`, `"4-4-2"`, `"3-5-2"`, `"4-2-3-1"` |
| `FORMATION_NAMES` | `string[]` | `Object.keys(FORMATIONS)` |
| `DEFAULT_FORMATION` | `string` | `"4-3-3"` |

ตำแหน่งช่องทั้ง 4 formation:

**4-3-3**

| Index | Pos | x | y |
|---|---|---|---|
| 0 | GK | 50 | 92 |
| 1 | LB | 16 | 70 |
| 2 | CB | 38 | 74 |
| 3 | CB | 62 | 74 |
| 4 | RB | 84 | 70 |
| 5 | CM | 30 | 48 |
| 6 | CM | 50 | 52 |
| 7 | CM | 70 | 48 |
| 8 | LW | 18 | 22 |
| 9 | ST | 50 | 16 |
| 10 | RW | 82 | 22 |

**4-4-2**

| Index | Pos | x | y |
|---|---|---|---|
| 0 | GK | 50 | 92 |
| 1 | LB | 16 | 70 |
| 2 | CB | 38 | 74 |
| 3 | CB | 62 | 74 |
| 4 | RB | 84 | 70 |
| 5 | LM | 16 | 46 |
| 6 | CM | 40 | 50 |
| 7 | CM | 60 | 50 |
| 8 | RM | 84 | 46 |
| 9 | ST | 38 | 18 |
| 10 | ST | 62 | 18 |

**3-5-2**

| Index | Pos | x | y |
|---|---|---|---|
| 0 | GK | 50 | 92 |
| 1 | CB | 30 | 74 |
| 2 | CB | 50 | 76 |
| 3 | CB | 70 | 74 |
| 4 | LM | 12 | 48 |
| 5 | CM | 35 | 52 |
| 6 | CM | 50 | 54 |
| 7 | CM | 65 | 52 |
| 8 | RM | 88 | 48 |
| 9 | ST | 38 | 18 |
| 10 | ST | 62 | 18 |

**4-2-3-1**

| Index | Pos | x | y |
|---|---|---|---|
| 0 | GK | 50 | 92 |
| 1 | LB | 16 | 70 |
| 2 | CB | 38 | 74 |
| 3 | CB | 62 | 74 |
| 4 | RB | 84 | 70 |
| 5 | CDM | 38 | 56 |
| 6 | CDM | 62 | 56 |
| 7 | CAM | 50 | 38 |
| 8 | LW | 18 | 34 |
| 9 | RW | 82 | 34 |
| 10 | ST | 50 | 14 |

### 7.5 `src/lib/clubs.ts`

- `CLUB_BY_FOLDER: Record<string, string>`
- `clubFromFolder(folder: string): string`

Map ชื่อโฟลเดอร์ → ชื่อสโมสร เช่น `mancity → "Manchester City"`, `crystalpalace → "Crystal Palace"`

### 7.6 `src/lib/cardgen.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `deriveTier` | `(ovr: number): "Bronze" \| "Silver" \| "Gold"` | `>=75 → Gold`, `>=65 → Silver`, นอกนั้น Bronze |
| `generateStats` | `(ovr: number, position: string): Stats` | สร้างค่าพลัง 6 ตัวแบบ deterministic จาก OVR + กลุ่มตำแหน่ง |

`OFFSETS` ต่อกลุ่ม:

| Group | pace | shooting | passing | dribbling | defending | physical |
|---|---|---|---|---|---|---|
| GK | -18 | -45 | -8 | -25 | -30 | -2 |
| DEF | -2 | -25 | -8 | -8 | 6 | 4 |
| MID | -3 | -5 | 5 | 4 | -4 | -2 |
| ATT | 5 | 7 | -5 | 6 | -30 | -4 |

สูตร: `stat = clamp(ovr + offset)` โดย `clamp = Math.max(30, Math.min(99, Math.round(n)))`

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

### 7.9 `src/lib/economy.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `InsufficientFundsError` | class | `currency`, `have`, `need` |
| `addCurrency` | `(userId, currency, amount, tx?)` | increment currency (amount > 0) |
| `spendCurrency` | `(userId, currency, amount, tx?)` | เช็คยอดก่อนใน transaction แล้ว decrement |
| `grantExp` | `(userId: string, amount: number)` | เพิ่ม exp และเลื่อน level อัตโมัติ |
| `mockDeposit` | `(userId: string, baht: number)` | แปลงเงินบาทเป็น Gold ตาม `DEPOSIT_RATE_GOLD_PER_BAHT` + **First Deposit Bonus +20%** ถ้าเป็นการเติมครั้งแรก (`User.hasDeposited`) — return `{ baht, gold, bonusGold, totalGold, isFirstDeposit }` (เปลี่ยน shape จากเดิม `{baht, gold}`, ยังไม่มี UI เรียกใช้จริง รอหน้า deposit) |

Level-up formula: `while (exp >= level * 100) { exp -= level*100; level++ }`

### 7.10 `src/lib/packs.ts` — เขียนใหม่ทั้งหมด 2026-07-16 (ไม่มี pity/Premium/Ticket แล้ว)

| Export | ประเภท | รายละเอียด |
|---|---|---|
| `PackTier` | type | `"Bronze" \| "Silver" \| "Gold"` — tier ของการ์ดใน**พูล normal**เท่านั้น (Evolution/Royal Prime การันตีแยกจากระบบนี้) |
| `CARDS_PER_OPEN` | `5` | ทุก pack เปิดทีละ 5 ใบ (เดิม 1 ใบ) |
| `SpecialConfig` | type | `{ category: string; bonusChance: number }` — เฉพาะ pack ที่มีการันตี |
| `PackConfig` | type | `{ id, name, currency, cost, desc, fillerRates: Record<PackTier,number>, special?: SpecialConfig }` |
| `PACKS` | `Record<string, PackConfig>` | ดูตารางด้านล่าง — เหลือ 3 ตัว: `standard`, `evolution`, `royalprime` |
| `SHARD_EXCHANGE` | `Record<string, {packId, field, cost}>` | แลก shard เป็นซองฟรี ดูตารางด้านล่าง |
| `SHARD_VALUE` | `Record<string, number>` | Bronze=5, Silver=15, Gold=50, **Hero=100, Legend=250** |
| `OpenedCard` | type | `{ id, ovr, position, tier, imageUrl, playerName, club, isDuplicate, shardsGained, isSpecial }` — ต่อใบ |
| `OpenResult` | type | `{ cards: OpenedCard[], leveledUp, level }` — **array แทน card เดี่ยว** |
| `openPack` | `(userId, packId) => Promise<OpenResult>` | เปิดซองจ่าย currency ปกติ |
| `openPackWithShards` | `(userId, exchangeId) => Promise<OpenResult>` | แลก shard เปิดซองฟรี (ใช้ `SHARD_EXCHANGE`) |
| `grantFreePack` | `(tx, userId, packId) => Promise<OpenResult>` | แจกซองฟรีแบบไม่หักเงิน ไม่เปิด transaction เอง (รับ `tx` จากผู้เรียก) — ใช้โดย `claimDaily()` สำหรับ login milestone |

Pack config (`fillerRates` = เรตของใบที่สุ่มจากพูล normal):

| ID | Name | Currency | Cost | Bronze | Silver | Gold | Special |
|---|---|---|---|---|---|---|---|
| `standard` | Standard Pack | silver | 300 | 55% | 38% | 7% | - |
| `evolution` | Evolution Pack | gold | 10 | 10% | 50% | 40% | การันตี 1 ใบจากพูล Evolution (uniform 1/44) + 10% โบนัสใบที่ 2 |
| `royalprime` | Royal Prime Pack | gold | 20 | 10% | 50% | 40% | การันตี 1 ใบจากพูล Royal Prime (uniform 1/44) + 12% โบนัสใบที่ 2 |

Shard Exchange (pool เดียว ตั้งแต่ 2026-07-24 — ป้องกันฟาร์ม tier ต่ำแลกซองแพงด้วยราคาต่างกันมาก แทนการแยก pool ตามที่มาแบบเดิม):

| Exchange ID | ใช้ field | Cost | แลกได้ |
|---|---|---|---|
| `standard` | `shards` | 500 | Standard Pack ฟรี 1 ครั้ง |
| `evolution` | `shards` | 2,500 | Evolution Pack ฟรี 1 ครั้ง |
| `royalprime` | `shards` | 6,000 | Royal Prime Pack ฟรี 1 ครั้ง |

Flow `resolvePackCards` (ใช้ร่วมกันทั้ง `openPack`/`openPackWithShards`/`grantFreePack`):

1. ถ้า pack ไม่มี `special` (Standard) → สุ่ม 5 ใบอิสระจากพูล normal ด้วย `fillerRates`
2. ถ้ามี `special` (Evolution/Royal Prime) → สุ่ม 1 ใบจากพูล special (uniform) การันตีเสมอ, สุ่ม `Math.random() < bonusChance` เพื่อเพิ่มใบที่ 2 จากพูลเดียวกัน, ที่เหลือเติมจากพูล normal ด้วย `fillerRates`

Flow `finalizeOpen` (เช็ค duplicate + แจก shard + EXP ต่อการเปิด 1 ครั้ง ไม่ใช่ต่อใบ):

1. วนทุกใบที่สุ่มได้ เช็ค duplicate จาก `UserCard`
2. ไม่ซ้ำ → create `UserCard`; ซ้ำ → เพิ่ม `shards` (pool เดียว ทุก tier) ด้วยค่าจาก `SHARD_VALUE`
3. เพิ่ม EXP คงที่ 20 หน่วยต่อการเปิด 1 ครั้ง (ไม่ใช่ต่อใบ) และ level-up ถ้าถึง
4. return `{ cards: OpenedCard[], leveledUp, level }`

`openPack`/`openPackWithShards` ครอบด้วย `prisma.$transaction` ของตัวเอง หักเงินด้วย `tx.user.updateMany({ where: { id, [currency]: { gte: cost } }, data: { decrement } })` (atomic conditional — เช็ค `count === 0` แล้วโยน `InsufficientFundsError` แทนอ่านยอดมาเช็คใน application ก่อน update เพื่อกัน race condition ตอนเปิดซองพร้อมกันหลายคำขอ ปรับแก้ 2026-07-24) ก่อนค่อยสุ่ม+finalize; `grantFreePack` รับ `tx` จากผู้เรียกเพื่อ atomic ร่วมกับ logic อื่น (เช่น `claimDaily`)

### 7.11 `src/lib/starter.ts`

| Export | ประเภท | รายละเอียด |
|---|---|---|
| `StarterAlreadyClaimedError` | class | - |
| `StarterCard` | type | `{ id, ovr, position, tier, imageUrl, playerName, club }` |
| `openStarterPack` | `(userId: string) => Promise<{ cards: StarterCard[] }>` | แจก 11 ใบ + เงินตั้งต้น |

Constants:

- `STARTER_SILVER = 300` (เดิมมี `STARTER_TICKET = 1` ด้วย ตัดออกแล้วหลังยกเลิก Ticket Pack 2026-07-16)
- `DEFAULT_POSITIONS = FORMATIONS["4-3-3"].map(s => s.pos)`
- `GOLD_OVR_MIN = 75`, `GOLD_OVR_MAX = 78`
- `GOLD_SLOT_COUNT = 2`

Algorithm `pickStarterCardIds`:

1. pool = การ์ด `ovr < 75`, `category="normal"`, ตำแหน่งใน DEFAULT_POSITIONS
2. goldPool = การ์ด `tier="Gold"`, `ovr 75-78`, `category="normal"`, ตำแหน่งใน DEFAULT_POSITIONS
3. สุ่มเลือก 2 ช่องจาก 11 ให้เป็น Gold
4. ทีละตำแหน่ง ถ้าเป็นช่อง Gold เลือกจาก goldPool ไม่งั้นจาก pool
5. ถ้ายังไม่ครบ 11 เติมจาก pool ที่เหลือ

`openStarterPack` flow:

- เช็ค `starterClaimed`
- create `UserCard` 11 รายการ
- อัปเดต `starterClaimed=true`, `silver += 300`
- return รายละเอียดการ์ด

### 7.12 `src/lib/daily.ts` — เขียนใหม่ 2026-07-16 (เพิ่ม gold trickle + login milestone), ลบ `packTicket` ออกจาก type แล้ว 2026-07-24

| Export | ประเภท/Signature | รายละเอียด |
|---|---|---|
| `DailyReward` | type | `{ day, silver, exp, gold }` |
| `LOGIN_MILESTONES` | `{ evolution: {totalLogins:15, field:"evoMilestoneClaimed", packId:"evolution"}, royalprime: {totalLogins:30, field:"primeMilestoneClaimed", packId:"royalprime"} }` | milestone แจกซองฟรีครั้งเดียว |
| `rewardForStreak` | `(streak: number): DailyReward` | คำนวณรางวัล |
| `DailyStatus` | type | `{ canClaim, streak, nextStreak, nextReward, totalLogins }` — เพิ่ม `totalLogins` |
| `getDailyStatus` | `(userId: string): Promise<DailyStatus>` | เช็คสถานะ |
| `MilestoneReward` | type | `{ packId: string; cards: OpenedCard[] }` |
| `ClaimResult` | union type | success (มี `milestone?: MilestoneReward`) / fail |
| `claimDaily` | `(userId: string): Promise<ClaimResult>` | เคลมรางวัล + auto-grant milestone ถ้าถึง |

`rewardForStreak(streak)`:

- `day = ((streak - 1) % 7) + 1` (วันที่ 1-7)
- `silver = 100 + day * 30 + (day === 7 ? 300 : 0)` — เพิ่ม bonus 300 วันที่ 7 แทน Pack Ticket เดิม
- `exp = 30`
- `gold = (day === 7 ? 5 : 0) + (streak % 30 === 0 ? 5 : 0)`

ตัวอย่างรางวัล (30 วันแรก): silver รวม 7,650, gold รวม 13 (4×2 จาก weekly + 5 จาก 30-day bonus)

| Streak | Day | Silver | EXP | Gold |
|---|---|---|---|---|
| 1 | 1 | 130 | 30 | 0 |
| 7 | 7 | 610 | 30 | 2 |
| 14 | 7 | 610 | 30 | 2 |
| 15 | 1 | 130 | 30 | 0 |
| 21 | 7 | 610 | 30 | 2 |
| 28 | 7 | 610 | 30 | 2 |
| 30 | 2 | 160 | 30 | 5 |

`getDailyStatus`:

- `canClaim = lastClaimDate ไม่ใช่วันนี้`
- `nextStreak = last === today - 1 ? currentStreak + 1 : 1`

`claimDaily` milestone logic (ต่อจาก reward เดิม):

1. `totalLogins = user.totalLogins + 1` (เพิ่มทุกครั้งที่เคลมสำเร็จ ไม่สนใจ streak ขาดหรือไม่ — ต่างจาก `loginStreak`)
2. วนเช็ค `LOGIN_MILESTONES`: ถ้ายังไม่เคย claim (`evoMilestoneClaimed`/`primeMilestoneClaimed` = false) และ `totalLogins >= threshold` → เรียก `grantFreePack(tx, userId, packId)` แล้วตั้ง flag เป็น `true`
3. ชนได้สูงสุด 1 milestone ต่อการ claim 1 ครั้ง (totalLogins เพิ่มทีละ 1 เท่านั้น)
4. return `milestone` แนบไปกับ `ClaimResult` ถ้ามี — ใช้แสดงผลใน `DailyClaim.tsx` + สร้าง notification ใน action

### 7.13 `src/lib/squad.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `getOrCreateSquad` | `(userId: string, tx?)` | หรือสร้าง Squad พร้อม 11 SquadSlot — รับ `tx` ได้ (ใช้ร่วมกับ `pvp.ts:playPvpMatch`) |
| `buildChemEntries` | `(slots, layout): (ChemEntry \| null)[]` | สร้างเข้าคู่กับ `computeChemistry()` — ใช้ร่วมกัน 3 ที่ (`refreshCachedRating` ที่นี่ + `findOpponent`/`playPvpMatch` ใน `pvp.ts`) กันโค้ดซ้ำ |
| `buildLineup` | `(slots, layout): { name; ovr; slotPos }[]` | ทีมลงสนามจริงสำหรับจำลองแมตช์ PvP — `slotPos` คือตำแหน่งที่จัดลงเล่น ไม่ใช่ `card.position` ดิบ |
| `refreshCachedRating` | `(tx, userId): Promise<void>` | อัปเดต `Squad.cachedRating` ให้ตรงทีมจริงปัจจุบัน (แค่ query filter หา PvP matchmaking) — เรียกทุกครั้งใน `setFormation`/`assignSlot` |
| `setFormation` | `(userId: string, formation: string)` | เปลี่ยน formation แล้ว `refreshCachedRating` |
| `assignSlot` | `(userId: string, index: number, cardId: string \| null, now?)` | ใส่/ถอดการ์ด แล้ว bump mission + `refreshCachedRating` |

`assignSlot` behavior:

- ตรวจ index 0-10
- ถ้าใส่การ์ด ตรวจสอบว่าเป็นเจ้าของผ่าน `UserCard`
- ถ้าการ์ดนี้อยู่ช่องอื่นในทีมเดียวกัน จะย้ายออกก่อน (updateMany `cardId: null`)

### 7.14 `src/lib/notifications.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `createNotification` | `(input: {userId, type, title, body?, href?})` | สร้าง Notification แบบ best-effort (catch ไม่ throw) |
| `notifyLevelRewards` | `(userId, level, levelRewards)` | สรุปรางวัล level-up เป็น noti `LEVEL_UP` — ใช้ร่วมกันทุก action ที่ให้ EXP |
| `notifyMissionClaimed` | `(userId, result)` | noti `MISSION_CLAIMED` |
| `notifyPvpMatch` | `(userId, result)` | noti `PVP_MATCH` (สกอร์ + RP) |
| `notifyPvpSeasonEnd` | `(userId, reward)` | noti รางวัลจบ season |
| `notifyAchievementUnlocked` | `(userId, result)` | noti `ACHIEVEMENT_UNLOCKED` |
| `notifyFantasyScore` | `(userId, gameweekId, gameweekNumber, points, rank, tx)` | noti `FANTASY_SCORE` ผ่าน `createNotificationOnce` — เรียกใน tx เดียวกับ score upsert ของ `runScoring` เสมอ |
| `notifyFantasyReward` | `(userId, gameweekId, gameweekNumber, reward, tx)` | noti `FANTASY_REWARD` ผ่าน `createNotificationOnce` — เรียกใน tx เดียวกับ `addCurrency()`/`grantFreePack()` ของรางวัลนั้น |
| `createNotificationOnce` | `(input: {..., idempotencyKey}, tx): Promise<void>` | สร้าง noti แบบ idempotent ผ่าน `upsert` บน `Notification.idempotencyKey` (`update: {}` กัน retry reset `read`/`createdAt` เดิม) — **ไม่กลืน error** เหมือน `createNotification`; ต้องเรียกใน `tx` เดียวกับ side effect หลักเสมอเพื่อให้ rollback พร้อมกันได้ |
| `getUnreadCount` | `(userId: string): Promise<number>` | `unreadNotifs + unreadNews` |
| `NotificationItem` | type | - |
| `NewsItem` | type | - |
| `getNotificationCenter` | `(userId): Promise<{news, notifications}>` | ดึงข่าว + noti ล่าสุด (สำหรับ `/notifications` เท่านั้น) |
| `NewsListItem` | type | `{ id, title, body, createdAt }` |
| `getNews` | `(limit = 30): Promise<NewsListItem[]>` | **ใหม่ (ขั้น 12)** — ข่าวอ่านอย่างเดียวสำหรับ `/fantasy` (hub preview) และ `/fantasy/news` แยกจาก `getNotificationCenter` เพราะไม่ผูกกับ `lastReadNewsAt`/mark-as-read (หน้าที่นั้นเป็นของ `/notifications` เท่านั้น) |
| `markAllRead` | `(userId: string, cutoff: Date = new Date()): Promise<void>` | อัปเดต noti เป็น read + ตั้ง `lastReadNewsAt` — **เฉพาะรายการที่ `createdAt <= cutoff`** (แก้ระหว่าง QA ขั้น 11: เดิมไม่มีพารามิเตอร์ `cutoff` mark ทุกอย่าง ณ เวลาที่ฟังก์ชันรัน ทำให้ race กับ noti ที่เพิ่งถูกสร้างระหว่างเปิดหน้า) ทั้งสอง update อยู่ใน `$transaction` เดียวกัน |

`getUnreadCount`:

- `unreadNotifs = count Notification where userId, read=false`
- `unreadNews = count Announcement where published=true, createdAt > lastReadNewsAt`

### 7.15 `src/lib/missionConfig.ts`

Catalog มิชชั่น — **เป็นโค้ด ไม่ใช่ DB** เพิ่มมิชชั่นใหม่จึงไม่ต้อง migrate

| Export | รายละเอียด |
|---|---|
| `MISSION_KEYS` | 5 key: `daily_login`, `daily_open_pack`, `daily_assign_team`, `weekly_login5`, `weekly_open_pack10` |
| `MissionKey` / `MissionConfig` | type |
| `MISSIONS` | `Record<MissionKey, MissionConfig>` — `{key, period, target, reward, label}` |

| Mission | Period | Target | Reward |
|---|---|---|---|
| Login วันนี้ | daily | 1 | Silver 15 + EXP 5 |
| เปิดซอง 1 ครั้ง | daily | 1 | Silver 40 + EXP 10 |
| วางการ์ดในช่อง 1 ครั้ง | daily | 1 | Silver 25 + EXP 5 |
| Login สะสมครบ 5 วัน | weekly | 5 | Silver 200 + Standard Pack ฟรี |
| เปิดซองสะสมครบ 10 ครั้ง | weekly | 10 | Silver 300 + EXP 30 |

> ไม่มี Gold และไม่มี Pack Ticket จาก mission เลย (ตั้งใจ — กันเงินเฟ้อ)

### 7.16 `src/lib/missionPeriod.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `dailyPeriodKey` | `(d: Date): string` | epoch-day string — ใช้ boundary เดียวกับ `dayIndex()` ใน `daily.ts` |
| `weeklyPeriodKey` | `(d: Date): string` | epoch-week string |

### 7.17 `src/lib/missions.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `bumpMission` | `(tx, userId, missionKey, now)` | +1 progress (upsert) — เรียกจาก `packs.ts`, `squad.ts` |
| `bumpLoginMissions` | `(tx, userId, now)` | bump login daily+weekly ครั้งแรกของวัน — เรียกจาก `daily.ts` |
| `MissionStatus` | type | `{key, label, period, progress, target, claimed, reward}` |
| `getMissionStatus` | `(userId, now): Promise<MissionStatus[]>` | เติม default (progress 0) ให้มิชชั่นที่ยังไม่มีแถวใน DB |
| `ClaimMissionResult` | type | `{ok:true, reward, pack?, leveledUp, level, levelRewards, missionLabel} \| {ok:false, error}` |
| `claimMission` | `(userId, missionKey, now)` | **atomic compare-and-set** (`updateMany` + เช็ค count) ไม่พึ่ง transaction-serialization ของ SQLite |

จุดที่ bump progress:

- `daily.ts:claimDaily` → `bumpLoginMissions`
- `packs.ts:openPack` / `openPackWithShards` → `DAILY_OPEN_PACK` + `WEEKLY_OPEN_PACK_10`
- `squad.ts:assignSlot` → `DAILY_ASSIGN_TEAM`

### 7.18 `src/lib/pvp.ts` (517 บรรทัด)

| Export | Signature | รายละเอียด |
|---|---|---|
| `PVP_TIERS` | const | 6 tier: bronze 0 / silver 100 / gold 250 / elite 450 / champion 700 / legend 1000 (RP ขั้นต่ำ) |
| `tierForRP` | `(rp: number): PvpTier` | **tier ไม่ store ใน DB** — derive จาก `pvpRP` เสมอ |
| `seasonKey` | `(d: Date): string` | `"YYYY-MM"` แบบ UTC = เดือนปฏิทิน |
| `winStreakBonus` / `rpMultiplier` / `rpDeltaForOutcome` | pure function | คำนวณโบนัสและ RP ที่ได้/เสีย |
| `simulateMatch` | `(...)` | จำลองสกอร์ด้วย weighted goal-count distribution + goal events ถ่วงน้ำหนักตาม `slotPos` |
| `generateBotSquad` | `(tx, targetRating)` | สุ่มทีมบอทจากพูลการ์ดจริง (ขยายช่วง OVR ±15%→±30%→±50%→ไม่จำกัด) |
| `findOpponent` | `(...)` | หา Squad ผู้เล่นอื่นที่ `cachedRating` ±20% ก่อน ไม่เจอ fallback เป็นบอท |
| `PvpMatchResult` / `SeasonEndReward` / `PvpStatus` | type | - |
| `playPvpMatch` | `(userId, now): Promise<PvpMatchResult>` | เล่น 1 แมตช์แบบ atomic ทั้ง flow |
| `getPvpStatus` | `(userId, now): Promise<PvpStatus>` | read-only — **ไม่** trigger season reset |

`playPvpMatch` ทำตามลำดับใน transaction เดียว:

1. อ่าน Squad ตัวเอง validate ครบ 11 ตำแหน่งก่อนแตะโควตา/ticket (กัน reward commit ทั้งที่แมตช์ reject)
2. Lazy season check — ถ้า `pvpSeasonKey` ไม่ตรงเดือนปัจจุบัน แจกรางวัลจบ season ตาม tier แล้ว reset `pvpRP = 0`
3. โควตา: ฟรี 5 แมตช์/วัน (`FREE_MATCHES_PER_DAY`) เกินนั้นหัก Gold 3 (`TICKET_COST_GOLD`) — atomic compare-and-set
4. Matchmaking → `computeChemistry()` **สดทั้งสองฝั่ง** (ไม่ใช้ `cachedRating` ตรงๆ กันข้อมูลค้าง) → `simulateMatch()`
5. Apply EXP/Silver/RP/win-streak + level reward + `pvpTotalWins` (สำหรับ achievement)

> Ticket match ที่แพ้ได้ EXP/Silver = 0 (กัน pay-to-farm)

### 7.19 `src/lib/achievementConfig.ts`

Catalog achievement **31 รายการ** — single source of truth ที่ progress/claim/UI ทุกจุดต้องอ่านจากที่นี่

| Category | จำนวน | รายละเอียด |
|---|---|---|
| `activity` | 10 | เปิดซองครบ 5/20/50/150/300 + ชนะ PvP ครบ 5/20/50/150/300 |
| `club` | 20 | สะสมนักเตะครบทีม × 20 สโมสร — gen จาก `data/achievements/club-collection.json` |
| `meta` | 1 | `big6_complete` — ครบทั้ง 6 สโมสร Big 6 |

- รางวัล activity ไล่ตาม target: 5 → Silver 500 · 20 → +Standard · 50 → Gold 5 + Evolution · 150 → Gold 10 + Royal Prime · 300 → Gold 20 + Royal Prime
- รางวัล club แบ่ง 2 tier: `small` (Silver 1000 + Standard) / `large` (Silver 1500 + Gold 5 + Evolution)
- โมดูลนี้ **throw ตอน import** ถ้า `club-collection.json` มีสโมสร Big 6 ไม่ครบ 6 — fail fast ไม่ปล่อยให้ catalog เพี้ยนเงียบ

### 7.20 `src/lib/achievements.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `AchievementStatus` | type | `{key, category, label, progress, target, claimed, reward}` |
| `getAchievementStatus` | `(userId): Promise<AchievementStatus[]>` | progress **คำนวณสดเสมอ** — activity อ่านจาก `User.totalPacksOpened`/`pvpTotalWins`, club/meta join `UserCard` |
| `ClaimAchievementResult` | type | `{ok:true, reward, pack?, leveledUp, level, levelRewards, achievementLabel} \| {ok:false, error}` |
| `claimAchievement` | `(userId, achievementKey)` | `create()` row (claimed=true ตั้งแต่สร้าง) แล้วอาศัย `@@unique` ชน P2002 เป็นตัวกันเคลมซ้ำแบบ atomic |

> counter `totalPacksOpened` / `pvpTotalWins` เริ่มนับ 0 ตั้งแต่ deploy ระบบนี้ **ไม่ backfill ย้อนหลัง** และ `totalPacksOpened` นับเฉพาะซองที่ user กดเปิดเอง ไม่นับ starter/ซองฟรีจาก milestone

### 7.21 `src/lib/fantasyConfig.ts`

Catalog กลางของ Fantasy — single source of truth เหมือน `missionConfig.ts`/`achievementConfig.ts` ห้าม hardcode ตัวเลขคะแนน/reward ซ้ำที่อื่น

| Export | ค่า | หมายเหตุ |
|---|---|---|
| `SQUAD_QUOTA` | `{GK:2, DEF:5, MID:5, ATT:3}` | เป้าหมายต่อกลุ่มตำแหน่งของ Squad 15 คน — **ใช้แสดงผล UI เท่านั้น** ไม่บังคับครบ 15 (ขั้นต่ำจริงคือ 11 ตัวจริงครบ formation) |
| `MAX_BENCH_SIZE` | `4` | ตัวสำรองสูงสุด |
| `PREMIER_LEAGUE_CLUBS` | 20 ชื่อสโมสร | dropdown ตอน admin เพิ่มแมตช์ กันพิมพ์ผิด — ไม่ใช่ allowlist บังคับที่ชั้น validation ของ `upsertMatch` |
| `GAMEWEEK_STATUS` | `{UPCOMING, LOCKED, SCORING, SCORED}` | state machine ของ `Gameweek.status` |
| `SCORING` | ตารางคะแนน | `APPEARANCE_SHORT=1` (1-59 นาที), `APPEARANCE_FULL=2` (≥60), `GOAL` แยกตามกลุ่ม (GK 10/DEF 6/MID 5/ATT 4), `ASSIST=3`, `CLEAN_SHEET` แยกตามกลุ่ม (GK 4/DEF 4/MID 1/ATT 0), `GOALS_CONCEDED_PER_POINT=2` (-1 ทุก 2 ลูกที่เสีย เฉพาะ GK/DEF), `YELLOW=-1`, `RED=-3`, `OWN_GOAL=-2`, `CAPTAIN_MULTIPLIER=2` |
| `FORMATION_MIN` | `{DEF:3, MID:2, ATT:1}` | ขั้นต่ำต่อกลุ่มของ final XI หลัง auto-sub (GK จัดการแยก) |
| `PARTICIPANT_TIERS` | tier ตาม participant count | จำนวนผู้เข้าแข่งจริง (`submittedAt != null`) → เปิด payout ถึงอันดับเท่าไหร่ (200+→1000, 20+→100, 5+→10, 1+→1) |
| `WEEKLY_REWARDS` | tier ตาม rank | Top1: Gold 3 + Evolution Pack · Top10: Standard Pack + Silver 300 · Top100: Silver 300 · Top1000: Silver 100 |
| `SCORING_STALE_THRESHOLD_MS` | `5 * 60_000` | Gameweek ค้างสถานะ `SCORING` นานกว่านี้ถือว่า process เดิมตายแล้ว อนุญาต resume/takeover lease |

### 7.22 `src/lib/fantasyScoring.ts`

Pure scoring engine — **ห้าม import prisma ในไฟล์นี้** (เทสได้โดยไม่พึ่ง DB ดู `fantasyScoring.test.ts`)

| Export | Signature | รายละเอียด |
|---|---|---|
| `scorePlayer` | `(stat: MatchStatLine, group): number` | คะแนนนักเตะ 1 คน 1 แมตช์ (ไม่รวม captain multiplier) |
| `resolveAutoSubs` | `(starters, bench, minutesByPlayerId): EffectiveXIResult` | Auto-substitution แบบ deterministic — GK แทนได้เฉพาะ GK ก่อน, ส่วน outfield ค้นหา **exhaustive** (ไม่ greedy) หา subset ตัวสำรองที่ใหญ่ที่สุดที่ทำให้ final XI ผ่าน `FORMATION_MIN` จริง (bench outfield ≤3 คน → ≤8 subset ต้องเช็ค) เลือกชุดที่ benchPriority รวมน้อยสุดถ้าเท่ากันหลายชุด |
| `resolveCaptain` | `(captainId, viceId, minutesByPlayerId): string \| null` | ใครได้ x2 — เช็คจาก minutes ของ **captain/vice ตัวจริงเท่านั้น** (ตัวสำรองที่แทนเข้ามาไม่รับตำแหน่งกัปตันต่อ) |
| `scoreEntry` | `(starters, bench, captainId, viceId, statsByPlayerId): ScoreEntryResult` | คิดคะแนนทีมทั้งทีม 1 GW รวม auto-sub + captain + รองรับ Double/Blank Gameweek (sum ทุกแมตช์ที่ทีมนั้นเล่นใน GW นี้) |
| `computeRanks` | `(scores: ScoreRow[]): RankedScore[]` | Competition ranking (1,2,2,4) — secondary sort ด้วย `userId` กัน order ไม่ deterministic |
| `participantRankLimit` | `(participantCount): number` | ไล่ `PARTICIPANT_TIERS` |
| `rewardTierFor` | `(rank, points, participantCount, periodType): RewardSpec \| null` | `points <= 0` ไม่ได้รางวัลเสมอ (กัน mass-tie-at-zero); เรียกด้วย `"MONTHLY"` **throw ชัดเจน** เพราะยังไม่มี `MONTHLY_REWARDS` (มาจริงใน 7C) |

### 7.23 `src/lib/fantasy.ts`

Service หลักของ Fantasy — จัดทีม (`FantasyEntry`/`FantasyEntrySlot`) + state machine ปิด Gameweek + leaderboard

| Export | Signature | รายละเอียด |
|---|---|---|
| `validateLineup` | `(entries, formation): {ok:true} \| {ok:false, error}` | Pure — ตำแหน่งตรงกลุ่ม, ห้าม `playerId`/`cardId` ซ้ำ (แม้คนละ tier การ์ด), ต้องมีกัปตัน/รองกัปตันอย่างละ 1 คนจากตัวจริง คนละคน, ตัวสำรองห้ามเป็นกัปตัน |
| `getCurrentGameweek` | `(now?)` | GW ที่ `deadline > now` ใกล้ที่สุด — ใช้เป็น "GW ปัจจุบัน" ทั้งหน้าจัดทีม/ตารางแข่ง |
| `getLatestScoredGameweek` | `()` | GW ล่าสุดที่ `status = SCORED` — default ของ leaderboard/TOTW |
| `getOrCreateEntry` | `(userId, gameweekId)` | Clone จาก entry ล่าสุดของ user เอง (ถ้ามี) ถ้ายังไม่มี entry ของ GW นี้ — มี side effect เขียน DB, **เรียกได้จาก `/fantasy/team` เพียงจุดเดียว** ห้ามเรียกจากหน้า hub; recover P2002 race ของ `(userId, gameweekId)` โดยอ่าน entry ที่ถูกสร้างไปแล้วกลับมาแทน throw |
| `saveEntry` | `(userId, gameweekId, formation, lineup, nowOverride?)` | Validate ownership+deadline+เนื้อทีมทั้งหมดในทรานแซกชันเดียว — เช็ค deadline **สองครั้ง** (precheck ก่อนอ่านข้อมูล + อีกครั้งด้วยเวลาสดทันทีก่อน write แรกใน tx) ลด race window ให้เหลือน้อยที่สุด |
| `closeGameweek` | `(gameweekId, now?, nowProvider?): Promise<CloseGameweekResult>` | State machine `UPCOMING/LOCKED → SCORING → SCORED` ด้วย CAS บน `scoringStartedAt` เป็น fencing token — resumable/idempotent เรียกซ้ำ/พร้อมกันได้เสมอ ไม่แจกรางวัลซ้ำ; ถ้าค้าง `SCORING` เกิน `SCORING_STALE_THRESHOLD_MS` อนุญาต takeover lease |
| `getLeaderboard` | `(gameweekId, limit=100): Promise<LeaderboardRow[]>` | เรียงตาม `rank` ที่ freeze ไว้ตอน `closeGameweek` (ไม่คำนวณสด) — `displayName = teamName ?? username` |
| `getMyLeaderboardRow` | `(gameweekId, userId): Promise<LeaderboardRow \| null>` | อันดับของ user คนเดียว (อาจไม่อยู่ใน top `limit`) — ใช้ทำ sticky row |

จุดออกแบบสำคัญ (อ่านก่อนแก้ `closeGameweek`/`runScoring`):

- **Draft entry (`submittedAt === null`) ถูกกรองทิ้งก่อนคำนวณอะไรทั้งสิ้น** — ไม่เข้า ranking/leaderboard/reward เลย ไม่สร้างแถว `FantasyGameweekScore` ให้ (ไม่ใช่ `rank: null` เพราะ SQLite เรียง NULL มาก่อนเสมอ จะทำให้โผล่บนสุดผิดที่)
- **Fenced lease (`withFencedLease`)**: ทุกจุดเขียนสำคัญใน `runScoring` (ทุก score upsert, ทุก reward grant) ต้อง renew lease (CAS บน `scoringStartedAt` เดิมเป๊ะ) **ในทรานแซกชันเดียวกับ side effect เสมอ** ห้ามแยก "renew แล้วค่อยเขียนทีหลัง" — ไม่งั้นมีช่องให้ owner ที่เสีย lease ไปแล้วยังเขียนต่อได้ (พบจาก Codex adversarial review)
- **`FantasyRewardGrant`** เป็น ledger กันแจกซ้ำอีกชั้น (unique ต่อ `userId+periodType+periodKey+rewardType`) ซ้อนกับ fencing ข้างต้น
- ปิด GW สำเร็จ (`SCORING → SCORED`) ก็ต้องเช็คผลลัพธ์ `count` จริงเช่นกัน (กันคน takeover แทรกพอดีตอนจะปิดบรรทัดสุดท้าย)

### 7.24 `src/lib/fantasyAdmin.ts`

DB service สำหรับ admin กรอกผลบอล — ทุก mutation เช็ค `Gameweek.status` สดในทรานแซกชันเดียวกับ write เสมอ (กัน TOCTOU race กับ `closeGameweek`'s CAS)

| Export | Signature | รายละเอียด |
|---|---|---|
| `createGameweek` | `(number, deadline): Promise<{id}>` | `monthKey` freeze จาก `deadline` แบบ UTC ตอนสร้าง (ใช้ `seasonKey()` เดิมจาก `pvp.ts`) — P2002 ชื่อซ้ำ throw error อ่านง่าย |
| `upsertMatch` | `(gameweekId, input: MatchInput): Promise<{id}>` | Validate เหย้า≠เยือน, สกอร์ไม่ติดลบ, ห้าม 0-0 แทน POSTPONED/CANCELLED |
| `listGameweeksForAdmin` | `(): Promise<GameweekAdminRow[]>` | รวม `matchCount`/`entryCount` ต่อ GW |
| `getGameweekAdminDetail` | `(gameweekId)` | รวมแมตช์ + สถิติผู้เล่นของแต่ละแมตช์ |
| `upsertPlayerStat` | `(matchId, playerId, clubSide, stat: PlayerStatInput): Promise<void>` | Validate นักเตะอยู่สโมสรตรง `clubSide`; **freeze `positionGroup`** จาก `Player.position` ขณะนั้น (ไม่ derive สด) และ reuse `positionGroup` เดิมถ้านักเตะคนนี้เคยมีสถิติใน GW เดียวกันแล้ว (กัน Double Gameweek จัดกลุ่มไม่ตรงกันข้ามแมตช์) |

### 7.25 `src/lib/fantasyFixtures.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `getFixtures` | `(gameweekId): Promise<Fixture[]>` | ตารางแข่งของ GW หนึ่ง เรียงตาม `kickoffAt` (ที่ยังไม่ตั้งเวลาอยู่ท้ายสุด) — query `Match` เดียว ไม่มี N+1 |

### 7.26 `src/lib/fantasyTotw.ts`

Team of the Week — **คำนวณสดทุกครั้ง ไม่ persist ตารางแยก** reuse `scorePlayer()` จาก `fantasyScoring.ts` ตรงๆ (ห้ามเขียนสูตรคะแนนซ้ำ)

| Export | Signature | รายละเอียด |
|---|---|---|
| `getTeamOfTheWeek` | `(gameweekId): Promise<TotwSlot[]>` | Join `Match`→`PlayerMatchStat`→`Player` ครั้งเดียว (ไม่มี N+1), sum คะแนนข้าม Double Gameweek, จัดเป็นฟอร์เมชั่น **4-3-3 คงที่** (GK×1/DEF×4/MID×3/ATT×3) เลือกคะแนนสูงสุดต่อกลุ่ม — tie-break: points→goals→assists→minutes→`playerId`; ตำแหน่งไหนมีคนไม่พอปล่อยช่องว่างไว้ (ไม่ error ไม่ดึงจากกลุ่มอื่นมาแทน) ใช้ `PlayerMatchStat.positionGroup` ที่ freeze ไว้เสมอ ห้าม derive จาก `Player.position` สด |

---

## 8. Card Import Pipeline

ไฟล์: `prisma/import-cards.ts`

ขั้นตอน:

1. อ่านไดเรกทอรี `public/card/normal/` และ `data/extracted/`
2. **ลบข้อมูลเก่าทั้งหมด** (destructive):
   - `prisma.userCard.deleteMany()`
   - `prisma.card.deleteMany()`
   - `prisma.player.deleteMany()`
3. วนลูปทีมทั้งหมดที่มี `.json` ใน `data/extracted/`
4. Map ชื่อโฟลเดอร์ → ชื่อสโมสรด้วย `clubFromFolder(team)`
5. วนลูปไฟล์ `.png` ในแต่ละทีม:
   - ตัด `.png` ออกจากชื่อไฟล์เพื่อเอา `name`
   - ตรวจ `position` ต้องอยู่ใน `POSITIONS` ถ้าไม่ใช่ให้เป็น `CM`
   - ตรวจ `ovr` ต้องอยู่ในช่วง 40-99
   - คำนวณ `tier` ด้วย `deriveTier(ovr)`
   - คำนวณ 6 stats ด้วย `generateStats(ovr, position)`
   - upsert `Player` ด้วย `name + club`
   - สร้าง `Card` พร้อม `imageUrl = /card/normal/<team>/<file>`

ปัจจุบันมี 20 ทีม 566 การ์ด ใน `public/card/normal/` (category `normal`)

### 8.1 `prisma/import-special-cards.ts` (ใหม่ 2026-07-16)

Import การ์ด Evolution/Royal Prime — ต่างจาก `import-cards.ts` ตรงที่:

- ไม่มีโฟลเดอร์ทีมย่อย รูปอยู่ตรงกับ category เลย (`public/card/evolution/*.png`, `public/card/royalprime/*.png`)
- extracted json (`data/extracted/evolution.json`, `royalprime.json`) มี `club`/`nation` ต่อการ์ดโดยตรง (ไม่ derive จากชื่อโฟลเดอร์แบบ `clubFromFolder`)
- **ไม่ล้างข้อมูลทั้งฐาน** ลบเฉพาะการ์ด category นั้นก่อน reimport (`deleteMany({where:{category}})`) กันซ้ำตอนรันหลายครั้ง โดยไม่กระทบการ์ด `normal`
- tier fix ตาม category: `evolution → "Hero"`, `royalprime → "Legend"` (ไม่ผ่าน `deriveTier()` เพราะ OVR เกิน 90 อยู่แล้ว)
- ใช้ `generateStats(ovr, position)` เหมือนเดิมสำหรับ 6 stats
- รัน: `npm run db:import-special`
- ผลลัพธ์: 88 การ์ด (Evolution 44 tier Hero OVR 90-92, Royal Prime 44 tier Legend OVR 92-98) — ข้อมูล vision-extract ด้วย 8 subagent ขนานกัน (คนละ 11 ใบ), แก้ไข 2 จุดที่รูปการ์ดผิด: Agüero/David Silva ธงชาติบนรูปขึ้น France/Netherlands (ผิด) แก้เป็น Argentina/Spain จริง

---

## 9. สิ่งที่ยังไม่ได้ implement (จาก GDD / TASKS.md)

| ระบบ | สถานะ | หมายเหตุ |
|---|---|---|
| PvP Matchmaking | **ทำแล้ว** (ขั้น 6) | `findOpponent`/`generateBotSquad` ใน `src/lib/pvp.ts` — hybrid ผู้เล่นจริง ±20% ก่อน ไม่เจอ fallback บอท |
| PvP Result Calculation | **ทำแล้ว** (ขั้น 6) | `simulateMatch()` — สกอร์ + goal events ถ่วงน้ำหนักตามตำแหน่ง |
| Ranking Tiers | **ทำแล้ว** (ขั้น 6) | 6 tier derive จาก `pvpRP` ผ่าน `tierForRP()` + season รายเดือน + รางวัลจบ season |
| Daily/Weekly Missions | **ทำแล้ว** (ขั้น 5) | `src/lib/missionConfig.ts`/`missions.ts` + `MissionList.tsx` — 3 daily + 2 weekly ผูก action จริง |
| Achievements | **ทำแล้ว** (ขั้น 5) | `src/lib/achievementConfig.ts`/`achievements.ts` + `/achievements` — 10 activity |
| Collection Rewards | **ทำแล้ว** (ขั้น 5) | 20 club + 1 meta (Big 6) รวมอยู่ใน catalog เดียวกับ achievement แยกด้วย `category` |
| Level Milestone Rewards | **ทำแล้ว** (ขั้น 5) | `applyExp()`/`levelReward()` ใน `src/lib/economy.ts` — ทุกเลเวลได้ Silver, ทุก 5/10/25 เลเวลแถม Pack ฟรี (+Gold) |
| Cosmetic System | ยังไม่ทำ | - |
| Fantasy — Core squad + snapshot (7A) | **ทำแล้ว** (ขั้น 7A) | จัดทีม 15 คน (11 ตัวจริง+4 สำรอง) ต่อ Gameweek ที่ `/fantasy/team`, validate ownership/ตำแหน่ง/captain-vice, snapshot freeze ตอน save — `src/lib/fantasy.ts` |
| Fantasy — Admin scoring + Weekly leaderboard (7B) | **ทำแล้ว** (ขั้น 7B) | Admin กรอกผล/สถิติที่ `/admin/fantasy`, `closeGameweek()` state machine คิดคะแนน+auto-sub+captain 2x, Weekly leaderboard + reward ledger, notification ผลคะแนน/รางวัล |
| Fantasy — Hub/ตารางแข่ง/ข่าว/TOTW | **ทำแล้ว** (ขั้น 12) | `/fantasy` bento hub + `/fantasy/{team,fixtures,news,leaderboard,totw}` — TOTW คำนวณสดฟอร์เมชั่น 4-3-3 จาก `PlayerMatchStat.positionGroup` ที่ freeze ไว้ |
| Fantasy — Monthly leaderboard + operations (7C) | **ยังไม่ทำ** | Monthly leaderboard ตาม `monthKey`, `FantasySettlement` (มีตารางในสคีมาแล้วแต่ยังไม่มีโค้ดอ่าน/เขียน), notification เพิ่ม/admin เห็นสถานะ settlement |
| Fantasy — External integration (7D) | **ยังไม่ทำ** | Sync ตารางแข่งจาก API-Football (`Match.providerFixtureId` เตรียมไว้ในสคีมาแล้ว), API route ปิด GW ด้วย secret token สำหรับ cron |
| Season / Event | ยังไม่ทำ | Phase 8 |
| Admin Panel สมบูรณ์ | ยังไม่ทำ | มี `/admin/news` (ข่าว) และ `/admin/fantasy` (Gameweek/แมตช์/สถิติ) แล้ว — ยังไม่มีจัดการนักเตะ/การ์ด, เติม Gold ผ่าน UI, ตั้งค่าอัตราสุ่ม pack |
| Deposit UI จริง | ยังไม่ทำ | Backend (`mockDeposit` + First Deposit Bonus) พร้อมแล้ว รอหน้า UI |
| Promotion deadline | ยังไม่ทำ | login milestone (15/30 วัน) เป็น mechanic ถาวร ไม่มีวันหมดเขต ถ้าจะทำเป็น "เฉพาะช่วง launch" จริงต้องเพิ่ม logic เช็ค `User.createdAt` |
| Pity/anti-frustration สำหรับสล็อตการันตี | ยังไม่ทำ | Evolution/Royal Prime สุ่มการันตี uniform 1/44 ล้วนๆ ไม่มีตัวช่วยกันซ้ำติดกัน |

สิ่งที่ GDD ระบุไว้แต่โค้ด implement ต่าง:

- GDD ระบุ pack เป็น Standard/Premium/Icon/Event/Exclusive (ผูก currency 4 สกุล) แต่โค้ดปัจจุบัน (2026-07-16) ออกแบบใหม่เป็น Standard/Evolution/Royal Prime ตาม rarity OVR (≤90 / ≤92 / 92+) แทน — เป็นการตัดสินใจ redesign ใหม่หลังคุยกับผู้ใช้ ไม่ใช่ bug
- GDD pity การันตี Icon แต่โค้ดเดิมการันตี Gold ทุก 10 Premium pack — **ตอนนี้ตัด pity ออกทั้งหมดแล้ว** (ไม่มี Premium pack แล้ว) แทนที่ด้วยการันตี 1 ใบพิเศษทุกครั้งที่เปิด Evolution/Royal Prime แทน
- GDD ระบุ duplicate แลก shards/upgrade/แลกซอง — ตอนนี้ implement "แลกซอง" แล้ว (Shard Exchange แยก 3 pool) แต่ "upgrade" ยังไม่มี

---

## 10. บัญชีทดสอบ (TEMP)

- Username: `test`
- Password: `test1234`
- ยอดเริ่มต้น: **0 ทุกสกุลเงิน** (schema default) — ตรวจโค้ดจริงแล้วพบว่าเอกสารฉบับก่อนหน้าระบุผิด (`devLoginAction`/`resetTestUserAction` ใน `src/app/actions/auth.ts` ไม่ได้ seed silver/gold/ticket ใดๆ แค่ `prisma.user.create()` เฉยๆ ซึ่งใช้ default ทั้งหมด) ต้องเปิด Starter Pack เองถึงจะได้ Silver 300 + การ์ด 11 ใบ
- ปุ่ม "เข้าสู่ระบบด้วยบัญชีทดสอบ" อยู่ที่หน้า Home และ Login — **แสดงเฉพาะเมื่อตั้ง `ENABLE_DEV_LOGIN=true`** (ดูหัวข้อ 11)
- ปุ่ม "เริ่มใหม่" ลบบัญชี test แล้วสร้างใหม่ (simulate ครั้งแรก, cascade ลบการ์ด/ทีมเดิมหมด)
- ทั้งหมดเป็น TEMP และจะลบก่อน production

### บัญชี QA admin แบบถาวร (`qa_admin`)

- Username: `qa_admin` / Password: `qa123456` / Phone: `0800000001` / `isAdmin: true`
- สร้างด้วย `prisma/seed-qa-admin.ts`: `ENABLE_DEV_LOGIN=true npx tsx prisma/seed-qa-admin.ts` (เช็ค `ENABLE_DEV_LOGIN=true` เหมือน `devLoginAction` กันรันพลาดใส่ env ที่ไม่ใช่ dev/QA)
- **ต่างจากบัญชี `test`**: ไม่ถูกลบโดยปุ่ม "เริ่มใหม่" (ปุ่มนั้นลบเฉพาะ username `test`) — ใช้เป็นบัญชีทดสอบที่ข้อมูล/สิทธิ์ admin คงอยู่ข้ามรอบทดสอบ
- Idempotent: รันซ้ำได้เสมอ ไม่ทับ silver/gold ที่ใช้ไปแล้ว แต่ไล่แจกการ์ดที่ยังขาดให้ครบทุกครั้ง (เผื่อ import การ์ดเพิ่มทีหลัง) — ตอนสร้างครั้งแรกได้ silver 999,999 / gold 99,999 + การ์ดครบทุกใบในระบบ
- เช็ค identity ก่อนแตะข้อมูลทุกครั้ง (username ชนกับ user ทั่วไปที่สมัครเองได้) — ถ้ามี username นี้แล้วแต่ phone ไม่ตรง สคริปต์จะปฏิเสธรันทันที ไม่แจกการ์ด/แก้ `isAdmin` ทับ
- ไม่มี npm script ผูกไว้ ต้องรันไฟล์ตรงๆ ตามคำสั่งข้างต้น

---

## 11. Configuration สำคัญ

### `next.config.ts`

- `allowedDevOrigins`: `["null", "mycoder-p5.knetwork.app", "*.knetwork.app"]`
- `experimental.serverActions.allowedOrigins`: เหมือนกัน
- ใช้เพื่อให้ Preview ผ่าน proxy ของ mycoder ทำงานได้ (sandboxed iframe ส่ง Origin: null)

### Environment Variables

- `DATABASE_URL` — ต้องมี `?connection_limit=1` ต่อท้าย (เช่น `file:./dev.db?connection_limit=1`) — **จำเป็น** ไม่ใช่ทางเลือก: ถ้าไม่มี การเปิดซอง/เคลม daily พร้อมกันตั้งแต่ 5 request ขึ้นไปจะ deadlock ล้มทั้งหมด (แก้ไว้ 2026-07-16)
- `AUTH_SECRET` — ใช้ sign session token
- `ENABLE_DEV_LOGIN` — ตั้ง `"true"` เพื่อเปิดปุ่มบัญชีทดสอบ ถ้าไม่ตั้ง `devLoginAction`/`resetTestUserAction` จะ `notFound()` (404) และปุ่มถูกซ่อน — **ต้องไม่ตั้งใน production** (ใช้ env var นี้แทน `NODE_ENV` เพราะ preview รัน `next build && next start` ทำให้ `NODE_ENV` เป็น `production` เสมอ)

ไม่มี `PORT` ใน `.env` (ใช้ `process.env.PORT || 3000` ตาม project rule)

### Scripts สำคัญ

| Script | คำสั่ง |
|---|---|
| `npm run dev` | `next build && next start -H 0.0.0.0` |
| `npm run dev:hmr` | `next dev -H 0.0.0.0` |
| `npm run build` | `next build` |
| `npm run start` | `next start -H 0.0.0.0` |
| `npm run lint` | `eslint` |
| `npm run db:import` | `tsx prisma/import-cards.ts` |
| `npm run db:import-special` | `tsx prisma/import-special-cards.ts` |
| `npm run db:generate-achievement-clubs` | `tsx prisma/generate-achievement-clubs.ts` |
| `npm run db:dbml` | `tsx prisma/generate-dbml.ts` |
| `npm run db:reset` | `prisma migrate reset --force` |

---

## 12. Migration History

| Migration | การเปลี่ยนแปลง |
|---|---|
| `20260713100404_init` | สร้าง User, Player, Card, UserCard |
| `20260713111138_card_attributes` | เพิ่ม `category`, `altPositions`, `foot`, `skillMoves`, `weakFoot`, `indexRating` ใน Card |
| `20260713112603_pity_counter` | เพิ่ม `User.pityCounter` |
| `20260713113035_squad` | สร้าง Squad, SquadSlot |
| `20260713115720_auth_username` | ลบ `email`, `displayName`; เพิ่ม `username`, `phone` unique |
| `20260713123848_daily_login` | เพิ่ม `User.loginStreak`, `User.lastClaimDate` |
| `20260714114413_notification_center` | เพิ่ม `User.lastReadNewsAt`, สร้าง Notification, Announcement |
| `20260716084711_add_evo_prime_shards` | เพิ่ม `User.evoShards`, `User.primeShards` |
| `20260716091952_add_launch_promo_fields` | เพิ่ม `User.totalLogins`, `evoMilestoneClaimed`, `primeMilestoneClaimed`, `hasDeposited` |
| `20260717092912_add_mission_progress` | สร้าง MissionProgress |
| `20260718082658_add_pvp_fields` | เพิ่ม `User.pvpRP`, `pvpSeasonKey`, `pvpWinStreak`, `pvpMatchesToday`, `pvpMatchesDate` + **`Squad.cachedRating`** (query filter หา PvP matchmaking) |
| `20260720091455_add_achievement_progress` | สร้าง AchievementProgress + เพิ่ม `User.totalPacksOpened`, `pvpTotalWins` |
| `20260720170255_add_fantasy_core` | สร้าง Gameweek, Match, PlayerMatchStat, FantasyEntry, FantasyEntrySlot, FantasyGameweekScore, FantasyRewardGrant, FantasySettlement (Fantasy phase 7A schema เต็มก้อนเดียว) |
| `20260721075821_fantasy_slot_restrict_delete` | เปลี่ยน `FantasyEntrySlot.cardId`/`playerId` FK จาก Cascade เป็น `onDelete: Restrict` — กันลบ Card/Player ต้นทางแล้ว snapshot ที่ freeze ไว้หายเงียบๆ |
| `20260721090000_card_import_stable_identity` | เพิ่ม `@@unique([playerId, category])` บน Card และ `@@unique([name, club])` บน Player — stable identity สำหรับ card-import upsert |
| `20260722060000_fantasy_notification_idempotency` | เพิ่ม `Notification.idempotencyKey` (unique) — กัน `runScoring`/reward grant resume หลัง crash แล้วส่ง `FANTASY_SCORE`/`FANTASY_REWARD` ซ้ำ |
| `20260722110000_add_user_team_name` | เพิ่ม `User.teamName` (nullable, ไม่ unique) |
| `20260722123732_add_playermatchstat_position_group` | เพิ่ม `PlayerMatchStat.positionGroup` (freeze ตอนกรอกสถิติ เหมือน `clubSide`) + backfill ข้อมูลเดิมจาก `Player.position` ผ่าน `LEFT JOIN` (แถวกำพร้า/ตำแหน่งไม่รู้จักทำให้ migration abort ทันที ไม่ default เงียบๆ) — กัน re-import การ์ดเปลี่ยนกลุ่มตำแหน่งของ TOTW/scoring ย้อนหลัง |
| `20260724120000_unify_shards_remove_packticket` | ลบ `User.evoShards`/`User.primeShards`/`User.packTicket` รวมเข้า `User.shards` เดียว — backfill ด้วย `INSERT ... SELECT "shards" + "evoShards" + "primeShards"` ในบรรทัดเดียวตอน table-rebuild (idempotent เพราะอ่านจากตารางเก่าที่ยังมีครบ 3 คอลัมน์ ครั้งเดียว ไม่ใช่บวกทับ) |

---

## 13. หมายเหตุสำคัญสำหรับการพัฒนา

1. **ห้าม hardcode PORT**: ใช้ `process.env.PORT` เท่านั้น
2. **Port 3300 เป็นของ mycoder host server**: ห้าม bind หรือ kill process บน port นั้น
3. **Preview**: ใช้ปุ่ม Preview ในแชท ไม่ต้องเปิด browser เอง
4. **หลังแก้ schema หรือ `next.config.ts`**: ต้อง restart dev server เพราะ Prisma client และ Next config ไม่ hot-reload
5. **SQLite ไม่รองรับ native enum**: tier/position/category/notification type เก็บเป็น `String` + constants
6. **Import การ์ด normal reset catalog ทั้งหมด**: `prisma/import-cards.ts` ลบ `UserCard`, `Card`, `Player` ก่อน import เสมอ — ต่างจาก `prisma/import-special-cards.ts` ที่ลบเฉพาะการ์ด category ของตัวเองก่อน reimport (ไม่กระทบ category อื่น)
7. **Best-effort notifications**: `createNotification` catch error ไม่ throw เพื่อไม่ให้ flow หลักพัง
8. **Pack opening คืนค่าเป็น array เสมอ**: `OpenResult.cards` มี 5 ใบทุกครั้ง (ไม่ใช่การ์ดเดี่ยวแบบเดิม) — โค้ดที่อ้างอิง `result.card` แบบเก่าจะพังหมด ต้องใช้ `result.cards[0]` หรือวน loop
9. **Login milestone เป็น one-time flag ไม่ใช่ recurring**: `evoMilestoneClaimed`/`primeMilestoneClaimed` เช็คก่อนแจกทุกครั้งใน `claimDaily()` — ถ้าจะเพิ่ม milestone ใหม่ต้องเพิ่ม field ใน schema ไม่ใช่ผูกกับ `loginStreak` ที่วนซ้ำทุก 7 วัน (จะทำให้แจกซ้ำไม่จบ)
10. **Catalog เป็นโค้ด ไม่ใช่ DB**: `MISSIONS` (`missionConfig.ts`) และ `ACHIEVEMENTS` (`achievementConfig.ts`) เป็น single source of truth — เพิ่ม/แก้รายการไม่ต้อง migrate แต่ **ห้าม** เขียน key ตรงๆ ที่อื่น ต้องอ้างผ่าน `MISSION_KEYS`/`ACHIEVEMENT_KEYS` เสมอ
11. **PvP tier ไม่ store ใน DB**: derive จาก `pvpRP` ผ่าน `tierForRP()` ทุกครั้ง (แนวทางเดียวกับ `levelReward()`) — อย่าเพิ่ม column tier
12. **การเคลมทุกอย่างเป็น atomic compare-and-set**: `claimMission` ใช้ `updateMany` + เช็ค count, `claimAchievement` อาศัย `@@unique` ชน P2002, โควตา PvP ใช้ `updateMany` เช็คเงื่อนไขในตัว query — อย่าเปลี่ยนกลับเป็นอ่านแล้วค่อยเขียน แม้ SQLite จะ serialize ให้ก็ตาม (จะพังตอนย้าย DB)
13. **`getPvpStatus` ไม่ reset season**: มีแค่ `playPvpMatch` ตอนกดแข่งจริงเท่านั้นที่ทำ lazy season reset — ถ้าเพิ่มหน้าอื่นที่อ่าน PvP status อย่าให้มัน trigger reset

---

*เอกสารนี้สร้างจากโค้ดจริง หากมีการแก้ไขโค้ด ควรอัปเดตเอกสารนี้ให้สอดคล้อง*
