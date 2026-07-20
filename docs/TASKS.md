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
- [x] Service ชั้น economy: เพิ่ม/หักเงิน + guard กันติดลบ + mockDeposit (EXP/level-up logic ย้ายมารวมที่ `applyExp()`/`levelReward()` ใน ขั้น 5 แทน `grantExp()` เดิม)
- [x] Mock deposit helper (simulate เติม Gold — endpoint จริงต่อในขั้น Auth)

## ขั้น 2 — Auth & Onboarding
- [x] ระบบสมัคร/เข้าสู่ระบบ (email + password, session cookie แบบ HMAC-signed)
- [x] Starter Pack ฟรีครั้งแรก: เปิดเองในหน้าเปิดซอง → reveal การ์ด 11 ตำแหน่ง + Silver 300 (ไม่แจกเงียบ) — เดิมแถม Ticket 1 ด้วย ตัดออกแล้วหลังยกเลิก Ticket Pack (ดู ขั้น 3.5)
- [x] หน้า Profile: แสดงเงินทุกสกุล, level, EXP bar + ปุ่มออกจากระบบ
- [x] Home แยกมุมมอง guest/logged-in + verify logic ผ่านสคริปต์ทดสอบ

## ขั้น 2.5 — Import การ์ดจริง (หลังได้รูปจาก GitHub)
- [x] Import script: สแกน `public/card/normal/<team>/*.png` → สร้าง Player+Card + imageUrl
- [x] Mapping ชื่อโฟลเดอร์ → ชื่อสโมสรจริง
- [x] ดึง OVR/ตำแหน่ง/ชาติ จากรูปด้วย vision (20 subagent ขนานกัน) → 566 การ์ด
- [x] อนุมาน tier จาก OVR + generate ค่าพลัง 6 ตัว + ขยาย schema (altPos/foot/skill/weak/index)
- [x] แทนที่ seed แต่งเองด้วยข้อมูลจริง + หน้า Collection แสดงการ์ด
- [x] ปรับ Starter Pack ให้สุ่มสมดุลจากพูล Bronze/Silver จริง

## ขั้น 3 — Phase 2: Pack Opening (Gacha) — เวอร์ชันแรก แทนที่ทั้งหมดโดย ขั้น 3.5 แล้ว
- [x] ~~Pack config: Standard (Silver), Premium (Gold), Ticket pack + อัตราสุ่มต่อ tier~~ → ดู ขั้น 3.5
- [x] ~~ระบบ RNG แบบถ่วงน้ำหนัก + Pity System (การันตี Gold ทุก 10 ครั้งใน Premium)~~ → ตัด pity ออกแล้ว (ไม่มี Premium pack แล้ว)
- [x] Duplicate → แลก Shard (Bronze 5 / Silver 15 / Gold 50) — ยังใช้อยู่ ต่อยอดใน ขั้น 3.5
- [x] หน้าเปิดซอง + animation (ซองสั่น + card reveal, glow ตาม tier)
- [x] บันทึกผลลง UserCard + EXP/level up + verify end-to-end

## ขั้น 3.5 — Pack Redesign: Standard / Evolution / Royal Prime
เปลี่ยนจาก Standard/Premium/Ticket (เดิม) เป็น 3 pack ตาม rarity: Standard (≤90 OVR), Evolution (≤92 OVR, นักเตะตัวท็อปปัจจุบัน), Royal Prime (92+ OVR, ตำนาน) — ไม่รวม Starter Pack ที่แจกฟรีตอนแรก รูปการ์ดใหม่ถูกอัพขึ้น GitHub ตรงๆ (ไม่ผ่าน mycoder) แล้ว pull เข้ามา
- [x] Import การ์ดพิเศษจากรูป Evolution 44 ใบ + Royal Prime 44 ใบ — vision extract OVR/ตำแหน่ง/สโมสร/ชาติ (8 subagent ขนานกัน คนละ 11 ใบ) → `data/extracted/evolution.json`, `data/extracted/royalprime.json` → import ด้วย `prisma/import-special-cards.ts` (`npm run db:import-special`) เข้า `category="evolution"` (tier **Hero**, OVR 90-92) และ `category="royalprime"` (tier **Legend**, OVR 92-98) รวม 88 การ์ด ไม่กระทบการ์ด normal เดิม
  - รูปอยู่ที่ `public/card/evolution/`, `public/card/royalprime/` (ย้ายจาก root `card/Evolution/`, `card/Royal Prime/` หลัง pull)
  - พบ 2 จุดที่แก้ให้ถูกต้องระหว่าง extract: Agüero/David Silva ธงชาติบนรูปการ์ดผิด (ขึ้น France/Netherlands) แก้เป็น Argentina/Spain จริงตามคนจริง, Welbeck club มี HTML entity `&amp;` แก้เป็น `&`
