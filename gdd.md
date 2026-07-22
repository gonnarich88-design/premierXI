# Premier XI — Game Design Document (Version 2.0)

> อัพเดตจาก `gdd.txt` (Version 1.0 — ดีไซน์ตั้งต้นก่อนเริ่ม dev) ให้ตรงกับสถานะจริงของเกมที่ implement แล้ว ณ วันที่ 2026-07-17, ปรับสถานะ PvP/Fantasy อีกครั้ง 2026-07-22 (ทั้งสองระบบ implement แล้วจริง — ดูรายละเอียด phase ด้านล่าง)
> เอกสารนี้คือ **ดีไซน์ระดับภาพรวม** (vision + mechanic decisions) — รายละเอียดทางเทคนิค (schema, service, ไฟล์) ดูที่ `docs/system-reference.md`, สูตรคำนวณ/ตัวเลขจริงทั้งหมดดูที่ `docs/game-guide.md`, และสถานะงานคงเหลือดูที่ `docs/TASKS.md`

สัญลักษณ์สถานะที่ใช้ในเอกสารนี้: **✅ ทำแล้ว** · **🚧 ทำบางส่วน** · **⏳ ยังไม่เริ่ม**

---

## ภาพรวมของเกม

Premier XI เป็นเกมสะสมการ์ดนักฟุตบอลพรีเมียร์ลีก (Premier League Card Collecting Game) ที่ผสมผสานระบบ **Pack Opening (Gacha)**, **Team Building**, **PvP**, และ **Fantasy Football** เข้าไว้ด้วยกัน โดยได้รับแรงบันดาลใจจาก EA Sports FC Ultimate Team และ Fantasy Premier League

จุดประสงค์หลักของเกม คือ เพิ่มการสมัครสมาชิก การฝากเงิน และการกลับมาใช้งานเว็บไซต์อย่างต่อเนื่อง ผ่านระบบสะสมการ์ดและการแข่งขันที่เชื่อมโยงกับการแข่งขันพรีเมียร์ลีกจริง

ผู้เล่นจะเปิดซองนักเตะ สะสมการ์ด จัดทีม แข่งกับผู้เล่นคนอื่น และนำทีมของตนไปแข่งขันใน Fantasy League ที่อิงผลการแข่งขันจริงตลอดฤดูกาล

**Stack ปัจจุบัน:** Next.js (App Router, TypeScript) · Prisma + SQLite · Tailwind CSS · Mobile-first · ธีมสีม่วง (อิงเว็บหลัก) · เผื่อไป Telegram Mini App ในอนาคต

## Core Gameplay Loop

```
ผู้เล่นสมัครสมาชิก
  ↓
Login รับรางวัลประจำวัน
  ↓
เปิดซองนักเตะ
  ↓
สะสมนักเตะ
  ↓
จัดทีม
  ↓
แข่ง PvP           ← ✅ implement แล้ว
  ↓
เล่น Fantasy League  ← ✅ implement แล้ว (7A/7B/hub — 7C/7D ยังไม่ทำ)
  ↓
รับรางวัล
  ↓
เปิดซองใหม่
  ↓
สะสมนักเตะเพิ่ม
  ↓
เล่นต่อในทุกสัปดาห์
```

ระบบทั้งหมดถูกออกแบบให้ผู้เล่นมีเหตุผลในการกลับมาเล่นทุกวัน และกลับมาจัดทีมทุกครั้งก่อนการแข่งขันพรีเมียร์ลีก ปัจจุบัน loop ครบทั้งวงจร (สมัคร → login → เปิดซอง → สะสม → จัดทีม → PvP → Fantasy) **implement แล้วและใช้งานแยกส่วนได้จริง** (แต่ยังไม่ได้ทดสอบ end-to-end ครบทั้ง loop พร้อมกัน — ดู `docs/TASKS.md` ขั้น 10); ส่วนที่ยังไม่ทำคือ Monthly leaderboard/settlement ของ Fantasy (7C), sync ผลจริงจาก API-Football (7D), และ Season & Event (ดูด้านล่าง)

