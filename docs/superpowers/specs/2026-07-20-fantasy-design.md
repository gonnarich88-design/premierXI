# Fantasy Premier XI (Phase 4 / ขั้น 7)

**วันที่:** 2026-07-20
**สถานะ:** Brainstorm จบครบทุกประเด็นกับ user แล้ว — รีวิวโดย Codex (18 ข้อ) และตัดสินประเด็นค้าง 3 ข้อโดย Fable แล้ว พร้อมเขียนแผน implementation

## บริบท / ปัญหา

`docs/TASKS.md` ขั้น 7 คือระบบ Fantasy ที่ `gdd.md` ระบุเป็น Phase 4 ของ core loop ("เล่น Fantasy League" ต่อจาก PvP) แต่ยังไม่มีโค้ดเลย — ไม่มีแม้ placeholder page

ระบบที่มีอยู่แล้วและ Fantasy พึ่งพาได้:
- `FORMATIONS` (`src/lib/formations.ts`) — 4 ฟอร์เมชัน (4-3-3 / 4-4-2 / 3-5-2 / 4-2-3-1) พร้อมพิกัดสนาม
- `POSITION_GROUP` (`src/lib/constants.ts`) — map 15 ตำแหน่ง → `GK | DEF | MID | ATT`
- `grantFreePack()` (`src/lib/packs.ts`), `addCurrency()` (`src/lib/economy.ts`) — แจกรางวัล
- `seasonKey()` (`src/lib/pvp.ts`) — เดือนปฏิทิน UTC
- Pattern atomic compare-and-set จาก `missions.ts`/`pvp.ts` (`updateMany` ที่เช็คเงื่อนไขในตัว query)
- Notification system (`src/lib/notifications.ts`)

## Non-goals (ตัดสินใจกับ user แล้ว)

- **ไม่มีงบ/ราคาการ์ด** — เกมนี้การ์ดมาจาก gacha ไม่ใช่ซื้อด้วยงบแบบ FPL จริง
- **ไม่มีกติกา "max 3 คนต่อสโมสร"** — ข้อจำกัดตามธรรมชาติคือมีการ์ดสโมสรนั้นแค่ไหนอยู่แล้ว
- **ไม่มี chip พิเศษ** (Wildcard / Triple Captain / Bench Boost) — ไม่มีในดีไซน์ GDD เดิม
- **ไม่มี transfer limit / point deduction** — แก้ทีมได้อิสระก่อน deadline
- **ไม่มี MOTM / bonus point (BPS) / เซฟ / เซฟจุดโทษ / ยิงจุดโทษพลาด** — user ตัดออกเพื่อให้ไม่มี stat ที่ admin ต้อง "ตัดสินใจ" เอง (ตัด subjectivity ออกหมด เหลือ stat ดิบล้วน)
- **ไม่มี defensive contribution** (tackle/interception/block รายคน) — admin กรอกมือไม่ไหว
- **auto-fetch สถิติรายนักเตะจาก API** — ความเสี่ยง map ผิดคนสูงเกินไป (สถิติยัง manual entry เท่านั้น; API ใช้แค่ sync ตารางแข่งระดับสโมสร)
- **Season reward** — Season leaderboard เป็น read-only ยังไม่แจกรางวัล รอ Season system จริงจาก ขั้น 8
- **Correction หลังปิด Gameweek** — MVP ห้ามแก้หลัง `SCORED` (ดูหัวข้อ "งานที่เลื่อนไปอนาคต")

## ดีไซน์

### 1. โครงสร้างทีม Fantasy

**แยกจากทีม PvP โดยสิ้นเชิง** (ไม่ reuse `Squad`) — เหตุผล: เป้าหมายการจัดทีมต่างกันจริง (PvP optimize chemistry/OVR ระยะยาว, Fantasy optimize ฟอร์มนักเตะรายสัปดาห์) บังคับใช้ทีมเดียวกันจะสร้าง UX อึดอัดและทำลายจุดขายหลักของ Fantasy (เหตุผลให้กลับมาเช็คทุกสัปดาห์)

- **Squad 15 คน**: GK 2, DEF 5, MID 5, ATT 3 (ตำแหน่งใช้ชื่อ group ตาม `POSITION_GROUP` เดิม — ดูหัวข้อ 3)
- **ไม่บังคับครบ 15** — ขั้นต่ำคือ Starting XI 11 คนครบตาม formation ที่เลือก (กันบล็อกผู้เล่นใหม่ที่การ์ดยังไม่พอ) ตัวสำรองมีเท่าที่มีการ์ดเหลือ
- **Starting XI 11 คน** ตาม formation อิสระจาก 4 แบบเดิม
- **ตัวสำรอง 4 คน** เรียงลำดับ `benchPriority` 1-4
- **Captain + Vice-Captain** — ทั้งคู่ต้องอยู่ใน Starting XI และต้องเป็นคนละ `playerId` (ไม่ใช่แค่คนละ `cardId`)

**กติกาความเป็นเจ้าของและการซ้ำ (critical — Codex ข้อ 2):**
- ทุก mutation ต้องตรวจ `UserCard` ด้วย `userId + cardId` ใน transaction — **ห้ามเชื่อ `cardId` จาก client** (ไม่งั้นยิง server action ตรงๆ จัดการ์ดที่ไม่ได้เป็นเจ้าของลงทีมได้)
- **ห้ามใช้การ์ดคนละเวอร์ชันของ `Player` คนเดียวกันซ้ำในทีมเดียวกัน** — ไม่งั้น Salah 3 tier = ได้คะแนนจริงของ Salah 3 เท่า (บังคับด้วย validation ระดับ service + `@@unique([entryId, cardId])` ที่ DB กันซ้ำ card เดียวกัน ส่วนซ้ำ player ต้อง validate ในโค้ดเพราะ SQLite ทำ unique ข้าม relation ไม่ได้)