- [x] Prisma: เพิ่ม `User.evoShards`, `User.primeShards` (แยก pool จาก `shards` เดิม) + migrate (`20260716084711_add_evo_prime_shards`)
- [x] Pack ใหม่ 3 แบบ เปิดทีละ **5 ใบ/ครั้ง** (เดิมเปิดทีละ 1 ใบ) — `src/lib/packs.ts`:
  - **Standard** (300 silver): สุ่มอิสระ 5 ใบจากพูล normal เดิม (Bronze 55% / Silver 38% / Gold 7% ตอนแรก — ปรับเป็น Bronze 25% / Silver 50% / Gold 25% ใน ขั้น 10 balance review เพราะ Gold rate เดิมต่ำเกินไป)
  - **Evolution** (10 gold): การันตี 1 ใบจากพูล Evolution 44 ใบ (สุ่มเท่ากันทุกใบ 1/44) + 10% โอกาสโบนัสใบพิเศษที่ 2 + ที่เหลือสุ่ม normal เรตดีขึ้น (Bronze 10% / Silver 50% / Gold 40%)
  - **Royal Prime** (20 gold): การันตี 1 ใบจากพูล Royal Prime 44 ใบ (1/44) + 12% โอกาสโบนัสใบที่ 2 + ที่เหลือสุ่ม normal เรตเดียวกับ Evolution
  - ลบ Premium pack + Ticket pack เดิมออกจาก `PACKS` registry แล้ว (รวมถึง pity system ที่ผูกกับ Premium)
- [x] `SHARD_VALUE` เพิ่ม tier ใหม่: Hero = 100, Legend = 250 (เดิม Bronze 5 / Silver 15 / Gold 50)
- [x] Shard Exchange (`SHARD_EXCHANGE` ใน `packs.ts`, ฟังก์ชัน `openPackWithShards`) — แลก shard เป็นซองฟรี แยก pool ตามที่มา กันเอา shard ถูกไปซื้อของแพง:
  - Normal shards 600 → Standard Pack ฟรี 1 ครั้ง (ปรับเป็น 500 ใน ขั้น 10 balance review เพื่อปิด rebate gap)
  - Evolution shards 500 → Evolution Pack ฟรี 1 ครั้ง
  - Royal Prime shards 1,000 → Royal Prime Pack ฟรี 1 ครั้ง
- [x] Daily login (`src/lib/daily.ts`): silver = `100 + day*30` (+ bonus 300 วันที่ 7 แทน packTicket เดิม), เลิกแจก packTicket ทั้งจาก daily login และ Starter Pack (currency คงไว้ในระบบเผื่ออนาคต ไม่ลบออกจาก schema)
- [x] อัพเดต `PackShop.tsx`: 3 ปุ่มซื้อ (Standard/Evolution/Royal Prime) + ปุ่มแลก shard แยกตาม pack + reveal grid รองรับ 5 ใบ/ครั้ง (ใช้ layout เดียวกับ Starter Pack 11 ใบ) + badge เด่นบนการ์ดพิเศษที่สุ่มได้
- [ ] ยังไม่ทำ (scope ถัดไปถ้าต้องการ): pity/ตัวช่วยกันโชคร้ายสำหรับสล็อตการันตี (เช่น การ์ดซ้ำติดกัน N ครั้งค่อยบังคับใบใหม่), UI แสดง OVR range ต่อ pack ให้ผู้เล่นเห็นชัดเจนกว่านี้

