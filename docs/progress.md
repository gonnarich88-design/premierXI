# Premier XI — Progress

อัปเดตล่าสุด: 2026-07-22

เกมสะสมการ์ดนักฟุตบอลพรีเมียร์ลีก (Pack Opening + Team Building + PvP + Fantasy)
อ้างอิงดีไซน์: `gdd.md` · แผนงานละเอียด: `docs/TASKS.md` · กลไก/ตัวเลข: `docs/game-guide.md` · สถาปัตยกรรม: `docs/system-reference.md`

> ไฟล์นี้เป็น **สรุปสถานะ** เท่านั้น ตัวเลข balance และรายละเอียดกลไกอยู่ใน `docs/game-guide.md` — อย่าทำสำเนามาไว้ที่นี่

---

## Tech Stack
| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | SQLite + Prisma 6 (10 model) |
| Styling | Tailwind CSS v4 (ธีมม่วง dark, mobile-first) |
| Auth | username + phone (สมัคร) / username + password (login), session cookie HMAC — เขียนเอง ไม่ใช้ NextAuth |
| รูปการ์ด | `public/card/<category>/...` — normal 566 ใบ (20 ทีม) · evolution 44 · royalprime 44 · **รวม 654 ใบ** |

> รองรับ Telegram Mini App ในอนาคต · ห้าม hardcode PORT (ใช้ `process.env.PORT`)

---

## สรุปความคืบหน้า

| ขั้น | หัวข้อ | สถานะ |
|------|--------|--------|
| 0 | Setup โครงสร้าง (Next.js+Prisma+Tailwind+nav) | ✅ เสร็จ |
| 1 | Economy & Data Model | ✅ เสร็จ |
| 2 | Auth & Onboarding (สมัคร/login/starter pack) | ✅ เสร็จ |
| 2.5 | Import การ์ดจริง 566 ใบ (ดึงจากรูปด้วย vision) | ✅ เสร็จ |
| 3 | Pack Opening เวอร์ชันแรก | ✅ เสร็จ — **แทนที่ทั้งหมดโดยขั้น 3.5** |
| 3.5 | Pack Redesign: Standard / Evolution / Royal Prime | ✅ เสร็จ |
| 3.6 | โปรโมชั่นเปิดตัวเกม (Launch Promotion) | ✅ เสร็จ (เหลือ UI เติมเงิน) |
| 4 | Team Building (formation+chemistry+rating) | ✅ เสร็จ |
| 5 | สะสมแต้ม (Daily/Mission/Achievement/Level reward) | ✅ เสร็จ |
| 5.5 | Notification Center + Admin News | ✅ เสร็จ |
| 6 | PvP + Ranking | ✅ เสร็จ |
| 7 | Fantasy Premier XI | 🔨 กำลังทำ — 7A/7B เสร็จ, 7C (monthly + settlement)/7D (API-Football sync) ยังไม่เริ่ม |
| 8 | Season & Event | ⬜ ยังไม่เริ่ม |
| 9 | Admin Panel (เต็มรูปแบบ) | ⬜ ยังไม่เริ่ม |
| 10 | Polish & Verify | 🔨 กำลังทำ |
| 11 | Navigation redesign + My Club + ชื่อทีม | 🔨 กำลังทำ — implement เสร็จ 100% เหลือ manual browser QA |
| 12 | Fantasy hub bento redesign + fixtures/ข่าว/TOTW | 🔨 กำลังทำ — implement เสร็จ เหลือ manual browser QA |

**ขั้น 10 (กำลังทำ):**
- ✅ ตรวจ balance เศรษฐกิจ — รีวิวเต็ม 2026-07-16 แก้ไป 4 เรื่อง (Standard Gold rate, weekly Gold trickle, shard rebate gap, OVR penalty) บันทึกที่ `docs/game-guide.md` หัวข้อ 13
- ✅ ปิดช่องโหว่ dev login (gate ด้วย `ENABLE_DEV_LOGIN`)
- ✅ แก้ deadlock ตอนยิงพร้อมกัน (`?connection_limit=1` ใน `DATABASE_URL`)
- ✅ แก้ chemistry floor bug (ตัด league link ออกจากสูตร)
- ⬜ Responsive ครบทุกหน้า
- ⬜ เตรียมความเข้ากันได้กับ Telegram Mini App
- ⬜ ทดสอบ core loop end-to-end

---