---

## Phase 0 : Economy Design (ระบบเศรษฐกิจของเกม) ✅

> สถานะ ✅ หมายถึง core economy (currency, EXP, spend/earn loop) ใช้งานได้จริงในขอบเขตที่เปิดให้เล่นตอนนี้ — ส่วน monetization (deposit จริง) และ balance hardening บางจุดยังค้าง (🚧) ดูรายละเอียดที่หัวข้อ Currency (Gold) และ "ระบบ Balance" ด้านล่าง

### Currency

เกมมีทรัพยากรหลัก **4 ชนิด** บวก **Shard balances 3 pool** แยกตามที่มา (เดิมดีไซน์ไว้ 4 ประเภทรวม Shard เป็นก้อนเดียว ภายหลังแยกเป็น 3 pool ตามที่มา เพื่อกันผู้เล่นเอา shard ถูกไปแลกซองแพง)

**1. Silver Coin** — สกุลเงินหลักสำหรับผู้เล่นทั่วไป
ได้จาก: Daily Login · Daily/Weekly Mission · PvP (ชนะ/เสมอ/แพ้ทุกแมตช์ในโควตาฟรี, ดู Phase 3) · Fantasy Weekly Leaderboard reward (ดู Phase 4)
ใช้เปิด: Standard Pack (300 silver)

**2. Gold Coin** — สกุลเงิน Premium
ได้จาก: ฝากเงินเข้าเว็บไซต์ (**mock — ยังไม่มี payment verification/UI จริง**, ดูหมายเหตุด้านล่าง) · Login streak bonus (วันที่ 7 + ทุก 30 วัน) · Level milestone reward · PvP Season-end reward (Gold/Elite/Champion/Legend tier) · Fantasy Weekly Top 1 reward
อัตรา mock ปัจจุบัน: ฝาก 100 บาท = Gold 10 เหรียญ (`DEPOSIT_RATE_GOLD_PER_BAHT`) + First Deposit Bonus +20% เฉพาะครั้งแรก — ปรับได้ภายหลัง
ใช้เปิด: Evolution Pack (10 gold) · Royal Prime Pack (20 gold)

> **หมายเหตุ mock deposit:** `mockDeposit()` เป็น internal helper ที่เพิ่ม Gold โดยไม่มีการตรวจสอบการชำระเงินจริง ปัจจุบัน**ไม่มี server action ให้ client เรียกได้** — ยังไม่ใช่ "backend พร้อม เหลือแค่ต่อ UI" แต่เป็น flow ที่ต้องเพิ่ม payment verification ก่อนถึงจะห่อเป็น server action ได้ (ดู `docs/game-guide.md` หัวข้อ 8)

**3. EXP** — ใช้เพิ่มระดับ Account ไม่มีมูลค่าซื้อขาย ทุก Level ได้ Silver + (บาง Level ได้ Pack ฟรี — ดูหัวข้อ Level Reward ด้านล่าง)

**4. Pack Ticket** *(legacy)* — เดิมออกแบบไว้ใช้เปิด Ticket Pack แต่ **Ticket Pack ถูกยกเลิกไปแล้ว** ในการรีดีไซน์ระบบซอง (ดู Phase 2) field ยังอยู่ใน schema เผื่ออนาคตแต่ไม่มีจุดแจกให้แล้ว

**Shard (แยก 3 pool)** — ได้จากการ์ดซ้ำ ใช้แลกเปิดซองฟรี แยกตามที่มาเพื่อรักษามูลค่าของ pool ราคาแพง:
- `shards` (จากการ์ด tier Bronze/Silver/Gold) → แลก Standard Pack
- `evoShards` (จากการ์ด tier Hero/Evolution) → แลก Evolution Pack
- `primeShards` (จากการ์ด tier Legend/Royal Prime) → แลก Royal Prime Pack

รายละเอียดตัวเลข/สูตรทั้งหมด: `docs/game-guide.md` หัวข้อ 1, 4