## ขั้น 3.6 — โปรโมชั่นเปิดตัวเกม (Launch Promotion)
เป้าหมาย: ให้สาย F2P มีทางเข้าถึง Evolution/Royal Prime ได้เร็วขึ้น (เดิมต้องรอ 60-120 วันจาก Gold ที่หาได้) + hook คนเล่นต่อเนื่องช่วงเปิดตัว โดยไม่ทำลายความหายากของการ์ดพรีเมียมในระยะยาว
- [x] Weekly Gold trickle: เพิ่ม `+2 Gold` ในวันที่ 7 ของทุกรอบ (จุดเดียวกับ silver bonus 610) นอกเหนือจาก `+5 Gold` ทุก 30 วันเดิม — ตอนแรก F2P สะสมได้ 13 Gold ใน 30 วันแรก (พอเปิด Evolution ได้ 1 ครั้งใน 30 วัน แทนที่จะต้องรอ 60 วัน) — **ปรับเพิ่มเป็น `+5 Gold` ใน ขั้น 10 balance review** (จาก +2→+5) ตอนนี้ login ต่อเนื่องครบ 30 วันได้ 25 Gold รวม (รายละเอียด: `docs/game-guide.md` หัวข้อ 5)
- [x] Milestone แจกซองพิเศษฟรี **ครั้งเดียวตลอดไป** (ไม่วนซ้ำ ป้องกันการแจก Royal Prime ฟรีทุกเดือนซึ่งจะทำลายความหายาก) — นับจาก `User.totalLogins` (สะสมรวม ไม่ต้อง login ติดต่อกัน ต่างจาก `loginStreak` ที่ใช้คำนวณ silver/gold รายวัน):
  - Login สะสมครบ 15 วัน → แจก Evolution Pack ฟรี 1 ครั้ง (`User.evoMilestoneClaimed`)
  - Login สะสมครบ 30 วัน → แจก Royal Prime Pack ฟรี 1 ครั้ง (`User.primeMilestoneClaimed`)
  - Implement: `LOGIN_MILESTONES` ใน `daily.ts` + `grantFreePack()` ที่เพิ่มใน `packs.ts` (เปิดซองแบบไม่หักเงิน ใช้ tx เดียวกับ `claimDaily` ให้ atomic) เรียกจาก `claimDaily()` อัตโนมัติ, แจ้งเตือนผ่าน `daily.ts` action, แสดงผลใน `DailyClaim.tsx` (ทั้ง preview "เหลืออีกกี่วัน" และผลตอนได้รับ)
  - **หมายเหตุสำคัญ**: นี่คือ mechanic ถาวรที่ implement ไว้แล้ว ถ้าต้องการให้เป็น "โปรโมชั่นเปิดตัว" แบบมีวันหมดเขตจริงๆ (เช่น เฉพาะผู้สมัครก่อนวันที่กำหนด) ต้องเพิ่ม logic เช็ควันสมัคร (`User.createdAt`) เทียบกับ deadline ที่ยังไม่ได้ตกลงกัน — ปัจจุบันใช้ได้กับผู้เล่นทุกคนไม่มีกำหนดหมดอายุ
- [x] First Deposit Bonus: เติมเงินจริงครั้งแรกได้ Gold โบนัส **+20%** (`User.hasDeposited` กันใช้ซ้ำ) — อยู่ใน `mockDeposit()` (`src/lib/economy.ts`) พร้อมใช้งานทันทีที่มีหน้า deposit จริง (ปัจจุบันยังไม่มี UI เติมเงิน เป็น backend logic รอต่อ — ดู ขั้น 9 Admin Panel)
- [ ] ยังไม่ทำ: หน้า UI เติมเงินจริง (deposit page), ตั้ง deadline วันหมดเขตโปรโมชั่นถ้าต้องการจำกัดเฉพาะช่วง launch

