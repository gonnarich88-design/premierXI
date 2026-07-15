# Premier XI — Progress

อัปเดตล่าสุด: 2026-07-13 (รอบที่ 2)

เกมสะสมการ์ดนักฟุตบอลพรีเมียร์ลีก (Pack Opening + Team Building + PvP + Fantasy)
อ้างอิงดีไซน์: `gdd.txt` · แผนงานละเอียด: `docs/TASKS.md`

---

## Tech Stack
| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | SQLite + Prisma 6 |
| Styling | Tailwind CSS v4 (ธีมม่วง dark, mobile-first) |
| Auth | username + phone (สมัคร) / username + password (login), session cookie HMAC |
| รูปการ์ด | `public/card/normal/<team>/<Surname>.png` (566 ใบ, 20 ทีม) |

> รองรับ Telegram Mini App ในอนาคต · ห้าม hardcode PORT (ใช้ `process.env.PORT`)

---

## สรุปความคืบหน้า (10 ขั้น)

| ขั้น | หัวข้อ | สถานะ |
|------|--------|--------|
| 0 | Setup โครงสร้าง (Next.js+Prisma+Tailwind+nav) | ✅ เสร็จ |
| 1 | Economy & Data Model (User/Player/Card/UserCard) | ✅ เสร็จ |
| 2 | Auth & Onboarding (สมัคร/login/starter pack) | ✅ เสร็จ |
| 2.5 | Import การ์ดจริง 566 ใบ (ดึงจากรูปด้วย vision) | ✅ เสร็จ |
| 3 | Pack Opening (RNG+Pity+dup→shard+animation) | ✅ เสร็จ |
| 4 | Team Building (formation+chemistry+rating) | ✅ เสร็จ |
| 5 | สะสมแต้ม (Daily Login / Mission / Achievement) | 🔨 กำลังทำ |
| 6 | PvP + Ranking | ⬜ ยังไม่เริ่ม |
| 7 | Fantasy Premier XI | ⬜ ยังไม่เริ่ม |
| 8 | Season & Event | ⬜ ยังไม่เริ่ม |
| 9 | Admin Panel | ⬜ ยังไม่เริ่ม |
| 10 | Polish & Verify | ⬜ ยังไม่เริ่ม |

**ขั้น 5 (กำลังทำ):**
- ✅ Daily Login (streak + โบนัสวันที่ 7/30) — เช็คอินบนหน้า Home
- ⬜ Daily / Weekly Mission ← **งานถัดไป**
- ⬜ Achievement
- ⬜ Collection rewards

---

## งานที่ค้าง / รอดำเนินการ
- **[รอผู้ใช้]** กด Start Preview อีกครั้งเพื่อโหลด `next.config` ใหม่ (แก้ Server Actions ผ่าน proxy) แล้วยืนยันว่าปุ่มต่าง ๆ ใช้ได้
- **[งานถัดไป]** ทำ Mission system (Daily/Weekly) — track การกระทำ (login/เปิดซอง/จัดทีม) แล้วให้รางวัล
- **[รอไฟล์]** การ์ด special (TOTW/Hero/Icon) — ยังไม่ได้ส่งมา
- **[ก่อนจบ]** ลบโค้ด TEMP (บัญชีทดสอบ + ปุ่ม dev login)

---

## ฟีเจอร์ที่เล่นได้แล้ว (หน้าเว็บ)
- **สมัคร/เข้าสู่ระบบ** → รับ Starter Pack (11 คนสมดุล) อัตโนมัติ
- **หน้าหลัก** — currency, level/EXP, เช็คอินรายวัน, ปุ่มลัด
- **เปิดซอง** (`/pack`) — 3 ซอง (Standard/Premium/Ticket) + animation
- **คลังการ์ด** (`/collection`) — แสดงการ์ดที่มี
- **จัดทีม** (`/team`) — 4 formation + chemistry + rating
- **โปรไฟล์** (`/profile`) — ข้อมูล + ออกจากระบบ

---

## ข้อมูลสำคัญสำหรับ dev
- **Import การ์ดใหม่:** `npx tsx prisma/import-cards.ts` (อ่านจาก `data/extracted/<team>.json` + รูปใน `public/card/`)
- **Reset DB:** `npx prisma migrate reset --force` (จะ re-import การ์ดจริงอัตโนมัติผ่าน seed hook)
- **tier อนุมานจาก OVR:** Bronze ≤64 / Silver 65-74 / Gold ≥75
- **ค่าพลัง 6 ตัว** generate จาก OVR+ตำแหน่ง (`src/lib/cardgen.ts`) — เพราะไม่ได้อยู่บนหน้าการ์ด
- **หลังแก้ schema/Prisma หรือ next.config → ต้อง restart Preview** (dev server โหลด config/client ตอน start เท่านั้น ไม่ hot-reload)
- **Preview ผ่าน proxy (`mycoder-p5.knetwork.app`):** ต้องมีใน `next.config.ts` ทั้ง `allowedDevOrigins` (กัน asset ถูกบล็อก) และ `experimental.serverActions.allowedOrigins` (กัน Server Actions โดน CSRF reject 500) — ถ้าไม่มี ทุกปุ่มที่ใช้ Server Action จะพัง/จอขาว
- **ถ้า Preview ขึ้น "not running":** เช็ค orphan next-server ที่ squat พอร์ตโปรเจค (`ss -ltnp | grep :<port>`) — ถ้ามี ให้ kill by port แล้วกด Start Preview ใหม่

## TEMP (ลบเมื่อระบบเสร็จ)
- บัญชีทดสอบ: **username `test` / password `test1234`** (Silver 20k, Gold 200, Ticket 10)
- ปุ่ม "เข้าสู่ระบบด้วยบัญชีทดสอบ" ที่หน้า Home + Login (`devLoginAction`)

---

## การ์ดพิเศษ (อนาคต)
ปัจจุบันมีแต่การ์ด **normal** (Bronze/Silver/Gold) — อนาคตจะเพิ่ม **special** (TOTW/Hero/Icon/Event/Legend)
schema รองรับแล้ว (`Card.category`, `Card.tier`) · วางรูปที่ `public/card/special/...` แล้ว import ด้วย pipeline เดิม