---

## Phase 1 : ระบบสะสมแต้ม

### Daily Login ✅
Login ต่อเนื่องได้รับ Silver + EXP + Gold (วันที่ 7 และทุก 30 วันมีโบนัส) สูตร: `silver = 100 + day×30 (+300 ถ้าวันที่ 7)`, `gold = +5 วันที่ 7, +5 เพิ่มทุก 30 วัน` — คำนวณจาก `loginStreak` (ขาดสาย reset) แยกจาก `totalLogins` (สะสมสะสมตลอด ไม่ reset)

### Login Milestone ✅ — ส่วนเพิ่มจาก v1.0
เพิ่มใหม่หลัง v1.0 เพื่อให้สาย F2P เข้าถึง Evolution/Royal Prime ได้เร็วขึ้นช่วง launch โดยไม่ทำลายความหายากระยะยาว: login สะสมครบ 15 วัน → แจก Evolution Pack ฟรี 1 ครั้ง, ครบ 30 วัน → แจก Royal Prime Pack ฟรี 1 ครั้ง (**ครั้งเดียวตลอดไป ไม่วนซ้ำ**) **หมายเหตุ:** ตั้งชื่อไว้ว่า "โปรโมชั่นเปิดตัวเกม" แต่โค้ดปัจจุบัน**ไม่มีวันหมดเขต** ใช้ได้กับผู้เล่นทุกคนตลอดไป จึงเป็น permanent progression mechanic ในทางปฏิบัติ ไม่ใช่โปรโมชั่นช่วงเวลาจำกัด — ถ้าต้องการให้เป็นโปรโมชั่นจริงต้องเพิ่มเงื่อนไขเทียบ `User.createdAt` กับ deadline ในอนาคต รายละเอียด: `docs/game-guide.md` หัวข้อ 6

### Daily Mission / Weekly Mission ✅
Catalog เป็น single source of truth ที่ `src/lib/missionConfig.ts` ผูกกับ action จริง:
- Daily: Login วันนี้ · เปิดซอง 1 ครั้ง · วางการ์ดในทีมอย่างน้อย 1 ครั้ง
- Weekly: Login สะสมครบ 5 วัน (รางวัลรวม Standard Pack ฟรี) · เปิดซองสะสมครบ 10 ครั้ง

ยังไม่มี mission ผูกกับ PvP/Fantasy ตามดีไซน์เดิม (ทั้งสองระบบ implement แล้ว แค่ยังไม่มีใครเพิ่ม mission ประเภทนี้เข้า catalog) — จะเพิ่ม mission ใหม่ได้โดยแก้ catalog อย่างเดียว ไม่ต้อง migrate DB (ตาราง `MissionProgress` เป็น generic ตัวเดียว)

### Achievement ✅ — implement แล้ว (ครบตามดีไซน์ + เพิ่ม pvpWins)
31 รายการรวม: **10 activity** (เปิดซองสะสมครบ 5/20/50/150/300 ครั้ง · ชนะ PvP สะสมครบ 5/20/50/150/300 เกม — ตัวนับ `pvpWins` เพิ่มใหม่หลัง PvP implement จริง), **20 club** (สะสมนักเตะครบทีมของแต่ละ 20 สโมสร Premier League), **1 meta** (ครบ Big 6 พร้อมกัน) เคลมเองที่หน้า `/achievements`

### Collection ✅ / Collection Rewards ✅
หน้า Collection แสดงการ์ดที่มีแล้ว และ reward ตอนสะสมครบทีม/Big 6 implement แล้วผ่านระบบ Achievement เดียวกันด้านบน (ดีไซน์เดิมพูดถึง "ชาติ/ลีก" ด้วย แต่สโคปสุดท้ายตัดเหลือแค่ club + Big6 meta)

