# PvP (Phase 3)

**วันที่:** 2026-07-17
**สถานะ:** Brainstorm จบครบทุกประเด็นกับ user แล้ว — รีวิวโดย Codex แล้ว (แก้ครบ 13/13 ข้อ: cache เป็น query filter เท่านั้นไม่ใช่ source of truth, atomic compare-and-set สำหรับโควตา, reward flow ครบตาม pattern จริง, position group อิง slotPos, win-streak/season timezone ชัดเจน, useTicket derive ฝั่ง server, ตัด emoji) พร้อมเขียนแผน implementation

## บริบท / ปัญหา

`docs/TASKS.md` ขั้น 6 (มาร์ค `[~]` in-progress) คือระบบ PvP ที่ `gdd.md` ระบุไว้เป็นฟีเจอร์หลักของเกม แต่ยังไม่มีโค้ดเลยนอกจาก placeholder หน้า `/pvp` (`src/app/pvp/page.tsx` — "หน้านี้กำลังพัฒนา")

โปรเจคมีระบบที่ PvP ต้องพึ่งพาอยู่แล้ว ทำให้ implement ได้เร็ว:
- `computeChemistry()` (`src/lib/chemistry.ts`) คำนวณ `rating` ของทีมจาก OVR + chemistry อยู่แล้ว (ใช้แสดงในหน้า Team)
- `applyExp()`/`levelReward()` (`src/lib/economy.ts`) — ระบบ EXP/level-up กลาง
- `dayIndex()` (`src/lib/daily.ts`) — ตัวช่วยเช็ค boundary วันแบบ UTC
- Mission system (`src/lib/missions.ts`) เพิ่งเสร็จ (`c374c09`) เป็น pattern อ้างอิงสำหรับ atomic claim + notification

## Non-goals (ตัดสินใจกับ user แล้ว กัน scope บาน)

- ไม่เก็บประวัติแมตช์ย้อนหลัง (ไม่มีหน้า match history)
- ไม่มี demotion shield / grace period ตอนตกอันดับ
- ไม่มี leaderboard แยก — Rank Tier ทำหน้าที่จัดอันดับในตัวพอแล้ว, leaderboard เก็บไว้ให้ Fantasy (ขั้น 7) ที่คนเล่นจริงจะเยอะกว่า เพราะ PvP รอบนี้พึ่งบอท fallback เยอะ
- ไม่แจ้งเตือนผู้เล่นที่ถูกใช้ squad เป็นคู่แข่ง (แค่ snapshot จำลอง ไม่กระทบเงิน/การ์ดเขาเลย)
- ไม่คำนวณ chemistry ของทีมบอท fallback แบบจริงจัง — สุ่มการ์ดให้ OVR เฉลี่ยใกล้ target พอ

## ดีไซน์

### 1. UX Flow

ปุ่มเดียว **"แข่งเลย"** บนหน้า `/pvp` — กดแล้ว matchmaking + จำลองผล + โชว์ผลลัพธ์ทันที ไม่มีหน้าเลือกคู่ต่อสู้เอง (ลดขั้นตอน ตรงกับ pattern เกม mobile-first ที่เน้นเปิดแอปแล้วเล่นได้ทันที)

### 2. Matchmaking — Hybrid (คนจริงก่อน บอท fallback)

1. หา `Squad` ของผู้เล่นคนอื่นที่ **filled count = 11** (นับ `slots.filter(s => s.cardId !== null).length === 11` — ไม่ใช่แค่ `every` เฉยๆ เพราะ `every` เป็นจริงได้แม้ relation ว่าง) + `cachedRating` อยู่ในช่วง ±20% ของ rating ผู้เล่นปัจจุบัน — **async, ไม่ต้องออนไลน์พร้อมกัน** (ใช้ squad ล่าสุดที่บันทึกไว้เป็น snapshot) — `cachedRating` ใช้เป็น **ตัวกรองช่วง (query filter) เท่านั้น** ไม่ใช่ค่าที่เอาไปจำลองแมตช์จริง (ดูหัวข้อ 3 ว่าทำไม)
2. ไม่เจอ (ไม่มีใครอยู่ในช่วง rating หรือฐานผู้เล่นยังน้อย) → **fallback สุ่มทีมบอท** จากพูลการ์ดจริงทั้งหมด: สุ่มการ์ด 11 ใบ (1 GK + 4 DEF + 3 MID + 3 ATT ตาม formation `4-3-3` คงที่สำหรับบอทเสมอ ไม่ต้องเดา formation ผู้เล่น) จากพูล `Card` ที่ OVR ใกล้เคียงกับ target rating เป้าหมาย (`myRating` ของผู้เล่น) ให้ทีมบอทมี rating ~ เท่า myRating (ไม่ต้อง chemistry จริง — ประเมิน rating บอทตรงๆ จาก OVR เฉลี่ยที่สุ่มได้)
   - **การันตีว่า fallback ไม่มีทาง error**: query เริ่มที่ OVR ใกล้เคียง `myRating` ±15%; ถ้ากลุ่มตำแหน่งไหนว่าง (ไม่มีการ์ดในช่วงนั้น) **ขยายช่วงเป็น ±30% แล้ว ±50% แล้วสุดท้ายไม่จำกัดช่วงเลย (เอาการ์ดที่ OVR ใกล้เคียงที่สุดในกลุ่มตำแหน่งนั้นทั้งหมด)** ก่อนจะยอมรับว่าไม่มีการ์ดกลุ่มตำแหน่งนั้นจริง (ซึ่งไม่ควรเกิดเพราะทุกกลุ่มตำแหน่งมีการ์ดครอบคลุมทุก tier อยู่แล้วสำหรับระบบเปิดซอง) — การ์ดในทีมบอทซ้ำกันได้ (คนละใบ/tier ของนักเตะคนเดียวกันไม่ถือว่าผิดกติกา เพราะไม่ใช่ squad จริงของใคร)
