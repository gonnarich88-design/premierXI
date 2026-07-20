# Premier XI

เกมสะสมการ์ดนักฟุตบอลพรีเมียร์ลีกแบบ mobile-first — เปิดซองการ์ด (Gacha), จัดทีม 11 ตัวจริงพร้อมระบบ Chemistry, แข่ง PvP, ทำภารกิจและสะสม Achievement

Next.js 16 (App Router) + TypeScript · Prisma 6 + SQLite · Tailwind CSS v4 (ธีมม่วง dark)

---

## สารบัญ

1. [เอกสารของโปรเจกต์](#เอกสารของโปรเจกต์)
2. [Tech Stack](#tech-stack)
3. [ระบบที่มีในเกม](#ระบบที่มีในเกม)
4. [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
5. [การติดตั้งและเริ่มต้น](#การติดตั้งและเริ่มต้น)
6. [คำสั่งสำหรับนักพัฒนา](#คำสั่งสำหรับนักพัฒนา)
7. [บัญชีทดสอบ](#บัญชีทดสอบ)
8. [หมายเหตุสำคัญ](#หมายเหตุสำคัญ)

---

## เอกสารของโปรเจกต์

README นี้เป็น **จุดตั้งต้น** เท่านั้น รายละเอียดอยู่ในเอกสารเฉพาะทาง — อ่านจากที่นั่นเสมอ เพราะ README จะไม่ทำสำเนาตัวเลขซ้ำ (กันข้อมูลขัดกัน)

| ต้องการรู้ | อ่านที่ |
|-----------|--------|
| กลไกเกม ตัวเลข อัตราสุ่ม สูตรคำนวณ ค่า balance | **`docs/game-guide.md`** |
| สถาปัตยกรรม: schema, routes, server actions, components | **`docs/system-reference.md`** |
| Schema แบบอ่านเร็ว | `docs/database.dbml` (gen ด้วย `npm run db:dbml`) |
| แผนงาน/สถานะแต่ละขั้น | `docs/TASKS.md` |
| สรุปความคืบหน้าแบบเล่าเรื่อง | `docs/progress.md` |
| Game Design Document ต้นฉบับ | `gdd.md` |
| กฎการทำงานกับ AI agent ในโปรเจกต์นี้ | `CLAUDE.md` |

> `docs/game-guide.md` มีหัวข้อ "สรุปสิ่งที่ยกเลิกไปแล้ว" — เช็คหัวข้อนั้นก่อนอ้างอิงระบบเก่า

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5 |
| Database | SQLite + Prisma 6 |
| Styling | Tailwind CSS v4 |
| Font | Geist (next/font) |
| Auth | scrypt password hash + HMAC-signed session cookie (เขียนเอง ไม่ใช้ NextAuth) |
| Runtime | Node.js — ใช้ Server Actions เป็นหลัก ไม่มี REST API layer |

---

## ระบบที่มีในเกม

เล่นได้แล้ว:

- สมัคร/เข้าสู่ระบบ + Starter Pack แจกครั้งเดียวตอนสมัคร
- เปิดซอง 3 แบบ: **Standard** (silver), **Evolution** (gold), **Royal Prime** (gold) — เปิดทีละ 5 ใบ
- การ์ดซ้ำแปลงเป็น Shard แยก pool ตามซอง ใช้แลกเปิดซองฟรี
- จัดทีม 11 คน 4 formation + คำนวณ Chemistry / Team Rating แบบ real-time
- เช็คอินรายวันพร้อม streak และ login milestone
- **PvP** — จับคู่ตาม RP, 6 tier (Bronze → Legend), รีเซ็ตตามฤดูกาลรายเดือน, โควตาฟรีรายวัน
- **Mission** รายวัน/รายสัปดาห์ และ **Achievement** (activity / club / meta)
- Notification Center + หน้าข่าวสำหรับแอดมิน

ยังไม่ทำ: Fantasy Premier XI, Season/Event เต็มรูปแบบ (ดู `docs/TASKS.md` ขั้น 7-8)

ตัวเลขทั้งหมด (ราคา, อัตราสุ่ม, สูตรรางวัล) อยู่ใน `docs/game-guide.md`

---

## โครงสร้างโปรเจกต์

```
.
├── prisma/
│   ├── schema.prisma                    # source of truth ของ schema
│   ├── migrations/                      # ประวัติ migration
│   ├── dev.db                           # ไฟล์ SQLite (สร้างหลัง migrate)
│   ├── import-cards.ts                  # import การ์ดปกติ
│   ├── import-special-cards.ts          # import การ์ด Evolution / Royal Prime
│   ├── generate-achievement-clubs.ts    # gen achievement รายสโมสร
│   └── generate-dbml.ts                 # gen docs/database.dbml จาก schema จริง
├── data/extracted/                      # JSON ข้อมูลการ์ดที่ดึงจากรูป
├── public/card/                         # รูปการ์ด PNG แยก normal / evolution / royalprime
├── src/
│   ├── app/                             # App Router pages
│   │   ├── actions/                     # Server Actions (auth, daily, pack, squad,
│   │   │                                #   starter, pvp, missions, achievements, notifications)
│   │   ├── pack/ team/ collection/ pvp/ # หน้าเกมหลัก
│   │   ├── achievements/ notifications/ profile/
│   │   ├── login/ register/
│   │   ├── admin/news/                  # หน้าแอดมินจัดการข่าว
│   │   ├── layout.tsx  page.tsx  globals.css
│   ├── components/                      # UI ทั้งหมด (AppHeader, BottomNav, PlayerCard,
│   │                                    #   PackShop, TeamBuilder, PvpMatch, MissionList, ...)
│   └── lib/                             # business logic — ห้ามใส่ logic ใน component/route
│                                        #   pattern: <feature>.ts = logic
│                                        #            <feature>Config.ts = ตารางค่าคงที่/ค่า balance
├── docs/                                # game-guide, system-reference, TASKS, progress
│   └── database.dbml                    # schema ที่ gen จาก SQLite จริง
├── gdd.md
├── next.config.ts                       # Preview proxy origin allowlist
└── package.json
```

รายละเอียดรายไฟล์ของ `src/lib/` และ `src/components/` ดู `docs/system-reference.md`

---

## การติดตั้งและเริ่มต้น

1. ติดตั้ง dependencies

```bash
npm install
```

2. ตั้งค่า `.env` ที่ root

```env
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="เปลี่ยนเป็น random string ยาว ๆ"
ENABLE_DEV_LOGIN="true"   # เปิดปุ่มบัญชีทดสอบ — ต้องลบก่อน production
```

> **ห้ามใส่ `PORT` ใน `.env`** — ดูหัวข้อหมายเหตุสำคัญ

3. สร้างฐานข้อมูลและ Prisma Client

```bash
npx prisma migrate dev
```

4. Import การ์ดเข้าฐานข้อมูล

```bash
npm run db:import           # การ์ดปกติ
npm run db:import-special   # การ์ด Evolution / Royal Prime
```

หรือ reset ทั้งหมดแล้ว seed การ์ดปกติอัตโนมัติผ่าน seed hook

```bash
npm run db:reset
```

5. รันแอป

```bash
npm run dev
```

ในระบบ mycoder ให้กดปุ่ม **Preview** ด้านบนเพื่อดูผลลัพธ์ ไม่ต้องเปิด browser เอง

---

## คำสั่งสำหรับนักพัฒนา

| คำสั่ง | ใช้ทำอะไร |
|--------|-----------|
| `npm run dev` | `next build && next start` — **ไม่ใช่** `next dev` (ดูหมายเหตุสำคัญ) |
| `npm run dev:hmr` | `next dev` จริงพร้อม HMR — ใช้ตอนพัฒนา local เท่านั้น ห้ามใช้กับ Preview |
| `npm run build` | Build production |
| `npm run start` | รัน production server |
| `npm run lint` | รัน ESLint |
| `npm run db:import` | Import การ์ดปกติจาก `data/extracted` + `public/card/normal` |
| `npm run db:import-special` | Import การ์ด Evolution / Royal Prime |
| `npm run db:generate-achievement-clubs` | Gen achievement รายสโมสรจากข้อมูลการ์ด |
| `npm run db:dbml` | Regen `docs/database.dbml` จาก schema จริง (รันหลังแก้ schema) |
| `npm run db:reset` | Reset DB แล้ว seed การ์ดใหม่ |
| `npx prisma migrate dev` | สร้าง/ปรับ schema + migration |
| `npx prisma studio` | เปิด Prisma Studio ดูข้อมูล |

โปรเจกต์นี้ยังไม่มี test framework — การ verify คือ `npm run lint` + `npm run build` ผ่าน แล้วเช็คหน้าจอจริงบน mobile viewport

---

## บัญชีทดสอบ

เมื่อตั้ง `ENABLE_DEV_LOGIN=true` ใน `.env` หน้า Home และ Login จะมีปุ่ม **"เข้าสู่ระบบด้วยบัญชีทดสอบ"**

- Username: `test`
- Password: `test1234`

> ปุ่มนี้เป็น TEMP — ต้องปิด/ลบก่อน production (ดู `docs/TASKS.md` ขั้น 10)
> เช็คด้วย `ENABLE_DEV_LOGIN` ไม่ใช่ `NODE_ENV` เพราะ preview รันด้วย `next build && next start` ซึ่ง `NODE_ENV=production` อยู่แล้ว

---

## หมายเหตุสำคัญ

- **`npm run dev` = `next build && next start` โดยตั้งใจ** — Preview proxy cache dev-mode chunk ข้าม compilation ทำให้ hydration พังทั้งแอป (ปุ่ม client ตายหมด) ห้ามเปลี่ยน script นี้กลับเป็น `next dev`
- **ห้าม hardcode PORT** — ใช้ `process.env.PORT` เท่านั้น และห้ามใส่ `PORT` ใน `.env`
- **Port 3300 เป็นของ mycoder host server** — ห้าม bind หรือ kill process บน port นั้น
- **`next.config.ts` ต้อง allow origin `"null"`** ทั้งใน `allowedDevOrigins` และ `experimental.serverActions.allowedOrigins` เพราะ Preview ฝังใน sandboxed iframe → browser ส่ง `Origin: null` ถ้าขาดค่านี้ Server Actions จะโดน CSRF reject ทุกฟอร์ม/ทุกปุ่ม
- **หลังแก้ schema หรือ `next.config.ts` ต้อง restart** — Prisma client และ Next config ไม่ hot-reload
- **SQLite ไม่รองรับ native enum** — tier / position / category / notification type เก็บเป็น `String` และใช้ constants ใน `src/lib/constants.ts` เป็นตัวกลาง
- **Auth เขียนเอง** — อย่า install NextAuth/Auth.js มาทับ (`src/lib/auth.ts`)