### Level Milestone Reward ✅ — สรุปตามดีไซน์ต้นฉบับ (gdd.txt "3. EXP")
ทุก Level: Silver `level × 20` · ทุก 5 เลเวล: + Standard Pack ฟรี · ทุก 10 เลเวล: + Evolution Pack ฟรี + Gold 5 · ทุก 25 เลเวล: + Royal Prime Pack ฟรี + Gold 10 (เช็คจากสูงไปต่ำ ได้แค่ระดับเดียวต่อเลเวลกันซ้อนทับ) Cosmetic reward ตามดีไซน์เดิมยังไม่มีระบบรองรับ (ตัดออกจาก scope ปัจจุบัน) สูตร level-up รวมเป็น pure function เดียว (`applyExp()`/`levelReward()` ใน `src/lib/economy.ts`) ให้ทุกจุดที่แจก EXP (เปิดซอง, daily login) เรียกร่วมกัน

---

## Phase 2 : ระบบเปิดซองนักเตะ

> **ดีไซน์รีวิวใหม่ทั้งหมด** จาก v1.0 (Standard/Premium/Ticket + Pity System) เป็นระบบ **Standard / Evolution / Royal Prime** ที่อิงระดับความหายากของนักเตะจริงแทน เหตุผล: ให้แต่ละ pack มี "การันตี" ที่ชัดเจนกว่าการสุ่ม tier ล้วน และตัดความซับซ้อนของ pity system ที่ไม่จำเป็นแล้วเมื่อมีการันตีในตัว

ระบบเปิดซองมี Animation ใกล้เคียง EA Sports FC (ซองสั่น + card reveal + glow ตาม tier) เปิดทีละ **5 ใบ/ครั้ง** เสมอ (`CARDS_PER_OPEN = 5`)

### ระดับของการ์ด (Tier) ที่ใช้งานจริง
`Bronze → Silver → Gold` (การ์ด normal, tier คำนวณอัตโนมัติจาก OVR) และ `Hero` (= Evolution), `Legend` (= Royal Prime) สำหรับการ์ดพิเศษ — tier อื่นที่ตั้งไว้ใน constants (`Elite`, `Icon`, `Event`, `TOTW`, `TOTS`) ยังไม่มีการ์ดจริงในระบบ เผื่อคอนเทนต์อนาคต (Event/Season)

### 3 Pack ปัจจุบัน (`src/lib/packs.ts`)

| Pack | ราคา | การันตี | ใบที่เหลือ |
|---|---|---|---|
| **Standard** | 300 Silver | ไม่มี — สุ่มอิสระ 5 ใบจากพูล normal (Bronze 25% / Silver 50% / Gold 25%) | — |
| **Evolution** | 10 Gold | 1 ใบจากพูล Evolution (44 ใบ, สุ่มเท่ากัน 1/44) + 10% โอกาสได้ใบที่ 2 | สุ่ม normal เรตดีขึ้น (Bronze 10% / Silver 50% / Gold 40%) |
| **Royal Prime** | 20 Gold | 1 ใบจากพูล Royal Prime (44 ใบ, สุ่มเท่ากัน 1/44) + 12% โอกาสได้ใบที่ 2 | สุ่ม normal เรตเดียวกับ Evolution |

**Pack ที่ถูกตัดออกจาก v1.0:** Premium Pack, Ticket Pack, และ Pity System ที่ผูกกับ Premium (การันตี Icon ทุก N ครั้ง) — ไม่มีอีกต่อไป