### 2. Snapshot ทีมต่อ Gameweek (critical — Codex ข้อ 1)

**ปัญหาที่ต้องกัน:** ถ้าเก็บทีมตัวเดียวต่อ user แล้วค่อย snapshot ตอน deadline จะไม่ปลอดภัย เพราะ (ก) ไม่มี cron จริง snapshot อาจเกิดช้ากว่า deadline → ผู้เล่นแก้ทีมหลังบอลเริ่มแข่งได้ (ข) ผู้เล่นต้องเริ่มจัดทีม GW ถัดไปได้ทันทีโดยไม่กระทบทีมของ GW เดิม

**วิธีที่ใช้:** บันทึกทีม**แยกต่อ Gameweek ตั้งแต่ตอน user กด Save** ไม่ใช่รอ copy ตอน deadline

- `FantasyEntry` — 1 row ต่อ `[userId, gameweekId]` เก็บ lineup ของ GW นั้นโดยเฉพาะ
- ทุก write ต้องเช็ค `now < gameweek.deadline` **เป็นเงื่อนไขใน DB transaction** (ไม่ใช่แค่ UI disable) — พ้น deadline แล้ว row นั้น immutable ทันทีโดยธรรมชาติ ไม่ต้องมี job มา "ล็อก"
- ตอนเริ่มจัดทีม GW ถัดไป → **clone จาก entry ล่าสุด** เป็น draft ตั้งต้น (UX สะดวก ไม่ต้องจัดใหม่ทุกสัปดาห์)
- ขนาดข้อมูลไม่ใช่ข้อกังวล: 15 rows × 38 GW = **570 rows/user/ฤดูกาล** เล็กมากเทียบกับความถูกต้องและ auditability

**Snapshot ต้อง freeze ข้อมูลที่ใช้คิดคะแนน** (กันข้อมูลเปลี่ยนย้อนหลังแล้วคะแนนเก่าเพี้ยน): `cardId`, `playerId`, `fantasyPositionGroup`, `isStarter`, `slotIndex`, `benchPriority`, `isCaptain`, `isViceCaptain`, `submittedAt`

### 3. ตำแหน่งที่ใช้คิดคะแนน (Codex ข้อ 7)

มี 3 ค่าที่อาจต่างกัน: `Player.position`, `Card.position`, ตำแหน่งของ slot ใน formation — คะแนนประตู/คลีนชีตต่างกันทันทีถ้าเลือกผิดตัว

**กติกาที่ใช้:**
- ตอนจัดทีม **validate ว่าการ์ดลงได้เฉพาะ slot ที่ `POSITION_GROUP[card.position]` ตรงกับ group ของ slot นั้น** (ต่างจาก Team Building/PvP เดิมที่ยอมให้วางผิดตำแหน่งแล้วโดน OVR penalty — Fantasy ไม่มี penalty จึงต้องบังคับตรงกลุ่ม)
- **freeze `fantasyPositionGroup` ลงใน snapshot ตอน save** แล้วใช้ค่านั้นคิดคะแนนเสมอ ไม่ derive สดภายหลัง
- ใช้ชื่อ group ตาม `POSITION_GROUP` ที่มีอยู่คือ `GK | DEF | MID | ATT` — ในสเปคนี้ "FWD" = `ATT` (ให้ implement ใช้ `ATT` ตรงกับโค้ดเดิม ไม่สร้างชื่อใหม่)

### 4. ตารางคะแนน

| เหตุการณ์ | คะแนน |
|---|---|
| ลงสนาม 1-59 นาที | 1 |
| ลงสนาม ≥60 นาที | 2 |
| ยิงประตู — GK | 10 |
| ยิงประตู — DEF | 6 |
| ยิงประตู — MID | 5 |
| ยิงประตู — ATT | 4 |
| แอสซิสต์ (ทุกตำแหน่ง) | 3 |
| คลีนชีต (ต้องลงสนาม ≥60 นาที) — GK/DEF | 4 |
| คลีนชีต (≥60 นาที) — MID | 1 |
| คลีนชีต — ATT | 0 |
| เสียประตูทุก 2 ลูก (เฉพาะ GK/DEF) | -1 |
| ใบเหลือง | -1 |
| ใบแดง | -3 |
| ทำเข้าประตูตัวเอง (OG) | -2 |
| **Captain** | คูณ 2 ทุกรายการข้างบน |

**GK ยิงประตู 10 แต้ม — เก็บไว้** (Codex ข้อ 17): แม้เกิดแทบไม่ได้ในผลบอลจริง แต่ใช้ field `goals` เดียวกับตำแหน่งอื่น ไม่เพิ่มภาระ admin เลย การตัดออกจะสร้าง special case โดยไม่ได้ลด scope

**หมายเหตุกติกา (Codex ข้อ 11) — ต้องเขียนให้ผู้เล่นเห็นชัดในหน้าเกม:** คลีนชีต/เสียประตูของ Premier XI **derive จากสกอร์สุดท้ายของแมตช์** ไม่ใช่จากช่วงเวลาที่นักเตะอยู่ในสนามจริงแบบ FPL ต้นฉบับ (เช่น DEF ที่ถูกเปลี่ยนออกนาที 70 ตอนยังไม่เสียประตู แล้วทีมเสียนาที 80 → ไม่ได้คลีนชีต) นี่เป็น **simplified rule ที่ตั้งใจ** เพื่อลดภาระ admin (ไม่ต้องเก็บ timeline การเปลี่ยนตัว/นาทีที่เสียประตู) — ห้ามโฆษณาว่าเหมือน FPL จริงทุกประการ

### 5. Auto-substitution (Codex ข้อ 6 — ต้อง deterministic)

**ปัญหา:** "เลือกตัวสำรองคนแรกที่แทนแล้ว formation ยัง valid" ให้ผลไม่คงที่ ขึ้นกับว่าไล่ตรวจตัวจริงที่ไม่ลงสนามคนไหนก่อน (เช่น DEF กับ MID ไม่ลงพร้อมกัน)

