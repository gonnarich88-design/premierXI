# Premier XI

เกมสะสมการ์ดนักฟุตบอลพรีเมียร์ลีกแบบ mobile-first ที่ผู้เล่นสามารถเปิดซองการ์ด (Gacha), จัดทีม 11 ตัวจริง, เชื่อมเคมีทีม และเช็คอินรับรางวัลรายวันได้

โปรเจกต์นี้เป็น [Next.js](https://nextjs.org) App Router + TypeScript ใช้ Prisma กับ SQLite เป็นฐานข้อมูลหลัก และ Tailwind CSS v4 สำหรับธีมสีม่วง dark

---

## สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [Tech Stack](#tech-stack)
3. [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
4. [การติดตั้งและเริ่มต้น](#การติดตั้งและเริ่มต้น)
5. [ขั้นตอนการใช้งาน](#ขั้นตอนการใช้งาน)
6. [คำอธิบายระบบย่อย](#คำอธิบายระบบย่อย)
7. [คำสั่งสำหรับนักพัฒนา](#คำสั่งสำหรับนักพัฒนา)
8. [บัญชีทดสอบ](#บัญชีทดสอบ)
9. [หมายเหตุสำคัญ](#หมายเหตุสำคัญ)

---

## ภาพรวมระบบ

Premier XI เป็นเกมสะสมการ์ดฟุตบอลที่ผู้เล่นจะได้รับการ์ดนักเตะ, สะสมเงินสกุลต่าง ๆ และจัดทีมของตัวเอง ระบบหลักที่เล่นได้แล้วประกอบด้วย

- สมัคร/เข้าสู่ระบสู่ระบบ (session cookie แบบ HMAC-signed)
- แจก **Starter Pack** อัตโมัติตอนสมัครครั้งแรก (11 ใบ + Silver 300 + Ticket 1)
- เปิดซอง 3 ประเภท: Standard, Premium, Ticket Pack
- ระบบ Pity (การันตี Gold ทุก 10 ครั้งในซอง Premium)
- การ์ดซ้ำแปลงเป็น **Shards** ตาม tier
- จัดทีม 11 คนพร้อมเลือก Formation (4-3-3 / 4-4-2 / 3-5-2 / 4-2-3-1)
- คำนวณ **Chemistry** จากสโมสร, ชาติ, ลีก และตำแหน่ง
- เช็คอินรายวัน (Daily Login) พร้อม streak และโบนัสวันที่ 7/30
- คลังการ์ดของผู้เล่น

ฟีเจอร์ที่ยู่อยู่ในแผนงาน: PvP Matchmaking, Fantasy Premier XI, Mission/Achievement, Season/Event และ Admin Panel

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5 |
| Database | SQLite + Prisma 6 |
| Styling | Tailwind CSS v4 |
| Font | Geist (next/font) |
| Auth | Password hashing ด้วย Node scrypt + signed session cookie |
| Runtime | Node.js (ใช้ Server Actions เป็นหลัก) |

---

## โครงสร้างโปรเจกต์

```
.
├── prisma/
│   ├── schema.prisma        # Prisma schema (User/Player/Card/UserCard/Squad/SquadSlot)
│   ├── import-cards.ts      # Script import การ์ดจากรูป + extracted JSON
│   ├── migrations/          # Migration ประวัติ
│   └── dev.db               # ไฟล์ SQLite (สร้างหลัง migrate)
├── data/extracted/          # JSON ข้อมูลการ์ดที่ดึงจากรูป (20 ทีม ~566 ใบ)
├── public/card/normal/      # รูปการ์ด PNG จริง (20 ทีม)
├── src/
│   ├── app/                 # App Router pages + Server Actions
│   │   ├── actions/         # auth.ts, daily.ts, pack.ts, squad.ts
│   │   ├── collection/      # คลังการ์ด
│   │   ├── login/           # หน้าเข้าสู่ระบบ
│   │   ├── pack/            # หน้าเปิดซอง
│   │   ├── profile/         # โปรไฟล์ผู้ใช้
│   │   ├── register/        # หน้าสมัครสมาชิก
│   │   ├── team/            # หน้าจัดทีม
│   │   ├── pvp/             # หน้า PvP (placeholder)
│   │   ├── layout.tsx       # Root layout + BottomNav
│   │   ├── page.tsx         # หน้าหลัก
│   │   └── globals.css      # Tailwind theme + animation
│   ├── components/          # React components (client/server)
│   │   ├── AuthForm.tsx
│   │   ├── BottomNav.tsx
│   │   ├── DailyClaim.tsx
│   │   ├── PackShop.tsx
│   │   ├── PlayerCard.tsx
│   │   └── TeamBuilder.tsx
│   └── lib/                 # Utilities / services
│       ├── auth.ts          # Session + password hashing
│       ├── cardgen.ts       # Derive tier + generate stats 6 ตัว
│       ├── chemistry.ts     # คำนวณ chemistry
│       ├── clubs.ts         # Map ชื่อโฟลเดอร์ -> ชื่อสโมสร
│       ├── constants.ts     # Constants (tier, position, currency)
│       ├── daily.ts         # Daily login logic
│       ├── economy.ts       # Add/spend currency + EXP/level up
│       ├── formations.ts    # Formation definitions + slot coordinates
│       ├── packs.ts         # Pack config + open pack RNG + pity
│       ├── prisma.ts        # PrismaClient singleton
│       ├── squad.ts         # Squad CRUD
│       └── starter.ts       # Starter pack distribution
├── docs/
│   ├── TASKS.md             # แผนงานทั้งหมดเป็น checklist
│   └── progress.md          # สรุปความคืบหน้า
├── next.config.ts           # Preview proxy origin allowlist
├── package.json
└── README.md
```

---

## การติดตั้งและเริ่มต้น

1. ติดตั้ง dependencies

```bash
npm install
```

2. ตั้งค่า environment ในไฟล์ `.env` ที่ root

```env
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="เปลี่ยนเป็น random string ยาว ๆ"
```

3. สร้างฐานข้อมูลและ Prisma Client

```bash
npx prisma migrate dev
```

4. Import การ์ดจริง (~566 ใบ) เข้าฐานข้อมูล

```bash
npx tsx prisma/import-cards.ts
```

หรือใช้คำสั่ง shortcut ที่ตั้งไว้

```bash
npm run db:import
```

หากต้องการ reset ฐานข้อมูลใหม่ทั้งหมดแล้ว import การ์ดอัตโนมัติผ่าน seed hook

```bash
npx prisma migrate reset --force
```

หรือ

```bash
npm run db:reset
```

5. รัน dev server

```bash
npm run dev
```

ในระบบ mycoder ให้กดปุ่ม **Preview** ด้านบนเพื่อดูผลลัพธ์ ไม่ต้องเปิด browser เอง

---

## ขั้นตอนการใช้งาน

### 1. สมัครสมาชิก

- เปิดหน้า `/register`
- กรอก
  - **Username**: ภาษาอังกฤษ/ตัวเลข/ขีดล่าง ความยาว 3-20 ตัว
  - **เบอร์โทร**: เบอร์ไทย 10 หลัก เช่น `0812345678`
  - **รหัสผ่าน**: อย่างน้อย 6 ตัว
- กด "สมัครสมาชิก"
- ระบบจะล็อกอินอัตโมัติและแจก **Starter Pack** 11 ใบ + Silver 300 + Pack Ticket 1

### 2. หน้าหลัก (Home)

- แสดงยอดเงินทั้งหมด (Silver / Gold / Ticket / จำนวนการ์ด)
- แสดง Level / EXP bar (ต้องการ EXP = level * 100 ต่อเลเวล)
- ปุ่ม **เช็คอินรายวัน**: รับ Silver/EXP/Ticket/Gold ตาม streak
- ปุ่มลัดไปหน้าเปิดซอง และหน้าจัดทีม

### 3. เปิดซอง (Pack)

ไปที่หน้า `/pack` มีซองให้เลือกดังนี้

| ซอง | สกุลเงิน | ราคา | อัตราสุ่ม | พิเศษ |
|-----|----------|------|-----------|-------|
| Standard Pack | Silver | 300 | Bronze 55% / Silver 38% / Gold 7% | - |
| Premium Pack | Gold | 5 | Bronze 10% / Silver 50% / Gold 40% | Pity 10 ครั้ง การันตี Gold |
| Ticket Pack | Pack Ticket | 1 | Bronze 50% / Silver 40% / Gold 10% | - |

หลังกดเปิดซองจะมี animation ซองสั่นแล้ว reveal การ์ด
- ถ้าได้การ์ดใหม่จะเข้าคลัง
- ถ้าซ้ำจะได้ **Shards** แทน (Bronze=5 / Silver=15 / Gold=50)
- ทุกครั้งที่เปิดซองจะได้ EXP 20 หน่วย

### 4. คลังการ์ด (Collection)

- ไปที่หน้า `/collection`
- แสดงการ์ดทั้งหมดที่ผู้เล่นถือครองเรียงตาม OVR สูง -> ต่ำ
- สามารถกดไปหน้าเปิดซองได้ถ้ายังไม่มีการ์ด

### 5. จัดทีม (Team)

ไปที่หน้า `/team`

1. เลือก **Formation** จากแท็บด้านบน:
   - 4-3-3
   - 4-4-2
   - 3-5-2
   - 4-2-3-1
2. แตะช่องบนสนามเพื่อเปิด sheet เลือกการ์ด
3. เลือกการ์ดจากคลังที่ต้องการลง
   - การ์ดที่ตรงตำแหน่งจะมีขอบสี accent
   - การ์ดที่ใช้ในทีมแล้วจะถูกกันไม่ให้เลือกซ้ำ
4. ระบบจะคำนวณค่า Chemistry และ Team Rating แบบ real-time
   - Chemistry สูงสุด 33 คะแนน
   - Rating = avgOVR ปรับขึ้นสูงสุด ~10% ตาม chemistry

### 6. โปรไฟล์ (Profile)

- ไปที่หน้า `/profile`
- แสดงข้อมูลบัญชี, ยอดเงินทุกสกุล, level, exp, จำนวนการ์ด
- มีปุ่มไปคลังการ์ดและปุ่มออกจากระบบ

### 7. การนำทางหลัก

แถบ navigation ด้านล่างประกอบด้วย

- หน้าหลัก
- เปิดซอง
- จัดทีม
- PvP (อยู่ระหว่างพัฒนา)
- โปรไฟล์

---

## คำอธิบายระบบย่อย

### Authentication

- Password hash ด้วย Node.js `scrypt` + salt แบบ `salt:hash`
- Session เป็น HMAC-signed token เก็บใน httpOnly cookie
- `AUTH_SECRET` ใช้เซ็น token ต้องตั้งค่าใน production

### Economy

สกุลเงินทั้งหมด:

| สกุล | ใช้ทำอะไร |
|------|-----------|
| Silver | เปิด Standard Pack |
| Gold | เปิด Premium Pack, ซื้อตั๋ว PvP (อนาคต) |
| Pack Ticket | เปิด Ticket Pack |
| Shards | ได้จากการ์ดซ้ำ ใช้ในระบบอนาคต |

ฟังก์ชันหลัก:
- `addCurrency()` / `spendCurrency()` มี guard กันยอดติดลบ
- `grantExp()` ให้ EXP และเลื่อน level อัตโมัติ
- `mockDeposit()` แปลงเงินบาทเป็น Gold (mock) อัตรา 100 บาท = 10 Gold

### Pack Opening

- ใช้ `Math.random()` สุ่ม tier ตามน้ำหนัก
- Pity counter นับเฉพาะซองที่มี `pityThreshold` (Premium)
- เมื่อได้ Gold จะ reset pity counter เป็น 0
- Duplicate จะไม่สร้าง `UserCard` ซ้ำ แต่เพิ่ม shards แทน

### Chemistry

- คำนวณจาก link ระหว่างผู้เล่นในทีม
  - เพื่อนร่วมสโมสร +2
  - เพื่อนร่วมชาติ +1
  - เพื่อนร่วมลีก +0.5
- แปลงคะแนน link เป็น 0-3 ต่อผู้เล่น
- คูณ factor ตำแหน่ง
  - ลงตรงตำแหน่งหลัก/รอง: 1.0
  - ลงกลุ่มเดียวกัน (DEF/MID/ATT): 0.6
  - ลงผิดกลุ่ม: 0.3
- `teamChem` = ผลรวม chemistry ทุกช่อง (สูงสุด 33)
- `rating = round(avgOVR * (1 + teamChem / 330))`

### Card Import Pipeline

1. วางรูปการ์ดที่ `public/card/normal/<team>/<Surname>.png`
2. สร้าง/อัปเดตไฟล์ `data/extracted/<team>.json` ด้วยข้อมูลที่ดึงจากรูป
3. รัน `npx tsx prisma/import-cards.ts`
4. Script จะสร้าง Player/Card ใหม่ทั้งหมด (reset catalog)

 tier อนุมาจาก OVR:

- Bronze: OVR <= 64
- Silver: OVR 65-74
- Gold: OVR >= 75

ค่าพลัง 6 ตัว (pace/shooting/passing/dribbling/defending/physical) ถูก generate แบบ deterministic จาก OVR + ตำแหน่ง

---

## คำสั่งสำหรับนักพัฒนา

| คำสั่ง | ใช้ทำอะไร |
|--------|-----------|
| `npm run dev` | รัน dev server (bind 0.0.0.0) |
| `npm run build` | Build production |
| `npm run start` | รัน production server |
| `npm run lint` | รัน ESLint |
| `npm run db:import` | Import การ์ดจาก `data/extracted` + `public/card` |
| `npm run db:reset` | Reset DB แล้ว seed การ์ดใหม่ |
| `npx prisma migrate dev` | สร้าง/ปรับ schema + migration |
| `npx prisma studio` | เปิด Prisma Studio ดูข้อมูล |

---

## บัญชีทดสอบ

สำหรับการทดสอบในระหว่างพัฒนา หน้า Home และ Login มีปุ่ม **"เข้าสู่ระบบด้วยบัญชีทดสอบ"**

- Username: `test`
- Password: `test1234`
- ยอดเริ่มต้น: Silver 20,000 / Gold 200 / Ticket 10

> ปุ่มนี้เป็น TEMP และจะถูกลบก่อน production

---

## หมายเหตุสำคัญ

- **ห้าม hardcode PORT**: ใช้ `process.env.PORT` เท่านั้น (ดูใน `package.json` scripts)
- **Port 3300 เป็นของ mycoder host server**: ห้าม bind หรือ kill process บน port นั้น
- **Preview**: ใน mycoder ให้กดปุ่ม Preview ด้านบน ไม่ต้องเปิด localhost เอง
- **next.config.ts**: มี `allowedDevOrigins` และ `experimental.serverActions.allowedOrigins` สำหรับ preview proxy (`mycoder-p5.knetwork.app` และ `null` origin จาก sandboxed iframe) หากขาดค่านี้ Server Actions จะโดน CSRF reject ในหน้า preview
- **หลังแก้ schema หรือ `next.config.ts`**: ต้อง restart dev server เพราะ Prisma client และ Next config ไม่ hot-reload
- SQLite ไม่รองรับ native enum จึงเก็บ tier/position/category เป็น `String` และใช้ constants ใน `src/lib/constants.ts` เป็นตัวกลาง

---

## แหล่งข้อมูลเพิ่มเติม

- แผนงานละเอียด: `docs/TASKS.md`
- สรุปความคืบหน้า: `docs/progress.md`
- Game Design Document: `gdd.txt`