## ขั้น 4 — Team Building
- [x] เลือก Formation (4-3-3, 4-4-2, 3-5-2, 4-2-3-1) พร้อมพิกัดบนสนาม
- [x] วางนักเตะ 11 คนตามตำแหน่ง (แตะช่อง → เลือกการ์ด, กันใช้ซ้ำ)
- [x] คำนวณ Chemistry (ตอนแรกอิงสโมสร/ลีก/ชาติ + ตรงตำแหน่ง — **ตัด league ออกในภายหลัง** ดู ขั้น 10 หัวข้อ Chemistry ด้านล่าง เหลือแค่สโมสร/ชาติ) + team rating — เพิ่ม OVR Penalty ตามตำแหน่ง 2026-07-16 (กลุ่มเดียวกัน -10, คนละกลุ่ม -25) กันกลยุทธ์ยัดการ์ด OVR สูงสุดไม่สนตำแหน่ง ดู `docs/game-guide.md` หัวข้อ 10 + 13.2
- [x] Chemistry: แก้ avgOvr ให้หารด้วย 11 คงที่ (ปิดช่องโหว่ทีมไม่ครบยัง rating สูง) + เพิ่ม Full Unity bonus (ครบ 11 คนสโมสรเดียวกัน+ตำแหน่ง exact ทุกคน → rating +2 experimental + เส้นเขียว/badge บนสนาม) — logic verify ผ่านสคริปต์ (8 scenario), `npx tsc --noEmit` และ `npm run build` ผ่านหมด สเปคที่ `docs/superpowers/specs/2026-07-16-chemistry-full-team-design.md` — user เช็ค visual บน Preview แล้วเจอเส้น ring ตัดกัน (centroid-angle-sort ไม่เสถียรเมื่อมีจุดใกล้ศูนย์กลางสนาม) แก้เป็น convex hull + cheapest insertion แทน (การันตีไม่ตัดกันเอง, ทดสอบครบทั้ง 4 ฟอร์เมชัน) ยืนยันผ่านแล้ว
- [x] บันทึกทีมของผู้เล่น (Squad/SquadSlot) + verify end-to-end