**Algorithm ที่กำหนดตายตัว** (pure function ผลลัพธ์ไม่ขึ้นกับ query order):

1. แยก GK ออกจาก outfield
2. ถ้า GK ตัวจริงลงสนาม 0 นาที → ใช้ GK สำรอง **เฉพาะเมื่อ GK สำรองลงสนามจริง** (GK แทนได้เฉพาะ GK)
3. สร้างรายชื่อ starter outfield ที่ลงสนาม 0 นาที **เรียงตาม `slotIndex` จากน้อยไปมาก** (ลำดับคงที่)
4. ไล่ตัวสำรอง outfield **ตาม `benchPriority` จากน้อยไปมาก**
5. สำหรับตัวสำรองแต่ละคนที่ลงสนามจริง ทดลองแทน no-show starter ทีละรายตามลำดับข้อ 3
6. เลือก replacement แรกที่ทำให้ **final XI ยังมี DEF ≥3, MID ≥2, ATT ≥1** (GK ต้อง = 1 หรือ 0 ถ้าไม่มี GK สำรองที่ลงสนาม)
7. ตัวสำรองที่ถูกใช้แล้วห้ามใช้ซ้ำ และ **ห้ามแทนคนที่มี `minutes > 0`**
8. จบแล้วยอมให้ final XI เหลือน้อยกว่า 11 คนได้ ถ้าไม่มีตัวสำรองที่ถูกกติกา (ไม่ error ไม่บังคับเติม)

**ต้องมี exhaustive test** — search space เล็ก (15 คน) ทดสอบครบทุก combination ของใครไม่ลงสนามได้จริง

### 6. Captain / Vice-Captain (Codex ข้อ 13)

ประมวลผล**หลัง** auto-sub แต่ยึดสถานะ starter จาก snapshot เดิม:

1. คำนวณ effective XI หลัง auto-sub ก่อน
2. Captain ได้คูณ 2 **เฉพาะถ้ามี `minutes > 0`**
3. ถ้า Captain 0 นาที และ Vice-Captain มี `minutes > 0` → Vice ได้คูณ 2 แทน
4. ถ้าทั้งคู่ 0 นาที → ไม่มีใครได้คูณ 2 สัปดาห์นั้น
5. **ตัวสำรองที่เข้ามาแทน Captain ไม่รับตำแหน่ง Captain ต่อ**
6. Captain/Vice ต้องเป็น starter ณ snapshot และเป็นคนละ `playerId`

### 7. Gameweek lifecycle — State machine (critical — Codex ข้อ 3)

**ปัญหาที่ต้องกัน:** แจกรางวัลทุก user + คิดคะแนน + เปิด pack + สร้าง notification ใน `prisma.$transaction` เดียวบน SQLite = ล็อก writer ทั้งระบบนานเกินไป และถ้า process ล้มกลางทางจะขาดรางวัลถาวร (ถ้าตั้ง `SCORED` ก่อนแจก) หรือแจกซ้ำ (ถ้าแจกก่อนตั้ง status)

**State machine:** `UPCOMING → LOCKED → SCORING → SCORED`

Flow ตอนปิด Gameweek (resumable + idempotent):

1. **CAS `LOCKED → SCORING`** (`updateMany` ที่ where มี `status: "LOCKED"` แล้วเช็ค `count === 1`) — ผู้ชนะ CAS คนเดียวได้ทำงานต่อ
2. คำนวณคะแนนด้วย pure function → **upsert** ลง `FantasyGameweekScore` (`@@unique([userId, gameweekId])`)
3. Freeze ranking + tie result ลง DB (`rank`, `rewardTier`) — ไม่คำนวณอันดับสดตอนแจก
4. แจกรางวัล**ทีละ recipient**: สร้าง row ใน `FantasyRewardGrant` (`@@unique([userId, periodType, periodKey, rewardType])`) **ใน transaction เดียวกับ** การ `addCurrency()`/`grantFreePack()`/สร้าง notification ของคนนั้น — unique constraint ทำให้ retry คนเดิมไม่แจกซ้ำ (ชน `P2002` = ข้าม)
5. เมื่อครบทุก recipient → **CAS `SCORING → SCORED`**

**ถ้า process ค้างที่ `SCORING`** (server ตาย/timeout) การเรียกซ้ำต้อง **resume ต่อได้** — ไม่ใช่ตอบว่า "กำลังประมวลผล" ตลอดไป (เช็คจาก `scoringStartedAt` เก่ากว่า threshold → เข้าโหมด resume ไล่แจกต่อจาก ledger ที่มีอยู่)

### 8. Admin กรอกผลบอล — ผูกกับ "แมตช์"

Admin สร้าง Gameweek → เพิ่มแมตช์ทีละคู่ (คู่ทีม + สกอร์) → เลือกนักเตะที่ลงสนามจาก `Player.club` ของ 2 ทีมนั้น → กรอกต่อคนแค่ **นาที / ประตู / แอสซิสต์ / ใบเหลือง / ใบแดง / OG**

**"เสียประตู" และ "คลีนชีต" คำนวณอัตโนมัติจากสกอร์แมตช์** — ไม่ต้องกรอกซ้ำ 11 รอบ และกันกรอกไม่ตรงกันเองในทีมเดียวกัน

**Freeze สโมสรลงใน stat (Codex ข้อ 8):** `PlayerMatchStat` ต้องเก็บ `clubSide` (`HOME`/`AWAY`) ตอนกรอก — ไม่ derive จาก `Player.club` สดตอนคิดคะแนน (ไม่งั้นนักเตะย้ายทีม/admin แก้ชื่อสโมสรแล้วผลเก่าเพี้ยน)

**ลดภาระกรอกนาที (Codex ข้อ 18):** เก็บ `minutes` เป็นตัวเลขจริง (จำเป็นเพราะมี boundary 0 / 1-59 / 60+) แต่ UI ช่วยด้วย: default ตัวจริง = 90, ปุ่ม preset `0` / `45` / `60` / `90`, bulk set starters = 90

