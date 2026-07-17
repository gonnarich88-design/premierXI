# Premier XI — System Reference

เอกสารอ้างอิงโครงสร้างระบบ สร้างจากโค้ดจริงใน repository วันที่ 2026-07-15 อัปเดตล่าสุด 2026-07-16 (Pack redesign + Launch promotion) ใช้สำหรับอ่านก่อนแก้ไข/ต่อเติม feature ใด ๆ

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
- Duplicate → shards แยก 3 pool (shards/evoShards/primeShards) แลกเปิดซองฟรีได้ (Shard Exchange)
- Launch promotion: login สะสมครบ 15/30 วัน แจก Evolution/Royal Prime pack ฟรีครั้งเดียว, weekly gold trickle, First Deposit Bonus +20%
- คลังการ์ด (`/collection`)
- จัดทีม 11 คน (`/team`) พร้อม formation, chemistry, rating
- เช็คอินรายวัน (`DailyClaim` ในหน้า `/`)
- Notification Center (`/notifications`) + Announcement admin (`/admin/news`)

---

## 2. โครงสร้างไฟล์

```
.
├── docs/
│   ├── TASKS.md                 # แผนงานทั้งหมด (checklist)
│   ├── progress.md              # สรุปความคืบหน้า
│   └── system-reference.md      # เอกสารฉบับนี้
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── import-cards.ts          # Script import การ์ด normal จากรูป + JSON (20 ทีม)
│   ├── import-special-cards.ts  # Script import การ์ด Evolution/Royal Prime (ไม่มีโฟลเดอร์ทีมย่อย)
│   ├── dev.db                   # SQLite database
│   └── migrations/              # Migration files
├── data/extracted/              # JSON ข้อมูลการ์ด 20 ทีม + evolution.json + royalprime.json
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
│   │   ├── team/page.tsx        # จัดทีม
│   │   ├── collection/page.tsx  # คลังการ์ด
│   │   ├── pack/page.tsx        # เปิดซอง
│   │   ├── pvp/page.tsx         # PvP placeholder
│   │   ├── notifications/page.tsx # Notification center
│   │   ├── admin/news/page.tsx  # Admin จัดการข่าว
│   │   └── actions/             # Server Actions
│   │       ├── auth.ts
│   │       ├── daily.ts
│   │       ├── pack.ts
│   │       ├── squad.ts
│   │       ├── starter.ts
│   │       └── notifications.ts
│   ├── components/
│   │   ├── AuthForm.tsx
│   │   ├── AppHeader.tsx
│   │   ├── BottomNav.tsx
│   │   ├── DailyClaim.tsx
│   │   ├── PackShop.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── StarterPackModal.tsx
│   │   └── TeamBuilder.tsx
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
│       ├── notifications.ts     # Notification center logic
│       ├── packs.ts             # Pack config + open pack RNG + pity
│       ├── prisma.ts            # PrismaClient singleton
│       ├── squad.ts             # Squad CRUD
│       └── starter.ts           # Starter pack distribution
├── next.config.ts               # Preview proxy origin allowlist
├── package.json
├── tsconfig.json
└── gdd.txt                      # Game Design Document
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
| `phone` | `String` | - | Unique, ใช้สมัคร |
| `passwordHash` | `String` | - | `salt:hash` จาก scrypt |
| `isAdmin` | `Boolean` | `false` | Gate หน้า `/admin/news` |
| `level` | `Int` | `1` | Level ผู้เล่น |
| `exp` | `Int` | `0` | EXP ปัจจุบัน |
| `silver` | `Int` | `0` | สกุลเงิน Silver |
| `gold` | `Int` | `0` | สกุลเงิน Gold |
| `packTicket` | `Int` | `0` | Pack Ticket — เดิมใช้เปิด Ticket Pack, ยกเลิก pack นั้นแล้ว ไม่แจกเพิ่มอีก (เก็บ field ไว้เผื่ออนาคต) |
| `shards` | `Int` | `0` | Shard จากการ์ดซ้ำ tier Bronze/Silver/Gold (Standard pack) |
| `evoShards` | `Int` | `0` | Shard จากการ์ดซ้ำ tier Hero (Evolution pack) |
| `primeShards` | `Int` | `0` | Shard จากการ์ดซ้ำ tier Legend (Royal Prime pack) |
| `pityCounter` | `Int` | `0` | **ไม่ได้ใช้แล้ว** หลังยกเลิก Premium pack (เก็บ field ไว้เผื่ออนาคต) |
| `loginStreak` | `Int` | `0` | Streak เช็คอินรายวัน (รีเซ็ตถ้าขาด 1 วัน) — ใช้คำนวณ silver/gold รายวัน |
| `lastClaimDate` | `DateTime?` | - | วันล่าสุดที่เคลม daily |
| `totalLogins` | `Int` | `0` | จำนวนวันที่เคย login รวม (**ไม่รีเซ็ต** แม้ streak ขาด) — ใช้เช็ค login milestone 15/30 วัน |
| `starterClaimed` | `Boolean` | `false` | รับ Starter Pack แล้วหรือยัง |
| `evoMilestoneClaimed` | `Boolean` | `false` | รับ Evolution Pack ฟรีจาก login milestone (15 วัน) แล้วหรือยัง — ครั้งเดียวตลอดไป |
| `primeMilestoneClaimed` | `Boolean` | `false` | รับ Royal Prime Pack ฟรีจาก login milestone (30 วัน) แล้วหรือยัง — ครั้งเดียวตลอดไป |
| `hasDeposited` | `Boolean` | `false` | เติมเงินจริงมาแล้วหรือยัง — กัน First Deposit Bonus ใช้ซ้ำ |
| `lastReadNewsAt` | `DateTime?` | - | ใช้คำนวณ unread news |
| `createdAt` | `DateTime` | `now()` | - |
| `lastLoginAt` | `DateTime?` | - | - |

Relations:

- `cards` → `UserCard[]`
- `squad` → `Squad?` (1-to-1)
- `notifications` → `Notification[]`
- `announcements` → `Announcement[]` (as author)

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
| `createdAt` | `DateTime` | `now()` | - |

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
| `createdAt` | `DateTime` | `now()` | - |

Indexes: `@@index([tier])`, `@@index([category])`

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
| `updatedAt` | `DateTime` | `@updatedAt` | - |

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

---

## 4. Routes / Pages

| Route | File | ประเภท | Login required | Admin only | Server Actions ที่ใช้ |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Page | No | No | `devLoginAction`, `resetTestUserAction` |
| `/login` | `src/app/login/page.tsx` | Page | Redirect ถ้า login | No | `loginAction`, `devLoginAction`, `resetTestUserAction` |
| `/register` | `src/app/register/page.tsx` | Page | Redirect ถ้า login | No | `registerAction` |
| `/profile` | `src/app/profile/page.tsx` | Page | Yes | No | `logoutAction` |
| `/team` | `src/app/team/page.tsx` | Page | No | No | `setFormationAction`, `assignSlotAction` |
| `/collection` | `src/app/collection/page.tsx` | Page | Yes | No | - |
| `/pack` | `src/app/pack/page.tsx` | Page | Yes | No | - |
| `/pvp` | `src/app/pvp/page.tsx` | Page | No | No | - |
| `/notifications` | `src/app/notifications/page.tsx` | Page | Yes | No | - |
| `/admin/news` | `src/app/admin/news/page.tsx` | Page | Yes | Yes | `createAnnouncementAction`, `toggleAnnouncementAction`, `deleteAnnouncementAction` |

หมายเหตุ: หน้า `/team` ปัจจุบันไม่ได้ redirect ถ้าไม่ login แต่ `TeamBuilder` จะไม่มี ownedCards และกดเลือกการ์ดไม่ได้จริง

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
| `createAnnouncementAction` | `(formData: FormData) => Promise<void>` | Admin สร้างข่าว |
| `toggleAnnouncementAction` | `(formData: FormData) => Promise<void>` | Admin toggle published |
| `deleteAnnouncementAction` | `(formData: FormData) => Promise<void>` | Admin ลบข่าว |

ทั้งสามตัวตรวจสอบ `isAdmin` ผ่าน `requireAdmin()`

---

## 6. Components

### 6.1 `src/components/AuthForm.tsx`

- Type: Client component (`"use client"`)
- Props: `{ mode: "login" | "register"; action: (prev, formData) => Promise<AuthState> }`
- Hook: `useActionState<AuthState, FormData>`
- แสดงฟอร์ม username / phone / password ตาม mode

### 6.2 `src/components/AppHeader.tsx`

- Type: Server component
- Props: `{ unread: number }`
- แสดงโลโก้, กระดิ่งแจ้งเตือนพร้อม badge, ปุ่ม logout
- เรียก `logoutAction`

### 6.3 `src/components/BottomNav.tsx`

- Type: Client component
- แถบนำทาง 5 ปุ่ม: หน้าหลัก, เปิดซอง, จัดทีม, PvP, โปรไฟล์
- Highlight ตาม `usePathname`

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
- Props หลัก: `{ formation; formations: string[]; slots: Slot[]; ownedCards: OwnedCard[]; rating; teamChem; filled }`
- เรียก `setFormationAction`, `assignSlotAction`
- Import จาก lib: `POSITION_GROUP`, `Position`, `MAX_TEAM_CHEM`
- แสดงสนาม, เปลี่ยน formation, เปิด bottom sheet เลือกการ์ด

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
| `CURRENCIES` | `["silver","gold","packTicket","shards","evoShards","primeShards"]` | - |
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

Shard Exchange (แยก pool ตามที่มา กันเอา shard ถูกไปแลกซองแพง):

| Exchange ID | ใช้ field | Cost | แลกได้ |
|---|---|---|---|
| `standard` | `shards` | 600 | Standard Pack ฟรี 1 ครั้ง |
| `evolution` | `evoShards` | 500 | Evolution Pack ฟรี 1 ครั้ง |
| `royalprime` | `primeShards` | 1,000 | Royal Prime Pack ฟรี 1 ครั้ง |

Flow `resolvePackCards` (ใช้ร่วมกันทั้ง `openPack`/`openPackWithShards`/`grantFreePack`):

1. ถ้า pack ไม่มี `special` (Standard) → สุ่ม 5 ใบอิสระจากพูล normal ด้วย `fillerRates`
2. ถ้ามี `special` (Evolution/Royal Prime) → สุ่ม 1 ใบจากพูล special (uniform) การันตีเสมอ, สุ่ม `Math.random() < bonusChance` เพื่อเพิ่มใบที่ 2 จากพูลเดียวกัน, ที่เหลือเติมจากพูล normal ด้วย `fillerRates`

Flow `finalizeOpen` (เช็ค duplicate + แจก shard + EXP ต่อการเปิด 1 ครั้ง ไม่ใช่ต่อใบ):

1. วนทุกใบที่สุ่มได้ เช็ค duplicate จาก `UserCard`
2. ไม่ซ้ำ → create `UserCard`; ซ้ำ → เพิ่ม shard field ตาม tier (`Bronze/Silver/Gold → shards`, `Hero → evoShards`, `Legend → primeShards`) ด้วยค่าจาก `SHARD_VALUE`
3. เพิ่ม EXP คงที่ 20 หน่วยต่อการเปิด 1 ครั้ง (ไม่ใช่ต่อใบ) และ level-up ถ้าถึง
4. return `{ cards: OpenedCard[], leveledUp, level }`

`openPack`/`openPackWithShards` ครอบด้วย `prisma.$transaction` ของตัวเอง (หัก currency/shard ก่อนแล้วค่อยสุ่ม+finalize); `grantFreePack` รับ `tx` จากผู้เรียกเพื่อ atomic ร่วมกับ logic อื่น (เช่น `claimDaily`)

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

### 7.12 `src/lib/daily.ts` — เขียนใหม่ 2026-07-16 (เพิ่ม gold trickle + login milestone, ไม่แจก packTicket แล้ว)

| Export | ประเภท/Signature | รายละเอียด |
|---|---|---|
| `DailyReward` | type | `{ day, silver, exp, packTicket, gold }` — `packTicket` คงไว้ใน type เพื่อ backward-compat แต่ค่าจริงเป็น `0` เสมอ |
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
- `packTicket = 0` เสมอ (เลิกแจกแล้ว)
- `gold = (day === 7 ? 2 : 0) + (streak % 30 === 0 ? 5 : 0)` — เพิ่ม weekly trickle +2 ให้ F2P เข้าถึง Evolution/Royal Prime เร็วขึ้น

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
| `getOrCreateSquad` | `(userId: string)` | หรือสร้าง Squad พร้อม 11 SquadSlot |
| `setFormation` | `(userId: string, formation: string)` | เปลี่ยน formation |
| `assignSlot` | `(userId: string, index: number, cardId: string \| null)` | ใส่/ถอดการ์ด |

`assignSlot` behavior:

- ตรวจ index 0-10
- ถ้าใส่การ์ด ตรวจสอบว่าเป็นเจ้าของผ่าน `UserCard`
- ถ้าการ์ดนี้อยู่ช่องอื่นในทีมเดียวกัน จะย้ายออกก่อน (updateMany `cardId: null`)

### 7.14 `src/lib/notifications.ts`

| Export | Signature | รายละเอียด |
|---|---|---|
| `createNotification` | `(input: {userId, type, title, body?, href?})` | สร้าง Notification แบบ best-effort (catch ไม่ throw) |
| `getUnreadCount` | `(userId: string): Promise<number>` | `unreadNotifs + unreadNews` |
| `NotificationItem` | type | - |
| `NewsItem` | type | - |
| `getNotificationCenter` | `(userId): Promise<{news, notifications}>` | ดึงข่าว + noti ล่าสุด |
| `markAllRead` | `(userId: string): Promise<void>` | อัปเดต noti เป็น read + ตั้ง `lastReadNewsAt` |

`getUnreadCount`:

- `unreadNotifs = count Notification where userId, read=false`
- `unreadNews = count Announcement where published=true, createdAt > lastReadNewsAt`

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
| PvP Matchmaking | ยังไม่ทำ | หน้า `/pvp` เป็น placeholder |
| PvP Result Calculation | ยังไม่ทำ | มีแนวคิดใน TASKS.md |
| Ranking Tiers | ยังไม่ทำ | Bronze → Legend |
| Daily/Weekly Missions | **ทำแล้ว** (ขั้น 5) | `src/lib/missionConfig.ts`/`missions.ts` + `MissionList.tsx` — 3 daily + 2 weekly ผูก action จริง |
| Achievements | ยังไม่ทำ | - |
| Collection Rewards | ยังไม่ทำ | ครบทีม/ชาติ/ลีก/Big6 (หน้า Collection แสดงการ์ดทำแล้ว มีแค่ reward ที่ยังไม่ทำ) |
| Level Milestone Rewards | **ทำแล้ว** (ขั้น 5) | `applyExp()`/`levelReward()` ใน `src/lib/economy.ts` — ทุกเลเวลได้ Silver, ทุก 5/10/25 เลเวลแถม Pack ฟรี (+Gold) |
| Cosmetic System | ยังไม่ทำ | - |
| Fantasy Premier XI | ยังไม่ทำ | Phase 4 |
| Season / Event | ยังไม่ทำ | Phase 8 |
| Admin Panel สมบูรณ์ | ยังไม่ทำ | มีแค่ `/admin/news` |
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
- ปุ่ม "เข้าสู่ระบบด้วยบัญชีทดสอบ" อยู่ที่หน้า Home และ Login
- ปุ่ม "เริ่มใหม่" ลบบัญชี test แล้วสร้างใหม่ (simulate ครั้งแรก, cascade ลบการ์ด/ทีมเดิมหมด)
- ทั้งหมดเป็น TEMP และจะลบก่อน production

---

## 11. Configuration สำคัญ

### `next.config.ts`

- `allowedDevOrigins`: `["null", "mycoder-p5.knetwork.app", "*.knetwork.app"]`
- `experimental.serverActions.allowedOrigins`: เหมือนกัน
- ใช้เพื่อให้ Preview ผ่าน proxy ของ mycoder ทำงานได้ (sandboxed iframe ส่ง Origin: null)

### Environment Variables

- `DATABASE_URL` — เช่น `file:./prisma/dev.db`
- `AUTH_SECRET` — ใช้ sign session token

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

---

*เอกสารนี้สร้างจากโค้ดจริง หากมีการแก้ไขโค้ด ควรอัปเดตเอกสารนี้ให้สอดคล้อง*