## ขั้น 5 — Phase 1: สะสมแต้ม
- [x] Daily Login (streak + โบนัสวันที่ 7/30) — เช็คอินบนหน้า Home + verify — ตัวเลข reward ปรับเพิ่มอีกรอบใน ขั้น 3.5/3.6 (silver bonus วันที่ 7, gold trickle, milestone 15/30 วัน)
- [x] Daily Mission / Weekly Mission (track ความคืบหน้า + รับรางวัล) — 3 daily (login/เปิดซอง/จัดทีม) + 2 weekly (login 5 วัน/เปิดซองครบ 10) ผูกกับ action จริงที่มีอยู่แล้ว (ยังไม่ผูก PvP/Fantasy เพราะยังไม่สร้าง), manual claim (ปุ่มกดเอง), ไม่มี Gold/Pack Ticket จาก mission เลย, `MissionProgress` เป็นตารางเดียว generic + catalog เป็นโค้ด (`src/lib/missionConfig.ts`) กันเพิ่มมิชชั่นใหม่ต้อง migrate — ดีไซน์เต็มรีวิวโดย Codex แล้วที่ `docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md`
- [x] Achievement (เปิดซองครบ N, ชนะ PvP N, สะสมครบทีม/Big6)
- [x] Collection rewards (ครบทีม/ชาติ/ลีก/Big6)
- [x] Level milestone rewards — **แก้แล้ว 2026-07-16** ตาม gdd.txt "3. EXP" (ทุก Level ได้ Silver + Pack, Cosmetic ข้ามไปก่อนเพราะยังไม่มีระบบรองรับ):
  - รวม logic level-up ที่ก็อปซ้ำ 3 ที่ (`economy.ts` dead code เดิม, `packs.ts`, `daily.ts`) เป็น `applyExp()` (pure function คำนวณ level/exp/levelsGained) + `levelReward()` (ตารางรางวัล) ใน `src/lib/economy.ts` ตัวเดียว — `finalizeOpen` (packs.ts) และ `claimDaily` (daily.ts) เรียกร่วมกัน
  - ตารางรางวัล: **ทุกเลเวล** = Silver `level×20` · **ทุก 5 เลเวล** (5,10,15,20...) = + Standard Pack ฟรี · **ทุก 10 เลเวล** = + Evolution Pack ฟรี + Gold 5 · **ทุก 25 เลเวล** = + Royal Prime Pack ฟรี + Gold 10 (เช็คจากสูงไปต่ำ ได้แค่ระดับเดียวต่อเลเวล กันซ้อนทับตอนหารลงตัวหลายเงื่อนไข)
  - แจ้งผ่าน notification `LEVEL_UP` เดิม (ไม่สร้าง UI ใหม่) เพิ่ม `body` บอกยอด Silver/Gold/ชื่อซองที่ได้ — ฟังก์ชันรวมอยู่ที่ `notifyLevelRewards()` ใน `src/lib/notifications.ts` ใช้ร่วมกันทั้ง `actions/pack.ts`/`actions/daily.ts`
  - แก้บั๊กที่เจอระหว่างทำ: `claimDaily` เดิมรายงาน `leveledUp`/`level` จากค่าก่อนเช็ค login milestone (ถ้า milestone แจกซองฟรีแล้วซองนั้นดันเลื่อนเลเวลเพิ่มอีก ค่าที่ return จะไม่อัปเดตตาม) ตอนนี้ทั้ง `finalizeOpen`/`claimDaily` เอา `level`/`levelRewards` ล่าสุดจากผลของ `grantFreePack` ที่เรียกซ้อนมาสรุปเป็นค่าสุดท้ายก่อน return แล้ว (ทดสอบจริงด้วยสคริปต์ยิง level 4→5, 9→10 ข้าม milestone แล้ว silver/gold/level ตรงตามที่ควรได้)
  - Cosmetic ตาม GDD ยังไม่มีระบบรองรับในโค้ดเลย ยังไม่ทำ (scope แยก)
  - Formation unlock ตาม level ที่เคยเสนอไว้ **ตัดทิ้งแล้ว** — เช็ค gdd.txt แล้วไม่มีในดีไซน์ต้นฉบับ (Formation ใน GDD ผูกกับ PvP เท่านั้น)

## ขั้น 5.5 — Notification Center
- [x] Schema: `Notification` (per-user) + `Announcement` (ข่าว broadcast) + `type` String ตาม constants + `User.lastReadNewsAt` + migrate
- [x] lib/notifications: `createNotification` (best-effort ไม่ throw), `getUnreadCount`, `getNotificationCenter`, `markAllRead`
- [x] Header กระดิ่ง + badge ใน layout (แสดงเฉพาะ logged-in) → หน้า `/notifications`
- [x] หน้า `/notifications`: รวมข่าว + กิจกรรม, เปิดแล้ว mark read (ล้าง badge)
- [x] Admin: `/admin/news` (gate `isAdmin`) เขียน/เผยแพร่/ลบประกาศ + ลิงก์จากหน้า Profile
- [x] Wire triggers: รับรางวัลรายวัน · เปิดซอง (normal + starter) · level up (ตัด PvP — ยังไม่ทำจริง)
- [x] Verify: prisma migrate + tsc + lint + build + smoke test data layer (unread 3→0)