### 9. Validation ของ Match / PlayerMatchStat (Codex ข้อ 12)

- ทุก field เป็น integer ไม่ติดลบ; `minutes` ≤ 120
- ห้าม `homeClub === awayClub`
- `@@unique([matchId, playerId])` — นักเตะ 1 คนมี stat ได้แถวเดียวต่อแมตช์
- Player ที่กรอก stat ต้องอยู่ในสโมสรใดสโมสรหนึ่งของแมตช์นั้น
- แก้ Match/stat ได้เฉพาะตอน Gameweek ยังไม่เข้า `SCORING`/`SCORED`
- ปิด Gameweek ได้ต่อเมื่อ **ทุก Match มีสกอร์ครบ** และ admin กดยืนยัน
- **Double Gameweek** (ทีมแข่ง 2 นัดใน GW เดียว): รวมคะแนนจากทุก Match
- **Blank Gameweek** (ทีมไม่ได้แข่ง): นักเตะทีมนั้นได้ 0 คะแนน
- Fixture ที่เลื่อน/ยกเลิก ใช้ `status` แยก (`POSTPONED`/`CANCELLED`) **ห้ามใช้สกอร์ `0-0` แทน**

### 10. Leaderboard

3 ช่วง:
- **Weekly** = คะแนนของ 1 Gameweek เดียว
- **Monthly** = รวมทุก GW ที่มี `monthKey` เดียวกัน
- **Season** = รวมทุก GW ตั้งแต่เริ่มระบบ (ยังไม่มีรีเซ็ต รอขั้น 8)

**`monthKey` freeze จาก deadline ไม่ใช่วันที่ปิด (Codex ข้อ 5):** ถ้าใช้ "เดือนที่ admin กดปิด" แล้ว admin ปิด GW ของกรกฎาคมช้าไปวันที่ 1 สิงหาคม ผลจะเด้งไปอยู่ Monthly ของสิงหาคม — ผิด จึง derive `monthKey` จาก `deadline` แบบ UTC **ตอนสร้าง Gameweek** แล้ว freeze ไว้ (ใช้ helper เดียวกับ `seasonKey()` ใน `pvp.ts`)

เดือนจะ settle ได้เมื่อ Gameweek ทุกตัวที่มี `monthKey` นั้นอยู่ในสถานะ `SCORED` แล้ว

**Tie-break (Codex ข้อ 9): ใช้ competition rank** — คะแนนเท่ากันได้อันดับเดียวกันและได้ reward tier เดียวกันทั้งหมด (เช่นเท่ากัน 3 คนที่อันดับ 1 → ทั้ง 3 คนได้รางวัลอันดับ 1 แล้วคนถัดไปเป็นอันดับ 4) — deterministic ไม่ขึ้นกับ row order ของ DB และ `rank`/`rewardTier` ถูก freeze ตอน settlement เพื่อ audit

### 11. รางวัล (ตัดสินโดย Fable — อิงตัวเลขเศรษฐกิจจริง)

| ช่วง | อันดับ | รางวัล |
|---|---|---|
| Weekly | 1 | 3 Gold + Evolution Pack |
| Weekly | 2-10 | Standard Pack + 300 Silver |
| Weekly | 11-100 | 300 Silver |
| Weekly | 101-1000 | 100 Silver |
| Monthly | 1 | 15 Gold + Royal Prime Pack |
| Monthly | 2-10 | 5 Gold + Evolution Pack |
| Monthly | 11-100 | 800 Silver + Standard Pack |
| Monthly | 101-1000 | 300 Silver |
| Season | — | ยังไม่แจก (read-only leaderboard) |

**เหตุผลเชิงตัวเลข:**
- F2P หา Gold ได้ ~25/เดือน (login trickle 5/สัปดาห์ + โบนัส 30 วัน) + PvP Legend สูงสุด 15 → **เพดานรายได้ทั้งระบบ ~40 Gold/เดือน**
- ตารางนี้: คนที่กวาด Weekly ครบ 4 รอบ + Monthly อันดับ 1 ได้ 12 + 15 = **27 Gold/เดือน** อยู่ในกรอบ ไม่เฟ้อ
- Monthly อันดับ 1 (15 Gold + Royal Prime Pack) **เท่ากับ PvP Legend season-end เป๊ะ** (`SEASON_END_REWARD.legend` ใน `src/lib/pvp.ts`) — endgame สองระบบมีมูลค่าสูงสุดเสมอกัน สอดคล้อง gdd.md ที่เขียนไว้เองว่า Fantasy "เน้น Pack มากกว่า Gold จำนวนมาก กัน Gold เฟ้อ"

**เก็บตารางรางวัลเป็น config/constants แยก ห้าม hardcode ใน settlement service** (Codex ข้อ 14)

### 12. เกณฑ์การได้รางวัลตอนฐานผู้เล่นน้อย (Codex ข้อ 15)

**ปัญหา:** เงื่อนไข "คะแนน > 0" กันอะไรไม่ได้จริง เพราะตารางคะแนนแจก appearance point อัตโนมัติ — ทีมที่ทิ้งไว้เฉยๆ ได้คะแนน > 0 ทุกสัปดาห์ กลายเป็น Silver faucet ให้คนที่ไม่กลับมาเล่น และช่วง launch ที่มีผู้เล่นหลักหน่วย tier "11-100" จะครอบคลุมทุกคน = แจกฟรีถ้วนหน้า

**เกณฑ์ที่ใช้ — 2 ชั้น:**

1. **Dynamic payout tier ตามจำนวนผู้เข้าแข่งขันจริง:**

| ผู้เข้าแข่งขัน | เปิด payout ถึง |
|---|---|
| 1-4 คน | อันดับ 1 เท่านั้น |
| 5-19 คน | Top 10 |
| 20-199 คน | Top 100 |
| 200+ คน | Top 1000 |

   implement เป็น `min(rankLimit, participantTier)` ตอน settlement