### ค่าพลังของนักเตะ ✅
ทุกใบมี OVR, PACE, SHOOT, PASS, DRIBBLE, DEFENCE, PHYSICAL พร้อมตำแหน่ง (15 ตำแหน่ง รวม GK/แนวรับ/กลาง/หน้า) แต่**ไม่ใช่ทุกค่าที่มาจากรูปการ์ดจริง**:
- **ปรากฏบนหน้าการ์ดจริงและอ่านด้วย vision extraction**: OVR, ตำแหน่ง, สัญชาติ, สโมสร/ลีก, เท้าถนัด, Skill Move, Weak Foot
- **ไม่ปรากฏบนหน้าการ์ดเลย** (ดีไซน์การ์ดที่ใช้ไม่มี stat breakdown อยู่แต่แรก มีแค่ OVR รวมเบอร์เดียว): ค่าพลัง 6 ตัว (PACE/SHOOT/PASS/DRIBBLE/DEFENCE/PHYSICAL) — เกมจึง **synthesize ขึ้นเองแบบ deterministic** จาก OVR + กลุ่มตำแหน่งผ่าน `generateStats()` ใน `src/lib/cardgen.ts` (นักเตะกลุ่มตำแหน่งเดียวกัน + OVR เท่ากัน จะได้ค่าพลัง 6 ตัวเหมือนกันเป๊ะ ไม่มีความต่างรายบุคคล)

### Chemistry ✅ — ปรับสูตรจาก v1.0
ดีไซน์ต้นฉบับระบุ "สโมสรเดียวกัน / ลีกเดียวกัน / สัญชาติเดียวกัน" แต่หลังพบว่าเกมมีแค่ Premier League ลีกเดียว **ลิงก์แบบลีกจึงแมตช์ 100% เสมอ** กลายเป็น floor ปลอมที่การันตีคะแนนสูงโดยไม่ต้องจัดทีมดี (ยืนยันด้วยการทดสอบจริง — ดู `docs/game-guide.md` หัวข้อ 13.1) จึง **ตัด league ออกจากสูตร** เหลือ:
- Club match: +2 แต้ม/คู่
- Nation match: +1 แต้ม/คู่
- Position factor: ตรงตำแหน่ง ×1 / กลุ่มเดียวกัน ×0.6 / คนละกลุ่ม ×0.3
- **OVR Penalty** (เพิ่มใหม่ ไม่มีใน v1.0): เล่นผิดตำแหน่งกลุ่มเดียวกัน -10 OVR, คนละกลุ่ม -25 OVR — กันกลยุทธ์ยัดการ์ด OVR สูงสุดทุกช่องไม่สนตำแหน่ง
- **Full Unity Bonus** (เพิ่มใหม่): ครบ 11 คนสโมสรเดียวกัน + ตำแหน่ง exact ทุกคน → Rating +2 (experimental — รอทบทวนตอนมี PvP จริง)

สูตรและตัวเลขเต็ม: `docs/game-guide.md` หัวข้อ 10

### Starter Pack ✅
ผู้เล่นใหม่ Login ครั้งแรก เปิดเองในหน้าเปิดซอง ได้นักเตะครบ 11 ตำแหน่ง ตรงตำแหน่ง exact ตาม formation 4-3-3 (GK 1 / DEF 4 / MID 3 / ATT 3) — **9 ใบ Bronze/Silver (OVR < 75) + การันตี 2 ใบ Gold (OVR 75-78 แคบกว่า Gold เต็ม tier)** เพื่อดึงดูดให้เล่นต่อโดยไม่ให้ทีมแรงเกินสมดุล ไม่มี Hero/Legend + Silver 300 (เดิมดีไซน์แถม Pack Ticket ด้วย ตัดออกหลังยกเลิก Ticket Pack)

### ระบบสุ่ม (RNG) ✅
Bronze/Silver เป็นผลลัพธ์ส่วนใหญ่ของ Standard Pack, Gold โอกาสรองลงมา, Hero/Legend การันตี 1 ใบ + โอกาสได้ใบที่ 2 ในซองเฉพาะทาง (Evolution/Royal Prime) — implement ครบตามดีไซน์ปัจจุบัน **ไม่มี Pity System โดยตั้งใจ** (เดิม v1.0 ออกแบบให้การันตี Icon เมื่อเปิด Premium ครบจำนวนที่กำหนด แต่ตัดออกเพราะไม่จำเป็นอีกต่อไปเมื่อ Evolution/Royal Prime การันตีในตัวอยู่แล้ว) field `pityCounter` ยังอยู่ใน schema เผื่ออนาคต — anti-frustration เพิ่มเติม (เช่น กันการ์ดซ้ำติดกัน N ครั้ง) ยังเป็น ⏳ ถ้าต้องการในอนาคต