## ขั้น 6 — Phase 3: PvP [x]
- [x] Matchmaking (จับคู่กับทีมผู้เล่นอื่น / bot) — hybrid: หา Squad คนอื่นที่ `cachedRating` ในช่วง ±20% ก่อน (ใช้เป็นแค่ query filter), ไม่เจอ fallback สุ่มทีมบอทจากพูลการ์ดจริง (ขยายช่วง OVR ±15%→±30%→±50%→ไม่จำกัด กันหาไม่เจอ) — `src/lib/pvp.ts: findOpponent/generateBotSquad`
- [x] เครื่องคำนวณผล: พลังทีม + Chemistry + Formation + random modifier — `computeChemistry()` สดทั้งสองฝั่งเสมอ (ไม่ใช้ `cachedRating` ตรงๆ กันข้อมูลค้าง) + `simulateMatch()` จำลองสกอร์บอลจริงด้วย weighted goal-count distribution + goal events ถ่วงน้ำหนักตาม `slotPos` — `src/lib/pvp.ts`
- [x] จำกัดฟรีวันละ 5 ครั้ง + ซื้อ Match Ticket ด้วย Gold — atomic compare-and-set แบบเดียวกับ mission system (`updateMany` เช็คเงื่อนไขในตัว query), `isTicketMatch` derive ฝั่ง server ทั้งหมด (ไม่มี client input ให้เชื่อ), ticket match แพ้ได้ EXP/Silver = 0 กัน pay-to-farm — `src/lib/pvp.ts: playPvpMatch`
- [x] Ranking 6 tier (Bronze→Legend) + season reset + reward — tier derive จาก `pvpRP` ผ่าน pure function `tierForRP()` (ไม่ store แยก), season = เดือนปฏิทิน UTC, lazy hard-reset ตอนตรวจพบ season เปลี่ยน พร้อมแจกรางวัลจบ season ตาม tier ก่อนรีเซ็ต — ดีไซน์เต็มรีวิวโดย Codex แล้ว (13/13 ข้อ) ที่ `docs/superpowers/specs/2026-07-17-pvp-design.md`

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
- [ ] เติม Gold / จัดการผู้ใช้ — backend logic (`mockDeposit()`, รวม First Deposit Bonus +20%) พร้อมแล้วจาก ขั้น 3.6 เหลือแค่สร้างหน้า UI เรียกใช้
- [ ] ตั้งค่าอัตราสุ่ม pack + event

