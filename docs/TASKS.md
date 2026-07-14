# Premier XI — Task Board

เกมสะสมการ์ดนักฟุตบอลพรีเมียร์ลีก (Pack Opening + Team Building + PvP + Fantasy)

**Stack:** Next.js (App Router, TypeScript) · Prisma · SQLite · Tailwind CSS · Mobile-first
**ธีม:** สีม่วง (อิงเว็บหลัก) · เผื่อไป Telegram Mini App
**หลักการ:** ทำทีละ Phase · ผลบอลกรอกผ่าน Admin · payment เป็น mock ก่อน

---

## ขั้น 0 — Setup โครงสร้าง
- [x] Scaffold Next.js (TypeScript + Tailwind + App Router + src/)
- [x] ติดตั้ง Prisma + SQLite และตั้งค่า schema เปล่า
- [x] ตั้งค่า Tailwind theme สีม่วง + mobile-first layout (base container กว้างแบบมือถือ)
- [x] สร้างโฟลเดอร์ `public/cards/` สำหรับรูปการ์ด + README naming convention
- [x] ตรวจ build ผ่าน (`next build`) และยืนยันใช้ `process.env.PORT` (ไม่ hardcode port)
- [x] Layout หลัก: bottom navigation bar (Home / Pack / Team / PvP / Profile)

## ขั้น 1 — Phase 0: Economy & Data Model
- [x] ออกแบบ Prisma schema: User (+currencies), Player, Card, UserCard
- [x] กำหนดค่า tier/position เป็น String (SQLite ไม่รองรับ enum) + constants กลาง
- [x] Migrate สร้าง dev.db + Prisma client singleton
- [x] Seed ข้อมูลนักเตะ Big 6 (41 players / 45 cards / 11 starter)
- [x] Service ชั้น economy: เพิ่ม/หักเงิน + guard กันติดลบ + grantExp + mockDeposit
- [x] Mock deposit helper (simulate เติม Gold — endpoint จริงต่อในขั้น Auth)

## ขั้น 2 — Auth & Onboarding
- [x] ระบบสมัคร/เข้าสู่ระบบ (email + password, session cookie แบบ HMAC-signed)
- [x] Starter Pack ฟรีครั้งแรก: เปิดเองในหน้าเปิดซอง → reveal การ์ด 11 ตำแหน่ง + Silver 300 + Ticket 1 (ไม่แจกเงียบ)
- [x] หน้า Profile: แสดงเงินทุกสกุล, level, EXP bar + ปุ่มออกจากระบบ
- [x] Home แยกมุมมอง guest/logged-in + verify logic ผ่านสคริปต์ทดสอบ

## ขั้น 2.5 — Import การ์ดจริง (หลังได้รูปจาก GitHub)
- [x] Import script: สแกน `public/card/normal/<team>/*.png` → สร้าง Player+Card + imageUrl
- [x] Mapping ชื่อโฟลเดอร์ → ชื่อสโมสรจริง
- [x] ดึง OVR/ตำแหน่ง/ชาติ จากรูปด้วย vision (20 subagent ขนานกัน) → 566 การ์ด
- [x] อนุมาน tier จาก OVR + generate ค่าพลัง 6 ตัว + ขยาย schema (altPos/foot/skill/weak/index)
- [x] แทนที่ seed แต่งเองด้วยข้อมูลจริง + หน้า Collection แสดงการ์ด
- [x] ปรับ Starter Pack ให้สุ่มสมดุลจากพูล Bronze/Silver จริง

## ขั้น 3 — Phase 2: Pack Opening (Gacha)
- [x] Pack config: Standard (Silver), Premium (Gold), Ticket pack + อัตราสุ่มต่อ tier
- [x] ระบบ RNG แบบถ่วงน้ำหนัก + Pity System (การันตี Gold ทุก 10 ครั้งใน Premium)
- [x] Duplicate → แลก Shard (Bronze 5 / Silver 15 / Gold 50)
- [x] หน้าเปิดซอง + animation (ซองสั่น + card reveal, glow ตาม tier)
- [x] บันทึกผลลง UserCard + EXP/level up + verify end-to-end

## ขั้น 4 — Team Building
- [x] เลือก Formation (4-3-3, 4-4-2, 3-5-2, 4-2-3-1) พร้อมพิกัดบนสนาม
- [x] วางนักเตะ 11 คนตามตำแหน่ง (แตะช่อง → เลือกการ์ด, กันใช้ซ้ำ)
- [x] คำนวณ Chemistry (สโมสร/ลีก/ชาติ + ตรงตำแหน่ง) + team rating
- [x] บันทึกทีมของผู้เล่น (Squad/SquadSlot) + verify end-to-end

## ขั้น 5 — Phase 1: สะสมแต้ม
- [x] Daily Login (streak + โบนัสวันที่ 7/30) — เช็คอินบนหน้า Home + verify
- [ ] Daily Mission / Weekly Mission (track ความคืบหน้า + รับรางวัล)
- [ ] Achievement (เปิดซองครบ N, ชนะ PvP N, สะสมครบทีม/Big6)
- [ ] Collection rewards (ครบทีม/ชาติ/ลีก/Big6)

## ขั้น 6 — Phase 3: PvP
- [ ] Matchmaking (จับคู่กับทีมผู้เล่นอื่น / bot)
- [ ] เครื่องคำนวณผล: พลังทีม + Chemistry + Formation + random modifier
- [ ] จำกัดฟรีวันละ 5 ครั้ง + ซื้อ Match Ticket ด้วย Gold
- [ ] Ranking 6 tier (Bronze→Legend) + season reset + reward

## ขั้น 7 — Phase 4: Fantasy Premier XI
- [ ] Admin: จัดการ Gameweek + กรอกผลงานนักเตะจริง (goals/assists/clean sheet/cards...)
- [ ] ผู้เล่นจัดทีม Fantasy + ล็อกทีมเมื่อถึง Deadline
- [ ] เครื่องคำนวณคะแนนอัตโนมัติต่อ Gameweek
- [ ] Leaderboard: Weekly / Monthly / Season + reward ตามอันดับ

## ขั้น 8 — Season & Event
- [ ] Season system (เปิดฤดูใหม่: การ์ดใหม่/reset ranking, เก็บ Collection เดิม)
- [ ] Event framework (TOTW, TOTS, Derby, Christmas...) + Event Pack/Card เฉพาะกิจ

## ขั้น 9 — Admin Panel
- [ ] จัดการนักเตะ/การ์ด (เพิ่ม/แก้ค่าพลัง/อัปโหลดรูป)
- [ ] กรอกผลบอล Fantasy
- [ ] เติม Gold / จัดการผู้ใช้
- [ ] ตั้งค่าอัตราสุ่ม pack + event

## ขั้น 10 — Polish & Verify
- [ ] ตรวจ balance เศรษฐกิจ (กัน Gold เฟ้อ / การ์ดล้น)
- [ ] Responsive ครบทุกหน้า (มือถือเป็นหลัก)
- [ ] เตรียมความเข้ากันได้กับ Telegram Mini App
- [ ] ทดสอบ core loop end-to-end