### Duplicate System ✅
การ์ดซ้ำแปลงเป็น Shard อัตโนมัติ (Bronze 5 / Silver 15 / Gold 50 / Hero 100 / Legend 250) แยกเข้า pool ตาม tier แล้วแลกเปิดซองฟรีได้ (ดูตาราง Shard Exchange ใน `docs/game-guide.md` หัวข้อ 4)

### Collection ✅ (หน้าแสดงการ์ด) — reward ✅ ด้วย
หน้าแสดงการ์ดสะสมมีแล้ว และ reward เมื่อสะสมครบทีม/Big 6 implement แล้ว (ดู Phase 1 > Collection Rewards)

---

## Phase 3 : PvP ✅ — implement แล้ว (คงแนวคิดเดิมจาก v1.0 + รางวัล/ranking ตกผลึกเป็นตัวเลขจริงแล้ว)

ผู้เล่นนำทีมไปแข่งกับสมาชิกคนอื่น ระบบหาคู่แข่งที่ rating ใกล้เคียงกัน (±20%) ก่อนเสมอ ถ้าไม่เจอ fallback เป็นทีมบอทที่สุ่มจากพูลการ์ดจริง แล้วจำลองผล (สกอร์ + goal events ถ่วงน้ำหนักตามตำแหน่ง/OVR + random modifier) กันทีมเก่งกว่าชนะทุกครั้งเสมอ

**จำกัดจำนวนแข่งขัน:** ฟรีวันละ 5 ครั้ง หลังจากนั้นซื้อ Match Ticket ด้วย **3 Gold/ครั้ง**

**รางวัลต่อแมตช์ (ตกผลึกแล้ว, ตัวเลขจริงตาม `src/lib/pvp.ts`):** hybrid EXP+Silver+RP — ชนะ `25×mult` exp / `60×mult` silver / `+20×mult` RP (mult = อัตราส่วนความแรงคู่แข่ง, clamp 0.5–1.5), เสมอ 15exp/35silver/0 RP คงที่, แพ้ 8exp/15silver (0 ทั้งคู่ถ้าเป็นแมตช์ที่ใช้ Match Ticket) / `-15×(2-mult)` RP, win-streak bonus +5 exp ต่อชนะติดกัน (เพดาน +15 ตั้งแต่ streak 4) — silver ต่อแมตช์ต่ำกว่าค่า Gold ที่จ่ายซื้อ ticket เสมอ กัน pay-to-farm loop จริง (ตัวเลขเต็มดู `docs/game-guide.md` หัวข้อ 14)

**Ranking 6 tier:** Bronze (RP 0+) → Silver (100+) → Gold (250+) → Elite (450+) → Champion (700+) → Legend (1000+) จบ Season (รายเดือน UTC) แจกรางวัลตาม tier ปัจจุบัน (Silver 200-1,500 + Gold 0-15 + Pack ฟรีตั้งแต่ tier Silver ขึ้นไป) แล้ว hard reset RP กลับ 0 ทุกครั้ง

---

## Phase 4 : Fantasy Premier XI 🚧 — Weekly เสร็จแล้ว (7A/7B/hub), Monthly/Season ยังไม่ทำ (7C/7D)

อ้างอิงผลแข่งขันพรีเมียร์ลีกจริง ผู้เล่นจัดทีม 15 คน (11 ตัวจริง + 4 สำรอง) จากการ์ดที่มี ล็อกทีมเมื่อถึง Deadline คะแนนคำนวณอัตโนมัติจากผลงานจริงที่ Admin กรอก (ลงสนาม/ยิงประตู/แอสซิสต์/คลีนชีต/ใบเหลือง/ใบแดง/เสียประตู/Own Goal — **ดีไซน์เดิมยังมีเซฟ/MOTM/Penalty Miss ที่ตัดออกจากสโคปจริง**) มี auto-substitution แทนตัวที่ไม่ได้ลงสนามให้อัตโนมัติ + กัปตันคูณ 2 เท่า (ดู Admin Panel ด้านล่างสำหรับหน้ากรอกผล)