## ขั้น 10 — Polish & Verify
- [~] ตรวจ balance เศรษฐกิจ (กัน Gold เฟ้อ / การ์ดล้น) — รีวิวเต็ม + ทดสอบจริงแล้ว บันทึกไว้ที่ `docs/game-guide.md` หัวข้อ 13 (2026-07-16) แก้ไปแล้ว 3 เรื่อง: Standard pack Gold rate (7%→25%), weekly Gold trickle (2→5), shard exchange rebate gap (Standard cost 600→500), เพิ่ม OVR penalty กันเล่นผิดตำแหน่ง — **ยังเหลือ**:
  - [x] **Critical (แก้แล้ว 2026-07-16):** `devLoginAction`/`resetTestUserAction` ใน `src/app/actions/auth.ts` เดิมเรียกได้โดยไม่ต้อง login/ไม่เช็คอะไรเลย — เพิ่ม gate `ENABLE_DEV_LOGIN=true` (env var เฉพาะ ไม่ใช้ `NODE_ENV` เพราะ preview รัน `next build && next start` ทำให้ `NODE_ENV` เป็น `production` เสมอ) ไม่ตั้งค่า → เรียก action ได้ `notFound()` (404) และปุ่มใน `login/page.tsx`/`page.tsx` ถูกซ่อน ต้องลบ `ENABLE_DEV_LOGIN` ออกจาก `.env` (หรือไม่ตั้งใน env ของ deploy จริง) ก่อนขึ้น production
  - [x] **High (แก้แล้ว 2026-07-16):** เปิดซอง/เคลม daily พร้อมกันตั้งแต่ 5 request ขึ้นไปเคย deadlock ล้มหมดทุก request — เติม `?connection_limit=1` ต่อท้าย `DATABASE_URL` ใน `.env` แล้ว ทดสอบซ้ำด้วย `openPack` พร้อมกัน 8 request → สำเร็จหมด ไม่มี fail
  - [ ] **Medium:** หักเงินแบบอ่านก่อนค่อย decrement ไม่มีเงื่อนไขระดับ DB — ปลอดภัยบน SQLite ตอนนี้ แต่ถ้าย้าย DB ในอนาคตต้องเปลี่ยนเป็น atomic conditional update ก่อน
  - [x] **Chemistry — แก้แล้ว 2026-07-16:** league link (`LINK_WEIGHT.league` = 0.5) เคยทำให้ทุกทีมได้ teamChem floor 22/33 (67%) อัตโนมัติเพราะการ์ดทุกใบเป็น Premier League หมด (100% แมตช์เสมอ) พิสูจน์ด้วยจำลองทีมที่ไม่มี synergy จริงเลยก็ยังได้ 22/33 — ตัดสินใจ (ยืนยันกับทีมแล้ว: เกมนี้จะมีแต่ Premier League ลีกเดียวตลอดไป ไม่มีแผนเพิ่มลีกอื่น) **ตัด league ออกจากสูตรทั้งหมด** (`LINK_WEIGHT`, `ChemEntry.league`, `team/page.tsx`) เหลือแค่ club (+2) กับ nation (+1) ผลหลังแก้: worst-case (ไม่มี synergy) = 0/33, best-case (คลับ+ชาติเดียวกันหมด) = 33/33, ทีมผสมทั่วไป (จับคู่คลับบางส่วน) ~14/33 — ได้ range เต็ม 0-33 ที่มีความหมายกับการจัดทีมจริงแล้ว. `MAX_CHEM_RATING_BONUS` (0.10) **ตัดสินใจคงค่าเดิมไว้ก่อน** เพราะที่ avgOVR 80: worst=80, best=+8 (88), ทีมผสมทั่วไป=+3 (83) ถือว่าเป็น spread ที่มีน้ำหนักสมเหตุสมผลแล้วหลังแก้ floor bug (เดิมที่ "รู้สึกต่ำ" เป็นเพราะ floor bug บีบ range ให้แคบ ไม่ใช่เพราะ cap ต่ำจริง) — รอ feedback จากการเล่นจริงถ้าต้องปรับอีกทีหลัง
  - [ ] Royal Prime/Evolution pool ไม่มีการ์ดตำแหน่ง LB เลย (Royal Prime ไม่มี RB ด้วย) — ต้องมี asset รูปการ์ดใหม่ก่อนถึงจะเพิ่มได้ เป็นงาน content แยกต่างหาก
  - [ ] Pruning ข้อมูลเก่าของ `MissionProgress` — โตแบบ unbounded ตามจำนวนผู้เล่น×เวลา (1 แถว/มิชชั่น/รอบ/ผู้เล่น) ต้องมี cron/admin action ลบ periodKey ที่พ้นรอบไปแล้วเกิน ~4 สัปดาห์ (เคลมไม่ได้อีกต่อไปตามกติกา "หายเงียบๆ") — ดู `docs/superpowers/specs/2026-07-17-daily-weekly-mission-design.md` หัวข้อ "งานที่เลื่อนไปอนาคต"
- [ ] แก้ ESLint error ค้าง: `src/lib/pvp.ts:346` — `let matchesToday` ไม่เคย reassign ต้องเป็น `const` (`prefer-const`) ทำให้ `npm run lint` ไม่ผ่านทั้งโปรเจกต์ — หลุดมาจาก commit `7850b4e` (2026-07-19, รีแฟกเตอร์ quota day-rollover ให้ atomic) แก้บรรทัดเดียว
- [ ] Responsive ครบทุกหน้า (มือถือเป็นหลัก)
- [ ] เตรียมความเข้ากันได้กับ Telegram Mini App
- [ ] ทดสอบ core loop end-to-end