2. **นิยาม "ผู้เข้าแข่งขัน" = คนที่กด Save ทีมเองใน GW นั้นก่อน deadline** (มี `submittedAt` ของ GW นั้น) — entry ที่ระบบ clone มาจาก GW ก่อนโดย user ไม่ได้กดยืนยัน **ขึ้น leaderboard ได้แต่ไม่มีสิทธิ์รับรางวัล**

### 13. Monthly settlement — global claim record (Codex ข้อ 4)

**ปัญหา:** PvP season reset เป็น state ต่อ user จึง CAS บน `User` ได้ แต่ Monthly Fantasy เป็น ranking รวมทั้งระบบ ถ้าหลาย request ตรวจพร้อมกันจะเริ่มงานซ้อนกัน

**วิธี:** ตาราง `FantasySettlement` เป็น global claim record
- `@@unique([periodType, periodKey])` (`periodType` = `"MONTHLY"`, `periodKey` = `"YYYY-MM"` UTC)
- lifecycle `PENDING → PROCESSING → COMPLETED`
- request แรกที่ create row สำเร็จได้ทำงาน; request อื่นชน `P2002` → ไม่เริ่มงานชุดใหม่
- reward ต่อ user ยังใช้ `FantasyRewardGrant` ledger อีกชั้น → ถ้า process ล้ม resume ได้จาก ledger ที่แจกสำเร็จแล้ว

**จุดที่ trigger lazy check (ต้องระบุชัด ไม่ใช่ "action แรกของเดือน" ลอยๆ):** (ก) เปิดหน้า `/fantasy` (ข) ตอน admin ปิด Gameweek สำเร็จ (ค) protected settlement route — 3 จุดนี้เท่านั้น

### 14. API-Football fixture sync (Phase 7D)

ปุ่มในหน้า admin: ดึงตารางแข่งของ Gameweek นั้นมา **pre-fill ฟอร์มสร้าง Match** — admin ต้องตรวจและกดยืนยันก่อนบันทึกเสมอ **ไม่ auto-publish**

- Map แค่ระดับ**สโมสร** (20 ทีม ชื่อคงที่) ไม่ map นักเตะ 613 คน — ความเสี่ยงต่ำกว่ามาก
- เก็บ `providerFixtureId` unique เพื่อกัน sync ซ้ำสร้าง Match ซ้ำ
- **สถิติรายนักเตะยังคง manual entry** ไม่แตะส่วนนี้

### 15. Protected API route + secret token (Phase 7D — Codex ข้อ 16)

Logic "ปิด Gameweek" และ "monthly settlement" ต้องเป็น **service function เดียว** ที่เรียกได้ 2 ทาง: (ก) ปุ่ม admin ผ่าน session (ข) API route ป้องกันด้วย secret token (cron ภายนอกไม่มี cookie)

**Security contract — ห้ามเทียบกับ `ENABLE_DEV_LOGIN`** (นั่นคือ feature flag; อันนี้คือ credential ที่ให้สิทธิ์เปลี่ยนเศรษฐกิจทั้งระบบ):
- secret มาจาก environment variable เท่านั้น — **ห้ามมี default value**, ห้ามเก็บใน DB/client bundle
- ใช้ header `Authorization: Bearer <token>`
- เทียบแบบ **constant-time** (`crypto.timingSafeEqual`)
- route รับเฉพาะ `POST`
- ถ้า secret ไม่ได้ตั้งค่า → route ตอบ error ปิดตาย **ห้าม fallback เป็นเปิด**
- validate `gameweekId` + lifecycle ฝั่ง server เสมอ
- ห้าม log header/token
- idempotency อยู่ที่ service/DB (state machine + ledger) **ไม่พึ่งสมมติฐานว่า cron จะไม่ยิงซ้ำ**
- `ENABLE_DEV_LOGIN` ต้องไม่มีผลต่อ route นี้

> เตรียมไว้ให้ EasyPanel Cron Job ยิงเข้ามาแทนคนกดตอน deploy จริง (การตั้ง cron บน EasyPanel เป็นงาน infra นอก scope โค้ด)

## Data Model

> SQLite ไม่รองรับ native enum — ทุก status/type เป็น `String` + constants ใน `src/lib/fantasyConfig.ts` ตาม pattern เดิมของโปรเจค