3. ผู้เล่นที่ถูกใช้ squad เป็นคู่แข่ง **ไม่ได้รับแจ้งเตือนอะไรเลย ไม่กระทบเงิน/การ์ด** — อ่านอย่างเดียว (read-only snapshot)

### 3. Technical: `Squad.cachedRating`

เพิ่ม field ใหม่ `cachedRating Int @default(0)` ใน `Squad` model — cache ค่า `computeChemistry(chemEntries).rating` (ตัวเดียวกับที่หน้า Team แสดงอยู่แล้ว) เพื่อ query หาคู่แข่งแบบช่วง rating ได้เร็วด้วย index ธรรมดา ไม่ต้อง join+คำนวณ `computeChemistry()` สดของ**ทุกคนในระบบ**ทุกครั้งที่มีคนกด "แข่งเลย"

**สำคัญ — `cachedRating` ใช้เป็นตัวกรอง query เท่านั้น ไม่ใช่ source of truth ของแมตช์จริง:** ตอน `playPvpMatch()` เริ่มแมตช์จริง ต้อง **คำนวณ `computeChemistry()` สดใหม่เสมอทั้งของตัวเองและของคู่แข่งที่เจอ** (ใช้ข้อมูล `Card`/`Player` ปัจจุบันจริง) แล้วใช้ค่า `rating` สดนั้นเป็น `myRating`/`oppRating` ใน `simulateMatch()` — เหตุผล:
1. **กัน field เก่าที่ default เป็น 0** — Squad ที่มีอยู่ก่อน migration นี้ (หรือ squad ใหม่ที่ยังไม่เคยเรียก `assignSlot`/`setFormation` หลังครบ 11 ตำแหน่ง) จะมี `cachedRating = 0` ค้างอยู่ ถ้าใช้ค่านี้ตรงๆ ไปคำนวณ `myRating/oppRating` ใน RP/EXP multiplier จะเกิดหารด้วยศูนย์ (`Infinity`/`NaN`) — **ไม่ต้องทำ backfill migration แยก** เพราะแมตช์จริงไม่ได้พึ่งค่า cache เลย
2. **กัน cache ค้างจาก path ที่ไม่ผ่าน squad hooks** — เช่น `prisma/import-cards.ts` (admin re-import) แก้/ลบ `Card`/`Player` ตรงๆ โดยไม่เรียก `refreshCachedRating()` เลย ทำให้ cache เก่าไม่ตรงกับทีมจริงได้ ถ้าคำนวณสดเสมอตอนแข่งจริง ความถูกต้องของผลแมตช์จะไม่ขึ้นกับว่า cache invalidate ครบทุกจุดหรือไม่ (cache ที่ค้างกระทบแค่ "ใครถูกจับคู่กับใคร" ซึ่งพลาดได้ไม่ใช่จุดคอขาดบาดตาย)

**อัพเดต `cachedRating` ทุกครั้งที่ทีมเปลี่ยนโดยตรงผ่าน UI** (ให้ query filter แม่นยำพอสำหรับ matchmaking แม้จะไม่ใช่ source of truth) — เพิ่มฟังก์ชันกลาง `refreshCachedRating(tx, userId)` ใน `src/lib/squad.ts` (ใช้ query เดียวกับที่ `src/app/team/page.tsx` ใช้สร้าง `chemEntries`: join `squad.slots` + `card` + `player`, map ตาม `FORMATIONS[squad.formation]`, เรียก `computeChemistry()`, แล้ว `tx.squad.update({ data: { cachedRating: chem.rating } })`) เรียกจาก:
- `assignSlot()` — หลัง update slot ใน transaction เดิม (มี `tx` อยู่แล้ว)
- `setFormation()` — **ต้อง refactor ให้ห่อด้วย `prisma.$transaction` ก่อน** (ปัจจุบันเป็น single `prisma.squad.update()` ไม่มี tx) เพราะเปลี่ยน formation ทำให้ slot→position mapping เปลี่ยน ต้อง recompute rating ด้วยเสมอ

`@@index([cachedRating])` บน `Squad` เพื่อ query ช่วง rating ได้เร็ว

### 4. จำลองผลแมตช์ (สกอร์บอลจริง ไม่ใช่แค่ตัวเลขนามธรรม)

```
myScore  = myRating  × (0.85 + Math.random() × 0.3)   // multiplier สุ่ม 0.85-1.15
oppScore = oppRating × (0.85 + Math.random() × 0.3)
strengthRatio = myScore / (myScore + oppScore)
```

สุ่มจำนวนประตูรวมทั้งแมตช์จาก weighted distribution:

| ประตูรวม | โอกาส |
|---|---|
| 0 | 10% |
| 1 | 20% |
| 2 | 28% |
| 3 | 22% |
| 4 | 12% |
| 5 | 8% |

แต่ละประตู สุ่มว่าเป็นของทีมไหนด้วยความน่าจะเป็น = `strengthRatio` (ทีมแรงกว่ามีโอกาสได้ประตูมากกว่า แต่พลิกล็อกได้เสมอ)

**ผลแพ้ชนะ/เสมอตัดจากสกอร์บอลที่จำลองได้โดยตรง** (นับประตูแต่ละทีมหลังสุ่มครบ) — ไม่ใช่เทียบ `myScore`/`oppScore` ดิบ ทำให้เสมอเกิดขึ้นได้เองตามธรรมชาติ (เช่น 1-1, 0-0) ไม่ต้อง handle แยก

### 5. Goal Events (ต่อประตู 1 ลูก)