หน้าแรกของ Fantasy เป็น bento hub (`/fantasy`) ลิงก์ไปตารางแข่ง, จัดทีม, ข่าว, ตารางอันดับ, และ **Team of the Week** (นักเตะทำแต้มสูงสุดต่อตำแหน่งของสัปดาห์นั้น จัดเป็นฟอร์เมชั่น 4-3-3 — ฟีเจอร์ใหม่ที่ไม่มีในดีไซน์ v1.0 เดิม)

**ตารางคะแนน:** **Weekly Leaderboard ✅ implement แล้ว** (Competition ranking + reward ledger กันแจกซ้ำ) — Monthly/Season Leaderboard **🚧 ยังไม่ทำ** (phase 7C, ตาราง `FantasySettlement` มีในสคีมาแล้วแต่ยังไม่มีโค้ดอ่าน/เขียน)

**รางวัล Weekly (ตัวเลขจริงตาม `src/lib/fantasyConfig.ts`, ต่างจากดีไซน์ v1.0 เดิมที่พูดถึง Exclusive Badge/Pack ซึ่งไม่มีในสโคปสุดท้าย):** Top 1 → 3 Gold + Evolution Pack ฟรี · Top 2-10 → Standard Pack ฟรี + Silver 300 · Top 11-100 → Silver 300 · Top 101-1,000 → Silver 100 — ความลึกของรางวัลขึ้นกับจำนวนผู้เข้าแข่งขันจริงต่อสัปดาห์ (ยิ่งคนเยอะยิ่งจ่ายลึก) ผู้เล่นแต้ม ≤0 ไม่ได้รางวัลไม่ว่าอันดับใด

---

## Season & Event ⏳ (ยังไม่ implement — ดีไซน์เดิมจาก v1.0)

แบ่งตามฤดูกาลพรีเมียร์ลีก เปิดฤดูกาลใหม่ = เพิ่มการ์ดใหม่/Event ใหม่/TOTW/TOTS/Fantasy ใหม่/Ranking ใหม่ แต่ Collection และการ์ดเดิมของผู้เล่นยังอยู่ (ไม่ล้าง)

Event ตลอดปี เช่น Opening Season, Derby Week, Christmas, Boxing Day, Halloween, TOTW, TOTS, Future Stars, Legend Week — แต่ละ Event มี Pack/การ์ดเฉพาะกิจ (โครงสร้าง `category` บน `Card` รองรับอยู่แล้วจากการทำ Evolution/Royal Prime — เพิ่ม category ใหม่ได้โดยไม่ต้อง migrate schema)

---

## Notification Center ✅ — ส่วนเพิ่มจาก v1.0 (ไม่มีในดีไซน์ต้นฉบับ)

เพิ่มระหว่างพัฒนาเพื่อรองรับ engagement loop (ให้ผู้เล่นเห็นรางวัล/ข่าวสารแม้ไม่ได้อยู่หน้าเดิม) ประกอบด้วย:
- แจ้งเตือนส่วนตัว (`Notification`): รับรางวัลรายวัน, เปิดซอง, level up, รับรางวัล mission
- ประกาศ broadcast (`Announcement`): เขียนผ่าน Admin (`/admin/news`) เห็นทุกคน
- กระดิ่งพร้อม unread badge ใน header → หน้า `/notifications`

Wire trigger ครบทุกระบบแล้ว รวมถึง PvP (ผลแมตช์ + จบ season) และ Fantasy (ผลคะแนน + รางวัลรายสัปดาห์ — ใช้ `idempotencyKey` กันแจ้งซ้ำตอน resume หลัง crash)

---

## Admin Panel 🚧