```prisma
/// Gameweek — รอบการแข่งขัน Fantasy (1 สัปดาห์)
model Gameweek {
  id       String   @id @default(cuid())
  number   Int      @unique
  deadline DateTime
  monthKey String   // "YYYY-MM" UTC — derive จาก deadline ตอนสร้าง แล้ว freeze (ห้ามใช้วันที่ปิด)
  status   String   @default("UPCOMING") // UPCOMING | LOCKED | SCORING | SCORED

  scoringStartedAt DateTime?
  scoredAt         DateTime?

  matches Match[]
  entries FantasyEntry[]
  scores  FantasyGameweekScore[]

  createdAt DateTime @default(now())

  @@index([status])
  @@index([monthKey])
}

/// แมตช์จริงใน Gameweek (admin กรอก)
model Match {
  id          String   @id @default(cuid())
  gameweekId  String
  gameweek    Gameweek @relation(fields: [gameweekId], references: [id], onDelete: Cascade)

  homeClub  String
  awayClub  String
  homeScore Int?
  awayScore Int?
  kickoffAt DateTime?
  status    String   @default("SCHEDULED") // SCHEDULED | PLAYED | POSTPONED | CANCELLED

  providerFixtureId String? @unique // จาก API-Football — กัน sync ซ้ำ (Phase 7D)

  stats PlayerMatchStat[]

  @@index([gameweekId])
}

/// สถิติรายนักเตะต่อแมตช์ (admin กรอก) — เสียประตู/คลีนชีต derive จากสกอร์ ไม่เก็บซ้ำ
model PlayerMatchStat {
  id       String @id @default(cuid())
  matchId  String
  match    Match  @relation(fields: [matchId], references: [id], onDelete: Cascade)
  playerId String
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  clubSide String // HOME | AWAY — freeze ตอนกรอก ไม่ derive จาก Player.club สด

  minutes   Int @default(0)
  goals     Int @default(0)
  assists   Int @default(0)
  yellow    Int @default(0)
  red       Int @default(0)
  ownGoals  Int @default(0)

  @@unique([matchId, playerId])
  @@index([playerId])
}

/// ทีม Fantasy ของ user สำหรับ Gameweek หนึ่งๆ — immutable หลัง deadline
model FantasyEntry {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  gameweekId String
  gameweek   Gameweek @relation(fields: [gameweekId], references: [id], onDelete: Cascade)

  formation   String
  submittedAt DateTime? // null = clone อัตโนมัติ ยังไม่กด save เอง → ไม่มีสิทธิ์รับรางวัล
  updatedAt   DateTime  @updatedAt

  slots FantasyEntrySlot[]

  @@unique([userId, gameweekId])
  @@index([gameweekId])
}

/// ช่องในทีม Fantasy (11 ตัวจริง + สูงสุด 4 สำรอง) — freeze ข้อมูลที่ใช้คิดคะแนน
model FantasyEntrySlot {
  id      String       @id @default(cuid())
  entryId String
  entry   FantasyEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  cardId   String
  card     Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  playerId String // freeze — ใช้ join กับ PlayerMatchStat ตอนคิดคะแนน
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  fantasyPositionGroup String // GK | DEF | MID | ATT — freeze ตอน save ห้าม derive สด

  slotIndex      Int  // 0-10 = ตัวจริง, 11-14 = สำรอง
  isStarter      Boolean
  benchPriority  Int? // 1-4 สำหรับตัวสำรองเท่านั้น
  isCaptain      Boolean @default(false)
  isViceCaptain  Boolean @default(false)

  @@unique([entryId, slotIndex])
  @@unique([entryId, cardId])
  @@index([playerId])
}

/// คะแนนที่คำนวณแล้วของ user ต่อ Gameweek + อันดับที่ freeze ตอน settlement
model FantasyGameweekScore {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  gameweekId String
  gameweek   Gameweek @relation(fields: [gameweekId], references: [id], onDelete: Cascade)

  points     Int
  rank       Int? // competition rank — freeze ตอน settlement เพื่อ audit
  rewardTier String? // อันดับที่ได้รางวัลจริง (null = ไม่ได้รางวัล)

  createdAt DateTime @default(now())

  @@unique([userId, gameweekId])
  @@index([gameweekId, points])
}

/// Ledger การแจกรางวัล — unique กันแจกซ้ำตอน retry/resume
model FantasyRewardGrant {
  id         String @id @default(cuid())
  userId     String
  user       User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  periodType String // WEEKLY | MONTHLY
  periodKey  String // weekly: gameweekId / monthly: "YYYY-MM"
  rewardType String // SILVER | GOLD | PACK

  amount Int?    // สำหรับ SILVER/GOLD
  packId String? // สำหรับ PACK

  grantedAt DateTime @default(now())

  @@unique([userId, periodType, periodKey, rewardType])
  @@index([periodType, periodKey])
}

/// Global claim record ของ monthly settlement — กันหลาย request เริ่มงานซ้อนกัน
model FantasySettlement {
  id         String @id @default(cuid())
  periodType String // MONTHLY
  periodKey  String // "YYYY-MM" UTC

  status      String    @default("PENDING") // PENDING | PROCESSING | COMPLETED
  startedAt   DateTime?
  completedAt DateTime?

  @@unique([periodType, periodKey])
}
```

`User` model เพิ่ม relation: `fantasyEntries FantasyEntry[]`, `fantasyScores FantasyGameweekScore[]`, `fantasyRewards FantasyRewardGrant[]`
`Card` เพิ่ม `fantasySlots FantasyEntrySlot[]` · `Player` เพิ่ม `matchStats PlayerMatchStat[]`, `fantasySlots FantasyEntrySlot[]`

## Core Logic — ไฟล์ใหม่

### `src/lib/fantasyConfig.ts` — catalog/constants (single source of truth)
`SCORING` (ตารางคะแนน), `SQUAD_QUOTA` (GK2/DEF5/MID5/ATT3), `FORMATION_MIN` (DEF≥3/MID≥2/ATT≥1), `WEEKLY_REWARDS`/`MONTHLY_REWARDS`, `PARTICIPANT_TIERS`, `GAMEWEEK_STATUS`, `SETTLEMENT_STATUS` — เพิ่ม/ปรับตัวเลขได้โดยไม่ต้อง migrate DB (pattern เดียวกับ `missionConfig.ts`/`achievementConfig.ts`)

### `src/lib/fantasyScoring.ts` — pure functions (เทสได้ ไม่แตะ DB)
- `scorePlayer(stat, positionGroup, goalsConceded, cleanSheet): number` — คะแนนรายคน
- `resolveAutoSubs(starters, bench, statsByPlayerId): EffectiveXI` — algorithm หัวข้อ 5 (deterministic)
- `resolveCaptain(effectiveXI, captainId, viceCaptainId): string | null` — หัวข้อ 6
- `scoreEntry(entry, statsByPlayerId, matchesByClub): number` — รวมทั้งทีม
- `computeRanks(scores): RankedScore[]` — competition rank + tie handling
- `rewardTierFor(rank, participantCount, periodType): Reward | null` — dynamic payout tier