- **นาที**: สุ่ม 1-90 ต่อประตู แล้วเรียงน้อยไปมากตอนแสดงผล
- **คนยิง**: สุ่มถ่วงน้ำหนักจาก 11 ตัวจริงในสนามของทีมนั้น ด้วย `positionWeight × ovr` — **`positionWeight` อิงตาม `POSITION_GROUP[slotPos]` คือตำแหน่งที่นักเตะคนนั้นถูกจัดลงเล่นในสนาม (`slot.pos` ของ formation) ไม่ใช่ `card.position` ดิบ** (สอดคล้องกับที่ `chemistry.ts` ใช้ `slotPos` เป็นตัวตัดสิน ไม่ใช่ตำแหน่งหลักบนการ์ด — กันความกำกวมตอนการ์ดถูกวางผิดตำแหน่งเดิมของตัวเอง เช่น ST ถูกเอาไปเล่น CB ต้องนับเป็น DEF ไม่ใช่ ATT)
  - `positionWeight` คนยิง: ATT=3.0, MID=1.5, DEF=0.4, GK=0.05
- **Assist**: 75% โอกาสมี (สุ่มถ่วงน้ำหนักจากเพื่อนร่วมทีมที่เหลือ ไม่รวมคนยิง ด้วย `positionWeight` คนจ่าย ตาม `slotPos` เดียวกัน: MID=3.0, ATT=1.5, DEF=0.5, GK=0.1), 25% ไม่มี assist (ยิงเดี่ยว/เซตพีซ)
- **แสดงผลแบบ FC26-style**: นาที + ชื่อคนยิง + ชื่อคนจ่าย (ถ้ามี) — ใช้ solid icon ลูกฟุตบอลจาก icon set ที่มีอยู่แล้วในโปรเจค **ห้ามใช้ emoji** (กติกาโปรเจค — permanent UI ใช้ solid icon เท่านั้น) เช่น `[icon] 23' Salah (assist: Alexander-Arnold)` หรือไม่มี assist: `[icon] 67' Haaland`

**เหตุผลใช้ `ovr` ล้วน ไม่ใช้ `shooting`/`passing` stat**: ยืนยันจากรูปการ์ดจริงแล้วว่าดีไซน์การ์ดที่ใช้ **ไม่มี stat breakdown บนหน้าการ์ดเลย** มีแค่ OVR รวมเบอร์เดียว — 6 ค่าพลัง (`pace`/`shooting`/`passing`/`dribbling`/`defending`/`physical`) ใน `Card` model เป็นค่าที่ `generateStats(ovr, position)` (`src/lib/cardgen.ts`) synthesize ขึ้นเองแบบ deterministic จาก OVR + กลุ่มตำแหน่งเท่านั้น (นักเตะกลุ่มตำแหน่งเดียวกัน + OVR เท่ากัน จะมี `shooting`/`passing` เท่ากันเป๊ะ) ใช้แล้วไม่ได้ข้อมูลเพิ่มเหนือ OVR+ตำแหน่งที่ใช้อยู่แล้ว จึงตัดออกให้ formula เรียบง่ายกว่า

### 6. รางวัล EXP/Silver

**โควตาฟรี (5 ครั้ง/วัน)** — `mult = clamp(oppRating / myRating, 0.5, 1.5)` (ตัวเดียวกับ RP หัวข้อ 7):

| ผล | EXP | Silver | Win-streak |
|---|---|---|---|
| ชนะ | `round(25 × mult)` + win-streak bonus | `round(60 × mult)` | `+1` |
| เสมอ | 15 คงที่ | 35 คงที่ | ไม่เพิ่ม ไม่ตัด |
| แพ้ | 8 คงที่ | 15 คงที่ | รีเซ็ตเป็น 0 |

**Win-streak bonus formula (แก้ความกำกวม):** คำนวณจาก **streak ใหม่หลัง increment** — `bonus = min((newStreak - 1) × 5, 15)` โดย `newStreak = pvpWinStreak(เดิม) + 1`. ผลคือ: ชนะครั้งแรก (`newStreak = 1`) ได้ bonus `0`, ชนะติดกันครั้งที่ 2 (`newStreak = 2`) ได้ `+5`, ครั้งที่ 3 ได้ `+10`, ครั้งที่ 4 ขึ้นไปเพดานที่ `+15`

**แมตช์ที่ซื้อด้วย Match Ticket (Gold, หลังโควตาฟรีหมด):**

| ผล | EXP | Silver |
|---|---|---|
| ชนะ | เท่าฟรี | เท่าฟรี |
| เสมอ | เท่าฟรี | เท่าฟรี |
| แพ้ | **0** | **0** |

**เหตุผลแพ้แมตช์ Ticket ไม่ได้อะไรเลย**: กัน pay-to-farm — จ่าย Gold ซื้อ Match Ticket แล้วแพ้ต้องเสียเปล่าจริง ไม่มีของปลอบใจ ถ้าให้ EXP/Silver เท่าแมตช์ฟรีตอนแพ้ด้วย จะกลายเป็นว่าจ่าย Gold ซื้อโอกาส "เล่นต่อแบบไม่มีความเสี่ยง" ซึ่งขัดจุดประสงค์ของการจำกัดโควตา

### 7. RP (Rank Points) — สูตร dynamic ตาม opponent strength

```
multiplier = clamp(oppRating / myRating, 0.5, 1.5)   // ตัวเดียวกับ EXP/Silver มัลติพลายเออร์ตอนชนะ
RP ชนะ = +round(20 × multiplier)
RP แพ้ = -round(15 × (2 − multiplier))                // ทิศทางสลับกับตอนชนะ
RP เสมอ = 0
```

**ทำไมทิศทางสลับกัน**: แพ้คู่แข่งอ่อนกว่า (`multiplier` ต่ำ) เสีย RP เยอะกว่า (เพราะ `2 − multiplier` สูงขึ้น), แพ้คู่แข่งแรงกว่า (`multiplier` สูง) เสีย RP น้อยกว่า — จูงใจให้กล้าแข่งกับคู่แข่งแรงกว่าโดยไม่กลัวเสีย RP หนักถ้าแพ้

RP clamp ขั้นต่ำที่ 0 (ไม่ติดลบ ไม่มี tier ต่ำกว่า Bronze)