## ฟีเจอร์ที่เล่นได้แล้ว (หน้าเว็บ)
- **สมัคร/เข้าสู่ระบบ** → เปิด Starter Pack เองในหน้าเปิดซอง (11 ตำแหน่งสมดุล + Silver)
- **หน้าหลัก** — currency, level/EXP, เช็คอินรายวัน + login milestone, ปุ่มลัด
- **เปิดซอง** (`/pack`) — 3 ซอง (Standard / Evolution / Royal Prime) เปิดทีละ 5 ใบ + แลก shard เปิดฟรี + animation
- **คลังการ์ด** (`/collection`) — แสดงการ์ดที่มี
- **จัดทีม** (`/team`) — 4 formation + chemistry + rating + Full Unity bonus
- **PvP** (`/pvp`) — จับคู่ผู้เล่น/บอท, 6 tier (Bronze→Legend), season รายเดือน, ฟรี 5 แมตช์/วัน
- **ภารกิจ** — daily 3 + weekly 2 แบบกดรับรางวัลเอง
- **Achievement** (`/achievements`) — activity / club / meta + collection rewards
- **แจ้งเตือน** (`/notifications`) — ข่าว + กิจกรรม, กระดิ่ง+badge บน header
- **แอดมินข่าว** (`/admin/news`) — เขียน/เผยแพร่/ลบประกาศ (gate `isAdmin`)
- **Fantasy** (`/fantasy` bento hub + subpages) — จัดทีม, ตารางแข่ง, ข่าว, weekly leaderboard, TOTW; Admin กรอกผล/ปิด Gameweek ที่ `/admin/fantasy` (monthly leaderboard + API-Football sync ยังไม่ทำ — ขั้น 7C/7D)
- **โปรไฟล์** (`/profile`) — ข้อมูล + ออกจากระบบ

---

## งานที่ค้าง / รอดำเนินการ

**บั๊กที่รู้แล้ว**
- `src/lib/pvp.ts:346` — ESLint error `prefer-const` (`matchesToday` ประกาศเป็น `let` แต่ไม่เคย reassign) ทำให้ `npm run lint` ไม่ผ่าน แก้บรรทัดเดียว

**ก่อนขึ้น production**
- ลบ `ENABLE_DEV_LOGIN` ออกจาก `.env` / ไม่ตั้งใน env ของ deploy จริง (ปุ่มบัญชีทดสอบจะซ่อนและ action จะ 404 เอง)

**รอ asset / content**
- Evolution และ Royal Prime pool ไม่มีการ์ดตำแหน่ง LB เลย (Royal Prime ไม่มี RB ด้วย) — ต้องมีรูปการ์ดใหม่ก่อน

**หนี้ทางเทคนิค**
- `MissionProgress` โตแบบ unbounded (1 แถว/มิชชั่น/รอบ/ผู้เล่น) ต้องมี cron/admin action ลบ periodKey ที่พ้นรอบเกิน ~4 สัปดาห์
- หักเงินแบบอ่านก่อนค่อย decrement ไม่มีเงื่อนไขระดับ DB — ปลอดภัยบน SQLite ตอนนี้ แต่ต้องเปลี่ยนเป็น atomic conditional update ก่อนย้าย DB

**ฟีเจอร์ที่ยังไม่ทำ**
- หน้า UI เติมเงินจริง — backend (`mockDeposit()` + First Deposit Bonus +20%) พร้อมแล้ว เหลือแค่หน้าเรียกใช้
- Pity/ตัวช่วยกันโชคร้ายสำหรับสล็อตการันตีของ Evolution/Royal Prime (optional)
- ขั้น 7C/7D Fantasy (monthly leaderboard + FantasySettlement, API-Football sync) · ขั้น 8 Season & Event · ขั้น 9 Admin Panel เต็มรูปแบบ

---

## ข้อมูลสำคัญสำหรับ dev
- **Import การ์ด:** `npm run db:import` (normal) · `npm run db:import-special` (Evolution/Royal Prime)
- **Reset DB:** `npm run db:reset` — re-import การ์ด normal อัตโนมัติผ่าน seed hook (การ์ดพิเศษต้องสั่ง import เอง)
- **ดู schema เร็ว ๆ:** `docs/database.dbml` (regen ด้วย `npm run db:dbml` หลังแก้ schema)
- **`npm run dev` = `next build && next start`** โดยตั้งใจ — Preview proxy cache dev-mode chunk ข้าม compilation ทำให้ hydration พังทั้งแอป ห้ามเปลี่ยนกลับเป็น `next dev`
- **ค่าพลัง 6 ตัว** generate จาก OVR+ตำแหน่ง (`src/lib/cardgen.ts`) — เพราะไม่ได้อยู่บนหน้าการ์ด
- **หลังแก้ schema/Prisma หรือ next.config → ต้อง restart Preview** (โหลดตอน start เท่านั้น ไม่ hot-reload)
- **Preview ผ่าน proxy (`mycoder-p5.knetwork.app`):** ต้องมีใน `next.config.ts` ทั้ง `allowedDevOrigins` และ `experimental.serverActions.allowedOrigins` รวมถึง origin `"null"` (sandboxed iframe) — ถ้าไม่มี ทุกปุ่มที่ใช้ Server Action จะพัง/จอขาว
- **ถ้า Preview ขึ้น "not running":** เช็ค orphan next-server ที่ squat พอร์ตโปรเจค (`ss -ltnp | grep :<port>`) — ถ้ามี ให้ kill by port แล้วกด Start Preview ใหม่ (อย่าใช้ `lsof`/`pkill node` — ดู CLAUDE.md หัวข้อ HOST PROTECTION)

## TEMP (ลบเมื่อระบบเสร็จ)
- บัญชีทดสอบ: **username `test` / password `test1234`** (ใช้ได้เมื่อตั้ง `ENABLE_DEV_LOGIN=true`)
- ปุ่ม "เข้าสู่ระบบด้วยบัญชีทดสอบ" ที่หน้า Home + Login (`devLoginAction`, `resetTestUserAction`)