### `src/lib/fantasy.ts` — DB service
- `getOrCreateEntry(userId, gameweekId)` — clone จาก entry ล่าสุดถ้ายังไม่มี (`submittedAt = null`)
- `saveEntry(userId, gameweekId, lineup, now)` — validate ownership (`UserCard`) + ห้าม `playerId` ซ้ำ + position group ตรง slot + captain/vice ถูกกติกา + **`now < deadline` เป็นเงื่อนไขใน transaction** → set `submittedAt`
- `closeGameweek(gameweekId, now)` — state machine หัวข้อ 7 (CAS + ledger + resume)
- `settleMonth(periodKey, now)` — หัวข้อ 13
- `getLeaderboard(scope, key, limit)` — weekly/monthly/season

### `src/lib/fantasyAdmin.ts` — admin operations
`createGameweek()` (derive `monthKey` จาก deadline), `upsertMatch()`, `upsertPlayerStat()`, `syncFixtures()` (7D)

## จุด Hook เข้าโค้ดเดิม

| ของเดิม | ไฟล์ | เปลี่ยนอะไร |
|---|---|---|
| — | `prisma/schema.prisma` | เพิ่ม 7 model ใหม่ + relation บน `User`/`Card`/`Player` + migrate |
| `NOTIFICATION_TYPES` | `src/lib/constants.ts` | เพิ่ม `"FANTASY_SCORE"`, `"FANTASY_REWARD"` |
| — | `src/lib/notifications.ts` | เพิ่ม `notifyFantasyScore()`, `notifyFantasyReward()` |
| — | `src/app/fantasy/page.tsx` (ใหม่) | หน้าจัดทีม + leaderboard |
| — | `src/components/FantasyPitch.tsx` (ใหม่) | สนาม 11 ตัวจริง + bench + badge C/VC |
| — | `src/app/actions/fantasy.ts` (ใหม่) | `saveEntryAction` |
| — | `src/app/admin/fantasy/**` (ใหม่) | จัดการ GW/Match/stat + ปุ่มปิด GW (gate `isAdmin` แบบเดียวกับ `/admin/news`) |
| — | `src/app/api/fantasy/close/route.ts` (ใหม่, 7D) | protected route หัวข้อ 15 |
| `seasonKey()` | `src/lib/pvp.ts` | export ใช้ร่วม (หรือย้ายไป util กลาง) — ห้ามเขียน timezone logic ซ้ำ |
| — | `docs/TASKS.md` | แตกขั้น 7 เป็น 7A-7D ตามหัวข้อถัดไป |

## UI (mobile-first)