> **หมายเหตุยืนยันเจตนา (ตรวจสอบด้วย Codex แล้วพบว่าเป็นคุณสมบัติทางคณิตศาสตร์จริง):** ที่ `multiplier = 1` (คู่แข่ง rating เท่ากันเป๊ะ) ชนะได้ `+20` แพ้เสีย `-15` — ถ้าอัตราชนะ/แพ้ 50/50 จริง ค่าเฉลี่ย RP ต่อแมตช์ที่ไม่เสมอจะเป็น **`+2.5`** (ไม่ใช่ zero-sum) หมายความว่าเล่นเยอะพอ (รวมกับบอท fallback ที่ไม่จำกัดจำนวน) จะไต่ RP ขึ้นได้เรื่อยๆ จากปริมาณการเล่น ไม่ใช่แค่จากฝีมือล้วนๆ — **นี่เป็นการตัดสินใจที่ตั้งใจ** (ยืนยันจากรอบ brainstorm ก่อนหน้า ไม่ใช่บั๊ก): RP ออกแบบให้เป็น **progression ladder** ที่คนเล่นสม่ำเสมอไต่ขึ้นได้ ไม่ใช่ระบบจัดอันดับฝีมือแบบ zero-sum เข้มงวด — กลไกที่คานอินฟเลชั่นนี้ไว้แล้วคือ **Hard Reset รายเดือน** (หัวข้อ 9) ที่รีเซ็ตทุกคนเท่ากันทุกเดือน ไม่ให้ใครสะสม RP ได้เปรียบข้ามเดือนไปเรื่อยๆ

### 8. Rank Tier (6 tier)

| Tier | ช่วง RP |
|---|---|
| Bronze | 0–99 |
| Silver | 100–249 |
| Gold | 250–449 |
| Elite | 450–699 |
| Champion | 700–999 |
| Legend | 1000+ |

- **Tier ไม่ store แยกใน DB** — derive จาก `pvpRP` ผ่าน pure function `tierForRP(rp: number): PvpTier` ใน `src/lib/pvp.ts` (single source of truth เดียวกับแนวทาง `levelReward()` ใน `economy.ts` — กันบั๊คคลาสเดียวกับที่โปรเจคเคยเจอตอน level-up logic กระจาย 3 ที่)
- Promote/Demote ทันทีตาม RP ข้ามเกณฑ์ (ไม่มี demotion shield ใน MVP รอบนี้)
- **UI**: Tier badge เด่น + progress bar ไป tier ถัดไป (ตาม pattern เดียวกับ Level/EXP bar ที่มีอยู่แล้วในหน้า Profile)
- โชว์ RP delta (+/-) ในหน้า Match Result ทุกแมตช์ + แบนเนอร์พิเศษแยกต่างหากถ้ามีการ promote/demote

### 9. Season — ตามเดือนปฏิทินจริง + Hard Reset

- Season = เดือนปฏิทิน (`"2026-07"`, `"2026-08"`, ...) — **ไม่ใช่นับ 30 วันจากวันเริ่มเล่นของแต่ละคน**
- **Timezone: UTC เสมอ** — `seasonKey(d: Date) = \`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}\`` ใน `src/lib/pvp.ts` (ตัวเดียวกับที่ `dayIndex()`/`daily.ts` ใช้ UTC เป็น boundary กลางของทั้งระบบ — กันเวลาเปลี่ยน season คนละจังหวะกับ boundary รายวัน/มิชชั่นที่ใช้ UTC อยู่แล้ว)
- เช็คแบบ **lazy** (pattern เดียวกับ Daily/Weekly Mission — เทียบ `pvpSeasonKey` ที่เก็บไว้ กับ season key ปัจจุบันตอนผู้เล่นทำ action ที่เกี่ยวกับ PvP เช่นกด "แข่งเลย" หรือเปิดหน้า `/pvp` ไม่ต้องมี cron job)
- **จบเดือน = Hard Reset (`pvpRP = 0` ทุกคน)** เมื่อพบว่า `pvpSeasonKey` ที่เก็บไว้ ≠ season key ปัจจุบัน — reset **ทันทีตอนตรวจพบ** (per-user lazy reset ตอน user คนนั้นทำ action ครั้งแรกของเดือนใหม่ ไม่ต้อง batch job รีเซ็ตทุกคนพร้อมกัน) พร้อมแจกรางวัลจบ season ตาม tier ก่อนรีเซ็ต (ดูตาราง)
- **เหตุผล hard reset ไม่ใช่ soft**: การ์ด/ทีมของผู้เล่นไม่ได้หายไปไหน ไต่ RP กลับมาได้อยู่ดี และให้โอกาสคนเล่นน้อย/มาใหม่ไล่ทันคนเก่าทุกเดือน ไม่ใช่ให้คนเก่าได้เปรียบสะสมข้ามเดือนเรื่อยๆ (บริบทเกมนี้ผู้เล่นยังน้อย ต่างจากเกมใหญ่ที่มักใช้ soft reset)

**รางวัลจบ season ตาม tier สุดท้ายก่อนรีเซ็ต:**

| Tier | รางวัล |
|---|---|
| Bronze | 200 Silver |
| Silver | 400 Silver + Standard Pack |
| Gold | 600 Silver + Standard Pack + 3 Gold |
| Elite | 800 Silver + Evolution Pack + 5 Gold |
| Champion | 1,000 Silver + Evolution Pack + 8 Gold + Badge |
| Legend | 1,500 Silver + Royal Prime Pack + 15 Gold + Exclusive Badge |

> Badge เป็น cosmetic ที่ยังไม่มีระบบรองรับในโค้ด (เหมือนที่ `levelReward()` คอมเมนต์ไว้ว่า "Cosmetic ยังไม่มีระบบรองรับ ข้ามไปก่อน") — รอบนี้แจกแค่ silver/gold/pack จริง ส่วน badge บันทึกเป็น "งานเลื่อนไปอนาคต" (ดูหัวข้อด้านล่าง) ไม่ implement ใน MVP

### 10. โควตา + Match Ticket