**ทำแล้ว:** จัดการข่าว/ประกาศ (`/admin/news`) · จัดการ Fantasy — สร้าง Gameweek, เพิ่มแมตช์, กรอกสถิตินักเตะ, ปิด Gameweek คิดคะแนน (`/admin/fantasy`)
**ยังไม่ทำ:** จัดการนักเตะ/การ์ด (เพิ่ม/แก้ค่าพลัง/อัปโหลดรูป), หน้าเติม Gold จริง (มี calculation helper `mockDeposit()` แล้ว รวม First Deposit Bonus +20% แต่ **payment verification, server action ที่ปลอดภัย และ UI ยังไม่ implement ทั้งหมด** — ไม่ใช่แค่ต่อ UI อย่างเดียว), ตั้งค่าอัตราสุ่ม pack/event ผ่านหน้า UI, sync ผลจริงจาก API-Football (phase 7D — ตอนนี้แอดมินกรอกเองทั้งหมด)

---

## ระบบ Balance

ระบบทั้งหมดยึดหลักเดิมจาก v1.0:
- ผู้เล่นฟรีสามารถเล่นได้จริง
- ผู้เล่นที่ฝากเงินมีความสะดวกและก้าวหน้าเร็วกว่า แต่ไม่ชนะโดยอัตโนมัติ
- การ์ดระดับสูงต้องมีคุณค่าในระยะยาว
- Gold Coin ต้องไม่เกิดภาวะเงินเฟ้อ
- การแข่งขันต้องอาศัยการจัดทีม ไม่ใช่อาศัยค่าพลังเพียงอย่างเดียว
- มีคอนเทนต์ใหม่อย่างต่อเนื่องเพื่อรักษาความสดของเกม

**ผลการรีวิว balance จริง (2026-07-16 — ดูรายละเอียดเต็มที่ `docs/game-guide.md` หัวข้อ 13):** แก้ไปแล้ว — Standard pack Gold rate (7%→25%), weekly Gold trickle (2→5), shard exchange rebate gap (Standard cost 600→500), เพิ่ม OVR penalty กันเล่นผิดตำแหน่ง, ตัด league ออกจาก chemistry (floor bug), ปิดช่อง dev-login เปิดได้โดยไม่ auth, แก้ deadlock ตอนมี concurrent request เยอะ ยังเหลือ: mission progress table ยังไม่มี pruning (โตแบบ unbounded), Royal Prime/Evolution pool ยังไม่มีการ์ดตำแหน่ง LB/RB ครบ (รอ asset เพิ่ม)

---

## เป้าหมายของ Premier XI

Premier XI ไม่ใช่เพียงเกมเปิดซองนักเตะ แต่เป็นระบบสะสมและแข่งขันที่เชื่อมโยงกับพรีเมียร์ลีกจริง เพื่อสร้างการมีส่วนร่วมระยะยาว ผู้เล่นจะมีแรงจูงใจในการกลับมาเล่นทุกวัน เปิดซอง สะสมการ์ด จัดทีม แข่งขัน และติดตามการแข่งขันพรีเมียร์ลีกในทุกสัปดาห์ ขณะเดียวกัน ระบบรางวัลและเศรษฐกิจของเกมจะถูกออกแบบให้เติบโตได้อย่างต่อเนื่อง รองรับการเพิ่มคอนเทนต์ใหม่ในทุกฤดูกาล และสนับสนุนเป้าหมายทางธุรกิจในการเพิ่มการสมัครสมาชิก การฝากเงิน และการรักษาผู้เล่นให้อยู่กับแพลตฟอร์มในระยะยาว

---

## เอกสารที่เกี่ยวข้อง

- `docs/TASKS.md` — task board ทีละ Phase พร้อมสถานะ checklist ล่าสุด
- `docs/game-guide.md` — สูตรคำนวณ/ตัวเลขเศรษฐกิจทั้งหมด (currency, EXP, pack rates, shard, chemistry, formation)
- `docs/system-reference.md` — สถาปัตยกรรมทางเทคนิค (schema, routes, server actions, components, lib services)