- **`/fantasy`**: หัวข้อ Gameweek ปัจจุบัน + นับถอยหลัง deadline เด่น → สนามแนวตั้งแสดง 11 ตัวจริง (แตะช่อง = เลือกการ์ด, กรองเฉพาะการ์ดที่ position group ตรง) → แถวตัวสำรอง 4 ช่องด้านล่างพร้อมลำดับ 1-4 → badge **C**/**VC** มุมการ์ด (แตะการ์ด → popup เลือก, แตะคนใหม่ = ย้ายอัตโนมัติ) → ปุ่ม Save
- พ้น deadline: ทีมล็อก แสดงสถานะ "ล็อกแล้ว" + คะแนนสดถ้า admin กรอกผลบางส่วนแล้ว
- **Leaderboard**: แท็บ Weekly / Monthly / Season + แสดงอันดับตัวเองแบบ sticky ด้านล่าง
- **ห้ามใช้ emoji** ใช้ solid icon เท่านั้น (กติกาโปรเจค)

## แบ่ง Phase (ทั้ง 4 phase อยู่ใน scope ขั้น 7 ไม่ตัดอะไรออก)

### Phase 7A — Core squad + snapshot
Prisma models/constants/migration · Gameweek lifecycle ถึง `LOCKED` · `FantasyEntry` ต่อ user ต่อ GW · validation (ownership, duplicate player, formation, captain, deadline) · หน้าจัดทีม · pure validation tests + concurrent save-at-deadline test

### Phase 7B — Admin results + scoring (**MVP ที่ ship ก่อน**)
`Match`/`PlayerMatchStat` · admin สร้าง GW/fixture + กรอกผล manual · `fantasyScoring.ts` ทั้งหมด · deterministic auto-sub/captain · Weekly leaderboard · close state machine (resume ได้) · score/reward ledger + Weekly rewards · concurrency/idempotency tests

### Phase 7C — Monthly + operations
`monthKey` UTC freeze · Monthly leaderboard · global settlement + resumable reward · tie/ranking policy · notification · admin settlement status

### Phase 7D — External integration
API-Football fixture preview/map/confirm · `providerFixtureId` idempotency · protected API route + constant-time token · cron-compatible calls · retry/timeout/provider failure handling

**เหตุผลที่ 7D อยู่ท้าย:** user กำหนดว่า token route กับปุ่ม admin ต้องเรียก service เดียวกัน — service ปิด GW/settlement ต้องมีตัวตนก่อนถึงจะห่อเป็น route ได้ เขียน route ก่อนคือเขียนสองรอบ; และ core loop ไม่พึ่ง API-Football เลยแม้แต่จุดเดียว

## Edge cases

1. **แก้ทีมชนกับ deadline พอดี** — เงื่อนไข `now < deadline` อยู่ใน DB transaction ไม่ใช่แค่ UI disable
2. **ยิง server action ส่ง `cardId` ที่ไม่ได้เป็นเจ้าของ** — เช็ค `UserCard` ทุก mutation ใน transaction
3. **การ์ดคนละ tier ของนักเตะคนเดียวกันในทีมเดียว** — validate `playerId` ซ้ำ ปฏิเสธตั้งแต่ save
4. **กด "ปิด Gameweek" ซ้ำ / cron ยิงซ้ำ** — CAS `LOCKED → SCORING` ผู้ชนะคนเดียว + ledger unique
5. **Process ตายกลาง `SCORING`** — เรียกซ้ำ resume ต่อจาก ledger ไม่แจกซ้ำ ไม่ค้างถาวร
6. **Monthly settle ชนกันหลาย request** — `FantasySettlement` unique `[periodType, periodKey]`
7. **Admin ปิด GW ของเดือนก่อนช้าไปข้ามเดือน** — `monthKey` freeze จาก deadline ไม่ใช่ `closedAt`
8. **คะแนนเท่ากันตรงขอบอันดับ** — competition rank ได้ tier เดียวกันทั้งกลุ่ม
9. **ผู้เล่นใหม่การ์ดไม่พอ 15 คน** — ไม่บล็อก ขอแค่ 11 ตัวจริงครบ formation
10. **ตัวจริงไม่ลงสนามหลายคนพร้อมกัน** — algorithm deterministic หัวข้อ 5 (exhaustive test)
11. **GK ตัวจริงไม่ลงสนาม + ไม่มี GK สำรองที่ลงสนาม** — final XI ไม่มี GK ยอมรับได้ ไม่ error
12. **Captain และ Vice ไม่ลงสนามทั้งคู่** — ไม่มีใครได้คูณ 2 สัปดาห์นั้น
13. **นักเตะย้ายสโมสร / admin แก้ชื่อสโมสร** — `clubSide` freeze ใน `PlayerMatchStat` ผลเก่าไม่เพี้ยน
14. **Double Gameweek** — รวมคะแนนทุก Match; **Blank Gameweek** — 0 คะแนน
15. **Fixture เลื่อน/ยกเลิก** — `status` แยก ห้ามใช้ `0-0` แทน
16. **Entry ที่ clone มาโดยไม่ได้กด save** — ขึ้น leaderboard แต่ไม่มีสิทธิ์รางวัล (`submittedAt = null`)
17. **ผู้เล่นน้อยกว่า payout tier** — dynamic tier ตัด payout ตามจำนวนผู้เข้าแข่งจริง
18. **secret token ไม่ได้ตั้งค่าใน env** — route ปิดตาย ห้าม fallback เป็นเปิด

## Verification

- **Pure function tests** (`tsx`, ทิ้งหลังผ่าน): `scorePlayer` ทุกตำแหน่ง × ทุกเหตุการณ์ · boundary นาที 0/1/59/60/90 · คลีนชีตต้อง ≥60 นาที · เสียประตูปัดทุก 2 ลูก · **`resolveAutoSubs` แบบ exhaustive** (ทุก combination ของใครไม่ลงสนามใน 15 คน — ผลต้องไม่ขึ้นกับลำดับ input) · `resolveCaptain` ครบ 4 กรณี · `computeRanks` tie handling · `rewardTierFor` ทุก participant tier
- **Concurrency tests**: `Promise.all` ยิง `saveEntry` พร้อมกันตอนใกล้ deadline (ต้องไม่มีอันไหนผ่านหลัง deadline) · ยิง `closeGameweek` พร้อมกัน 8 ครั้ง (ต้องแจกรางวัลชุดเดียว ledger ไม่ซ้ำ) · ยิง `settleMonth` พร้อมกันหลาย request (ต้องมีงานชุดเดียว) · จำลอง process ตายกลาง `SCORING` แล้วเรียกซ้ำ (ต้อง resume ไม่แจกซ้ำ)
- **Security tests**: ส่ง `cardId` ที่ไม่ได้เป็นเจ้าของ → ถูกปฏิเสธ · ส่ง `playerId` ซ้ำ → ถูกปฏิเสธ · เรียก protected route ไม่มี token/token ผิด → 401 · ไม่ตั้ง env secret → route ปิด
- `npx tsc --noEmit`, `npm run lint`, `npm run build` ผ่าน
- **Browser check ผ่าน Preview** (บัญชี `qatester` / `qatest1234` มีการ์ดครบ 654 ใบ): จัดทีม 15 คน → ตั้ง C/VC → save → admin สร้าง GW/Match/กรอก stat → ปิด GW → ตรวจคะแนน/อันดับ/รางวัล/notification ถูกต้อง → ลองแก้ทีมหลัง deadline ต้องไม่ได้

## งานที่เลื่อนไปอนาคต (บันทึกใน `docs/TASKS.md` ไม่ทำรอบนี้)

- **Correction policy หลัง `SCORED`** — MVP ห้ามแก้; รุ่นถัดไปต้องมี version score + audit log + reward adjustment เป็น delta ledger (**ห้ามลบ score/reward เดิมแล้วแจกใหม่ตรงๆ**)
- **Clean sheet แม่นแบบ FPL จริง** (อิงช่วงเวลาที่อยู่ในสนาม) — ต้องเก็บ timeline การเปลี่ยนตัว + นาทีที่เสียประตู เพิ่ม scope มาก
- **Season reward** — รอ Season system จริงจาก ขั้น 8
- **auto-fetch สถิติรายนักเตะจาก API** — ต้องทำ player-mapping (fuzzy match 613 คน + review ด้วยมือ) เป็นโปรเจคย่อยแยก
- **Mission/Achievement ที่ผูกกับ Fantasy** — เพิ่มได้ทันทีหลัง 7B เสร็จ โดยแก้แค่ catalog ไม่ต้อง migrate

## ไฟล์ที่กระทบ

- `prisma/schema.prisma` — 7 model ใหม่ + relation + migrate
- `src/lib/fantasyConfig.ts` · `src/lib/fantasyScoring.ts` · `src/lib/fantasy.ts` · `src/lib/fantasyAdmin.ts` — ใหม่ทั้งหมด
- `src/lib/constants.ts` — เพิ่ม notification types
- `src/lib/notifications.ts` — เพิ่ม 2 ฟังก์ชัน
- `src/lib/pvp.ts` — export `seasonKey()` ใช้ร่วม
- `src/app/fantasy/page.tsx` · `src/components/FantasyPitch.tsx` · `src/app/actions/fantasy.ts` · `src/app/admin/fantasy/**` · `src/app/api/fantasy/close/route.ts` — ใหม่
- `docs/TASKS.md` — แตกขั้น 7 เป็น 7A-7D