- ฟรี **5 แมตช์/วัน** (reset แบบ day-index เหมือน `dayIndex()` ใน `daily.ts` — เทียบ `pvpMatchesDate` กับวันนี้)
- เกินโควตา ซื้อด้วย **Match Ticket = 3 Gold/แมตช์** (ถูกกว่า Evolution Pack 10 Gold / Royal Prime 20 Gold มาก — กัน pay-to-farm ตามที่วิเคราะห์ไว้เดิมใน `docs/TASKS.md`)

### 11. ขอบเขตที่ตัดสินใจ "ไม่ทำ" ใน MVP รอบนี้

ดูหัวข้อ Non-goals ด้านบน

## Data Model

`User` model เพิ่ม field:

```prisma
model User {
  // ... fields เดิม ...

  // PvP (Phase 3)
  pvpRP           Int       @default(0)
  pvpSeasonKey    String?   // "YYYY-MM" แบบ UTC (ดู seasonKey() ใน pvp.ts) — เทียบว่าเข้าเดือนใหม่หรือยัง (lazy reset)
  pvpWinStreak    Int       @default(0)
  pvpMatchesToday Int       @default(0)
  pvpMatchesDate  DateTime? // เทียบ dayIndex() เหมือน daily.ts เพื่อรีเซ็ตโควตารายวัน
}
```

`Squad` model เพิ่ม field:

```prisma
model Squad {
  // ... fields เดิม ...
  cachedRating Int @default(0)

  @@index([cachedRating])
}
```

Tier ไม่ store แยก — derive จาก `pvpRP` ผ่าน pure function `tierForRP(rp)` ใน `src/lib/pvp.ts`:

```ts
export const PVP_TIERS = [
  { key: "bronze", label: "Bronze", min: 0 },
  { key: "silver", label: "Silver", min: 100 },
  { key: "gold", label: "Gold", min: 250 },
  { key: "elite", label: "Elite", min: 450 },
  { key: "champion", label: "Champion", min: 700 },
  { key: "legend", label: "Legend", min: 1000 },
] as const;
export type PvpTierKey = (typeof PVP_TIERS)[number]["key"];

export function tierForRP(rp: number) {
  return [...PVP_TIERS].reverse().find((t) => rp >= t.min)!;
}
```

## Core Logic — `src/lib/pvp.ts` (ใหม่)

Pattern เดียวกับ `packs.ts`/`daily.ts` — pure functions ที่รับ `Date`/random เป็น parameter แยกจาก DB access เพื่อเทสได้โดยไม่พึ่ง `new Date()`/`Math.random()` จริงตอนรัน (เหมือนที่ mission spec ทำกับ `dailyPeriodKey`/`weeklyPeriodKey`)

### `findOpponent(tx, myUserId, myRatingForQuery): Promise<Opponent>`
1. Query `Squad` อื่นที่ `userId !== myUserId`, filled count = 11, `cachedRating` อยู่ในช่วง `[myRatingForQuery × 0.8, myRatingForQuery × 1.2]` — สุ่มเลือก 1 จากผลลัพธ์ (ไม่ใช่เอาตัวแรกเสมอ กันผู้เล่นคนเดียวกันโดนใช้ซ้ำทุกครั้ง) แล้ว **คำนวณ `computeChemistry()` สดจากข้อมูล `Card`/`Player` ปัจจุบันจริงของทีมนั้น** เพื่อได้ `oppRating`/`oppLineup` ที่ถูกต้อง ไม่พึ่ง `cachedRating` ที่อาจค้าง (ดูหัวข้อ 3)
2. ไม่เจอ → `generateBotSquad(myRatingForQuery)`: สุ่มการ์ด 11 ใบจากพูล `Card` (1 GK + 4 DEF + 3 MID + 3 ATT ตามกลุ่มตำแหน่ง `POSITION_GROUP`) โดย query การ์ดที่ OVR อยู่ในช่วงใกล้เคียง (เริ่ม ±15%, ขยายเป็น ±30% → ±50% → ไม่จำกัดช่วง ถ้ากลุ่มตำแหน่งไหนว่าง — ดูหัวข้อ 2), คำนวณ rating บอทตรงๆ จาก OVR เฉลี่ยที่สุ่มได้ (ไม่ผ่าน `computeChemistry`)

### `simulateMatch(myRating, oppRating, myLineup, oppLineup, rng = Math.random): MatchResult`
Pure function ตามสูตรหัวข้อ 4-5 ทั้งหมด — รับ `rng` เป็น parameter (default `Math.random`) เพื่อ inject seeded RNG ตอนเทส คืน `{ myGoals, oppGoals, events: GoalEvent[] }` โดย `events` เรียงตามนาทีแล้ว — `positionWeight` ของแต่ละ entry ใน `myLineup`/`oppLineup` มาจาก `POSITION_GROUP[slotPos]` (ดูหัวข้อ 5) ไม่ใช่ `card.position`

### `playPvpMatch(userId, now = new Date(), useTicket = false): Promise<PvpMatchResult>`
ทั้งหมดอยู่ใน `prisma.$transaction` เดียว:
1. Lazy season check (ใช้ `seasonKey(now)` แบบ UTC — ดูหัวข้อ 9): เทียบ `pvpSeasonKey` ของ user กับ season key ปัจจุบัน — ถ้าไม่ตรง **และ `pvpSeasonKey` เดิมไม่ใช่ `null`** เรียก season-end reward ตาม tier เดิมก่อนรีเซ็ต (`grantFreePack()` ถ้า tier มี pack ตามตาราง + `addCurrency` silver/gold — pattern เดียวกับ milestone reward ใน `daily.ts`, เก็บผลไว้ส่งต่อ notification) แล้ว `pvpRP = 0`, `pvpSeasonKey = ปัจจุบัน` ก่อนทำแมตช์ต่อ (ถ้า `pvpSeasonKey` เดิมเป็น `null` แค่ตั้งค่าใหม่ ไม่มีรางวัลให้แจก — user ใหม่)
2. **เช็ค+ตัดโควตาแบบ atomic compare-and-set** (เหมือน `claimMissionAction` ใน `missions.ts` ที่ใช้ `updateMany` แทน read-then-write เพื่อไม่พึ่ง SQLite transaction serialization เป็น safety net หลัก): ก่อนอื่นเทียบ `pvpMatchesDate` กับ `dayIndex(now)` — ถ้าไม่ใช่วันเดียวกัน ให้ `tx.user.update({ where: { id: userId, pvpMatchesDate: เดิม }, data: { pvpMatchesToday: 0, pvpMatchesDate: now } })` reset ก่อน แล้วอ่านค่าที่ reset แล้วมาตัดสินใจ:
   - ถ้า `pvpMatchesToday < 5`: **นี่คือแมตช์ฟรี** (`isTicketMatch = false` เสมอ ไม่สนใจค่า `useTicket` ที่ client ส่งมา — derive ฝั่ง server ทั้งหมด กัน client ส่ง `useTicket=true` มาทั้งที่ quota ยังเหลือ) — `tx.user.updateMany({ where: { id: userId, pvpMatchesToday: { lt: 5 } }, data: { pvpMatchesToday: { increment: 1 } } })` แล้วเช็ค `result.count === 1` (กัน race)
   - ถ้า `pvpMatchesToday >= 5`: **นี่คือ ticket match** (`isTicketMatch = true`) — ต้องมี `gold >= 3` ไม่งั้น return error "Gold ไม่พอซื้อ Match Ticket"; หัก gold ผ่าน `spendCurrency()` (มี atomic check อยู่แล้วในตัว) — **ไม่เพิ่ม `pvpMatchesToday` ต่อ** (เกินโควตาอยู่แล้ว)
3. อ่าน `Squad` ของตัวเอง (join `slots`+`card`+`player`) validate filled count = 11 ก่อน (ไม่งั้น return error "จัดทีมให้ครบ 11 ตำแหน่งก่อน") แล้ว **คำนวณ `computeChemistry()` สดเพื่อได้ `myRating`/`myLineup`** (ไม่ใช้ `Squad.cachedRating` ตรงๆ — ดูหัวข้อ 3) — ใช้ `myRating` นี้เป็น target สำหรับ `findOpponent()` ด้วย (ตัวกรอง query ใช้ `cachedRating` ของ**คนอื่น**ได้ตามปกติ เพราะเป็นแค่ query filter ไม่ใช่ตัวเลขที่เอาไปคำนวณจริง)
4. `findOpponent(tx, userId, myRating)` → `simulateMatch(myRating, oppRating, myLineup, oppLineup)`
5. คำนวณผล win/draw/lose จากสกอร์ → คำนวณ EXP/Silver (ตาม `isTicketMatch` ที่ derive ในขั้นตอน 2 และผลแพ้ชนะ — ตาราง `mult = clamp(oppRating/myRating, 0.5, 1.5)`), RP delta (win-streak bonus ตามสูตรหัวข้อ 6), win-streak ใหม่
6. Apply ทั้งหมด:
   - `applyExp(level, exp, reward.exp)` → ถ้า `levelsGained.length > 0`: loop เหมือน `claimDaily()`/`claimMissionAction()` — รวม `levelReward(lv)` ทุกเลเวลที่ข้าม, เรียก `grantFreePack(tx, userId, freePackId)` ถ้ามี, เก็บ `levelRewards[]` ไว้ส่ง `notifyLevelRewards()` ต่อ (แมตช์ Ticket ที่แพ้ `reward.exp = 0` ทำให้ `applyExp` เป็น no-op โดยธรรมชาติ ไม่ต้อง special-case)
   - `addCurrency(userId, "silver", reward.silver + levelSilverBonus, tx)` (+ gold ถ้ามีจาก level milestone)
   - `tx.user.update` สำหรับ `pvpRP` (clamp `Math.max(0, ...)`), `pvpWinStreak`
7. เช็ค tier เปลี่ยนไหม (`tierForRP(rpก่อน)` vs `tierForRP(rpหลัง)`) — ใช้ตอน trigger notification/banner promote-demote
8. คืนผลทั้งหมดให้ server action ใช้แสดง Match Result + สร้าง notification (`notifyPvpMatch()` + `notifyLevelRewards()` ถ้า level up + notification แยกถ้ามี season-end reward)

## จุด Hook เข้าโค้ดเดิม

| ของเดิม | ไฟล์ | เปลี่ยนอะไร |
|---|---|---|
| `assignSlot()` | `src/lib/squad.ts` | เพิ่มเรียก `refreshCachedRating(tx, userId)` หลัง update slot (มี `tx` อยู่แล้ว) |
| `setFormation()` | `src/lib/squad.ts` | **Refactor ให้ห่อด้วย `prisma.$transaction`** (ปัจจุบันไม่มี tx) แล้วเรียก `refreshCachedRating(tx, userId)` ในนั้น |
| — | `src/app/actions/pvp.ts` (ใหม่) | `playPvpMatchAction()` → เรียก `playPvpMatch()` แล้ว `revalidatePath("/pvp")` + `revalidatePath("/", "layout")` (กระดิ่ง notification) + สร้าง notification ผล PvP/tier change |
| — | `src/lib/constants.ts` | เพิ่ม `"PVP_MATCH"` เข้า `NOTIFICATION_TYPES` |
| — | `src/lib/notifications.ts` | เพิ่ม `notifyPvpMatch()` (ผลแพ้ชนะ + RP delta + tier change ถ้ามี) แพทเทิร์นเดียวกับ `notifyMissionClaimed()` |
| — | `src/app/pvp/page.tsx` | แทน placeholder ด้วยหน้าจริง: Tier badge + progress bar + โควตาเหลือวันนี้ + ปุ่ม "แข่งเลย" |
| — | `src/components/PvpMatch.tsx` (ใหม่) | `"use client"` — ปุ่ม "แข่งเลย" + Match Result screen (สกอร์ + goal events ทีละบรรทัด FC26-style + RP delta + promote/demote banner) แพทเทิร์น `pending`/`error` เดียวกับ `DailyClaim.tsx`/`MissionList.tsx` |

## UI

- **หน้า `/pvp`**: บนสุดโชว์ Tier badge เด่น (สี/ไอคอนตาม tier) + progress bar ไป tier ถัดไป (pattern เดียวกับ Level/EXP bar ในหน้า Profile) + โควตาแมตช์ฟรีเหลือวันนี้ (`5 - pvpMatchesToday`) + ปุ่ม **"แข่งเลย"** ใหญ่กลางจอ (mobile-first)
- ถ้าโควตาหมด: ปุ่มเปลี่ยนเป็น "ซื้อ Match Ticket (3 Gold) แล้วแข่ง" — disabled ถ้า gold ไม่พอ
- ถ้า Squad ไม่ครบ 11 ตำแหน่ง: ปุ่มเปลี่ยนเป็น disabled + ข้อความ "จัดทีมให้ครบ 11 ตำแหน่งก่อน" พร้อมลิงก์ไปหน้า `/team`
- **Match Result** (แสดงทันทีหลังกดแข่ง ไม่ใช่หน้าแยก — inline ในหน้าเดิมหรือ modal/overlay):
  - สกอร์รวมเด่น (เช่น "2 - 1")
  - รายการ goal event เรียงตามนาที — นาที + solid icon ลูกฟุตบอล (**ไม่ใช้ emoji** ตามกติกาโปรเจค) + ชื่อคนยิง + ชื่อคนจ่าย (ถ้ามี)
  - RP delta (`+18` หรือ `-12`) พร้อม EXP/Silver ที่ได้
  - แบนเนอร์แยกถ้า promote/demote tier

## Edge cases

1. **Squad ไม่ครบ 11 ตำแหน่ง** — บล็อกตั้งแต่ปุ่ม UI (disabled) และ validate ซ้ำใน `playPvpMatch()` ด้วย filled-count check ไม่ใช่แค่ `every` (กัน request ตรงๆ ผ่าน server action โดยไม่ผ่าน UI)
2. **หาคู่แข่งคนจริงไม่เจอเลยในระบบ** (ผู้เล่นน้อย/ใหม่) — fallback บอทเสมอด้วยการขยายช่วง OVR ทีละขั้น (ดูหัวข้อ 2) ไม่มีทาง error "หาคู่ไม่เจอ"
3. **โควตาหมดพอดี + ไม่มี Gold ซื้อ Ticket** — ปุ่มกดไม่ได้ (disabled) ไม่ error ทำงานถ้ากด
4. **Double-click / สองแท็บพร้อมกัน** — ปุ่ม disable ระหว่าง `pending` (กัน double-click ธรรมดา) **แต่หลักประกันจริงคือ atomic compare-and-set ฝั่ง server** (`updateMany` ที่เช็คเงื่อนไขในตัว query เดียวกับที่เขียน — ดูขั้นตอน 2 ของ `playPvpMatch()`) ไม่ใช่พึ่ง `prisma.$transaction` เฉยๆ (transaction การันตีแค่ atomic ภายใน tx เดียว ไม่ได้การันตี business-rule เช่น "ห้ามเกิน 5 ครั้ง/วัน" ถ้าไม่มี conditional write)
5. **ข้าม season boundary ระหว่างเช็คโควตากับ apply reward ในทรานแซกชันเดียว** — lazy season check ต้องทำเป็นขั้นแรกสุดใน `playPvpMatch()` ก่อนอ่าน `pvpRP` ใดๆ กันอ่านค่า RP เดือนเก่ามาคำนวณ RP delta ของเดือนใหม่ผิด
6. **ผู้เล่นถูกใช้เป็นคู่แข่งพร้อมกันหลายคนพร้อมกัน (concurrent read)** — เป็น read-only snapshot ไม่มีการเขียนกลับไปที่ squad ของคู่แข่งเลย ไม่มี race ให้กังวล
7. **`pvpRP` ติดลบจาก RP แพ้** — clamp ที่ 0 เสมอ (`Math.max(0, rp - delta)`) ไม่มี tier ต่ำกว่า Bronze
8. **Season reset ระหว่างที่ user ไม่ได้เข้าเกมข้ามหลายเดือน** — เช็คแค่ `pvpSeasonKey ปัจจุบัน ≠ season key ตอนนี้` (ไม่สนว่าห่างกี่เดือน) รีเซ็ตเป็น 0 ครั้งเดียว ไม่ต้อง loop สะสมของหลายเดือนที่ข้ามไป
9. **User ใหม่ที่ยังไม่เคยแข่งเลย (`pvpSeasonKey = null`)** — lazy season check เจอ `null ≠ season key ปัจจุบัน` เข้าเงื่อนไข reset ทันที แต่ `pvpRP` เป็น `0` อยู่แล้ว (`@default(0)`) จึง `tierForRP(0) = Bronze` ไม่มีรางวัล season-end ให้แจก (ข้าม step แจกรางวัลถ้า `pvpSeasonKey` เดิมเป็น `null`) แค่ตั้ง `pvpSeasonKey = ปัจจุบัน` เฉยๆ
10. **`Squad.cachedRating` ค้างเป็น 0 หรือไม่ตรงกับทีมจริง** (squad เก่าก่อน migration, หรือหลัง `import-cards.ts` แก้ข้อมูลการ์ดตรงๆ โดยไม่ผ่าน squad hooks) — ไม่กระทบผลแมตช์เพราะ `playPvpMatch()` คำนวณ `computeChemistry()` สดเสมอทั้งสองฝั่ง (ดูหัวข้อ 3); กระทบแค่ความแม่นยำของ query matchmaking (อาจจับคู่ได้ไม่ตรง range เป๊ะ) ซึ่งยอมรับได้เพราะเป็นแค่ตัวกรอง ไม่ต้องทำ backfill migration แยก
11. **`refreshCachedRating` เรียกตอน squad ยังไม่ครบ 11** — `computeChemistry()` รองรับ entries ที่มี `null` อยู่แล้ว (คืน `rating` จากเท่าที่มีจริง) ไม่ error แต่ `findOpponent`/`playPvpMatch` ต้อง validate filled count = 11 แยกต่างหากก่อนให้แข่งได้
12. **Client ส่ง `useTicket=true` มาทั้งที่ quota ยังเหลือ** — server ไม่เชื่อ input นี้ตรงๆ, derive `isTicketMatch` เองจาก `pvpMatchesToday` เสมอ (ดูขั้นตอน 2 ของ `playPvpMatch()`) กันแมตช์ที่ควรเป็นฟรีถูกจัดเป็น ticket match โดยไม่ได้ตั้งใจ (ซึ่งจะทำให้แพ้แล้วได้ 0 reward ทั้งที่ไม่ได้จ่าย Gold จริง)

## งานที่เลื่อนไปอนาคต (บันทึกไว้ใน `docs/TASKS.md` ไม่ทำรอบนี้)

- Badge cosmetic จากรางวัล Champion/Legend season-end — รอระบบ cosmetic รองรับ (เหมือน `levelReward()` ที่ข้าม cosmetic ไปก่อนเช่นกัน)
- Match history / เก็บ log แมตช์ย้อนหลัง
- Demotion shield / grace period
- Leaderboard แยก — รอ Fantasy (ขั้น 7) ที่ฐานผู้เล่นจริงจะเยอะกว่า
- Achievement ที่ผูก "ชนะ PvP N ครั้ง" (ขั้น 5 ค้างไว้) — implement ได้ทันทีหลัง PvP เสร็จ เพราะตอนนี้มีข้อมูล `pvpWinStreak`/ผลแมตช์ให้ผูกแล้ว

## ไฟล์ที่กระทบ

- `prisma/schema.prisma` — เพิ่ม `User.pvpRP/pvpSeasonKey/pvpWinStreak/pvpMatchesToday/pvpMatchesDate`, `Squad.cachedRating` + `@@index([cachedRating])`, migrate
- `src/lib/pvp.ts` — ใหม่ (`tierForRP`, `PVP_TIERS`, `findOpponent`, `generateBotSquad`, `simulateMatch`, `playPvpMatch`)
- `src/lib/squad.ts` — เพิ่ม `refreshCachedRating()`, เรียกใน `assignSlot()`, refactor `setFormation()` ให้มี transaction
- `src/app/actions/pvp.ts` — ใหม่ (`playPvpMatchAction`)
- `src/lib/constants.ts` — เพิ่ม `"PVP_MATCH"` ใน `NOTIFICATION_TYPES`
- `src/lib/notifications.ts` — เพิ่ม `notifyPvpMatch()`
- `src/app/pvp/page.tsx` — แทน placeholder ด้วยหน้าจริง
- `src/components/PvpMatch.tsx` — ใหม่ (ปุ่ม "แข่งเลย" + Match Result)
- `docs/TASKS.md` — ตัด checklist ขั้น 6 ทีละข้อตอนเสร็จ

## Verification

- Test script (`tsx`, ทิ้งหลังผ่าน) ครอบคลุม: `tierForRP` ทุกช่วง RP, `simulateMatch` ด้วย seeded RNG ให้ผลตรงตามสูตร (myRating สูงกว่ามาก → myGoals ควรชนะบ่อยกว่าเชิงสถิติ), RP ทิศทางสลับถูกต้อง (แพ้คู่แข่งอ่อนกว่าเสีย RP เยอะกว่า), win-streak bonus formula (`newStreak=1→0`, `2→+5`, `3→+10`, `4+→+15`), โควตารายวัน reset ข้าม `dayIndex` boundary, **atomic quota compare-and-set กันเกิน 5 ครั้ง/วันแม้ยิง request พร้อมกัน** (จำลองด้วย `Promise.all` เรียก `playPvpMatch` พร้อมกันหลายครั้งตอน quota ใกล้เต็ม เช็คว่าไม่มีใครเกิน 5), `isTicketMatch` derive ฝั่ง server ถูกต้องไม่ว่า `useTicket` input จะเป็นอะไร, season lazy-reset ข้าม `"YYYY-MM"` boundary แบบ UTC + season-end reward (`grantFreePack`) ถูกแจกตาม tier ก่อนรีเซ็ตจริง (**inject `Date` คงที่ ห้ามพึ่ง `new Date()` จริงตอนรัน** ตาม pattern เดียวกับเทส mission), Match Ticket แพ้ได้ 0 EXP/Silver จริง, `findOpponent` fallback บอทเมื่อไม่มีคู่แข่งคนจริงในช่วง rating (รวม case พูลการ์ดกลุ่มตำแหน่งว่างในช่วงแรก ต้องขยายช่วงได้), `playPvpMatch` ใช้ `computeChemistry()` สดไม่ใช้ `cachedRating` ค้าง (ทดสอบด้วย squad ที่ `cachedRating=0` แต่มีการ์ดจริงครบ 11 ต้องได้ rating ที่ถูกต้อง ไม่ error หารด้วยศูนย์)
- `npx tsc --noEmit`, `npm run build` ผ่าน
- Browser check ผ่าน Preview: จัดทีมให้ครบ 11 ตำแหน่ง → กด "แข่งเลย" → เห็นผลแมตช์ + goal events + RP delta ถูกต้อง, กดจนครบโควตา 5 ครั้ง/วัน → ปุ่มเปลี่ยนเป็นซื้อ Ticket, ซื้อ Ticket ด้วย Gold แล้วแพ้ → ยืนยัน EXP/Silver = 0 จริง, Tier badge/progress bar อัพเดตถูกต้องหลังแมตช์ที่ทำให้ promote/demote
