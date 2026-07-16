# Chemistry: Full-Team Dilution + Full Unity Bonus

**วันที่:** 2026-07-16
**สถานะ:** Approved (รีวิวโดย Codex แล้ว, refine ตามข้อเสนอ) — พร้อมเขียนแผน implementation

## บริบท / ปัญหา

ระบบ Chemistry ปัจจุบัน (`src/lib/chemistry.ts`, `src/lib/chemistryConfig.ts`) คำนวณ `avgOvr` โดยหารผลรวม OVR (หลังหัก position penalty) ด้วยจำนวนผู้เล่นที่ **ลงสนามแล้วเท่านั้น** (`filled`) ไม่ใช่ 11 คงที่

ผลคือทีมที่ลงแค่ไม่กี่คน (เช่น 3-6 คน) ที่เป็นการ์ด OVR สูงและ synergy กันดี (สโมสร/ชาติเดียวกัน) จะได้ `Rating` สูงใกล้เคียงกับทีมที่ครบ 11 คนจริง โดยไม่ต้องกรอกให้ครบเลย — เป็นช่องโหว่คล้ายกับ league-floor bug ที่เคยแก้ไปแล้ว (ดู `docs/TASKS.md` ขั้น 10)

นอกจากนี้ ผู้ใช้ต้องการ "โบนัสพิเศษ" เมื่อจัดทีมสโมสรเดียวกันครบทั้ง 11 คน (คล้าย concept "chemistry" ในเกมฟุตบอลการ์ดทั่วไป) แต่ต้องไม่ทำให้เกมเสียสมดุล

## Non-goals

- ไม่ทำเส้นเชื่อม pairwise เต็มรูปแบบแบบ FUT (ทุกคู่ 11×10 เส้นตลอดเวลา) — เกินสโคปและรกเกินไปบนมือถือ ระบบไม่ได้เก็บ per-pair link score อยู่แล้ว
- ไม่ผ่อนปรนเงื่อนไข Full Unity ให้ครอบคลุม sameGroup position — ต้อง exact เท่านั้น
- ไม่เปลี่ยน `teamChem` (x/33) หรือจุดไฟ per-slot (0-3) ให้ scale ตาม filled — ค่านี้ยังคงความหมายเดิม "คนที่ลงแล้วเข้ากันแค่ไหน"
- ไม่ทำ % bonus เพิ่มสำหรับ Full Unity (กันเงินเฟ้อผูกกับ OVR การ์ดในอนาคต) ใช้ค่าคงที่แทน

## ดีไซน์

### 1. แก้ avgOvr ให้หารด้วย 11 คงที่ (ปิดช่องโหว่)

ใน `computeChemistry()`:
- เดิม: `avgOvr = Math.round(effectiveOvrSum / filled)`
- ใหม่: `avgOvr = Math.round(effectiveOvrSum / MAX_SQUAD_SIZE)` — เพิ่มค่าคงที่ใหม่ `MAX_SQUAD_SIZE = 11` ใน `chemistryConfig.ts` แทนที่จะใช้ `entries.length` ตรงๆ (กัน bug แฝงถ้ามีที่เรียก `computeChemistry()` ด้วย array ขนาดอื่นในอนาคต — `computeChemistry` เป็น exported function ไม่มีอะไรการันตีขนาด array ที่ caller ส่งเข้ามา)

ช่องว่าง (ไม่มีการ์ด) จะไม่ contribute เข้า `effectiveOvrSum` เลย เท่ากับนับเป็น OVR effective = 0 ในสูตรเฉลี่ย ทำให้ทีมที่ไม่ครบ 11 คนเห็น Rating ลดลงตามสัดส่วนที่ขาดชัดเจน ไม่ต้องเพิ่ม multiplier `filled/11` ซ้อนในส่วน chemistry bonus (จะกลายเป็นลงโทษซ้ำสอง เพราะ `teamChem` ก็ถูก bound โดยธรรมชาติอยู่แล้วที่ `≤ 3 × filled`)

`teamChem`, `perSlot`, จุดไฟ per-slot: **ไม่เปลี่ยน**

`filled === 0` ยังคง early-return `rating: 0` เหมือนเดิม (ไม่มี div-by-zero เพราะหารด้วย 11 คงที่ ไม่ใช่ filled)

### 2. Full Unity — เงื่อนไข + โบนัส

**เงื่อนไข (ต้องผ่านครบทั้ง 3 ข้อ):**
1. `filled === 11`
2. ทุกคนสโมสร (`club`) เดียวกันเป๊ะ
3. ทุกคนตำแหน่ง `exact` (ใช้ `fitPosition() === "exact"` ที่มีอยู่แล้ว ไม่ต้องเขียนใหม่ — ตรงตำแหน่งหลักหรือ altPositions ไม่ใช่แค่ position group เดียวกัน)

**โบนัส:**
- Rating เพิ่มคงที่ **+2** (ค่าคงที่ใหม่ `FULL_UNITY_RATING_BONUS = 2` ใน `chemistryConfig.ts`) บวกเข้า `rating` หลังคำนวณสูตรเดิมเสร็จแล้ว — แยกชั้นชัดเจนจาก chemistry bonus (`MAX_CHEM_RATING_BONUS`)
- คืนค่า `fullUnity: boolean` เพิ่มใน `ChemResult` ให้ UI ใช้แสดงผล

**เหตุผลเชิงสมดุล:** ทีมสโมสรเดียวกันครบ 11 คน + ตำแหน่งตรงหมด จะชน `MAX_CHEM_RATING_BONUS` (+10%) อยู่แล้วในสูตรเดิม (teamChem=33/33) ดังนั้น +2 คงที่ที่เพิ่มมาเป็นแค่ "รางวัลความสำเร็จ" ก้อนเล็กๆ นอกเหนือจากเพดานเดิม ไม่ compound กับ % ใดๆ กระทบ balance จำกัดและวัดผลง่าย

**หมายเหตุ — Experimental:** รีวิวจาก Codex ชี้ว่า Full Unity จะชน chemistry bonus 10% cap เดิมอยู่แล้วเสมอ (เพราะเงื่อนไขบังคับ teamChem=33/33 โดยอัตโนมัติ) ดังนั้น +2 คือรางวัลซ้อนสองต่อสำหรับการเลือกเดียวกัน (mono-club) — ตอนนี้ยังไม่มีระบบ PvP/Matchmaking จริง (ขั้น 6 ยังไม่เริ่ม) จึงยังไม่มีความเสี่ยงเรื่อง mono-club dominate การแข่งขัน แต่ **mark `FULL_UNITY_RATING_BONUS = 2` เป็นค่า experimental** — ต้องกลับมาทบทวนอีกครั้งตอนสร้างระบบ PvP/Ranking จริง (ดูตอนนั้นว่า Rating มีผลต่อ matchmaking/ranking แค่ไหน ค่อยตัดสินใจว่ายังเหมาะสมอยู่ไหม)

### 3. Visual

- สนามปกติ (ไม่ติด Full Unity): หน้าตาเดิมทุกอย่าง ไม่มีเส้นใดๆ
- ติดเงื่อนไข Full Unity: วาดเส้นสีเขียวบางๆ (SVG overlay) เชื่อม **วงเดียวรอบ 11 จุด** ตามตำแหน่ง x/y ของแต่ละ slot (ไม่ใช่ mesh ทุกคู่) + badge ข้อความ "Full Unity" ใกล้ๆ stat แถวบน (แยกจาก stat Rating/Chemistry/ผู้เล่น เดิม)
- **ลำดับจุดเชื่อมเส้น:** ต้อง sort จุดตามตำแหน่งบนสนามให้เป็นวงเรียบร้อย (เช่น เรียงตามมุม/ระยะจากจุดศูนย์กลางสนาม) ไม่ใช่เชื่อมตามลำดับ index ของ `slots` array ตรงๆ — ลำดับ array อิงตาม formation layout ซึ่งไม่ได้เรียงเป็นวงลอจิคัล ถ้าเชื่อมตรงๆ อาจได้เส้นทแยงตัดสนามแทนวงที่สวยงาม ต้องเช็คภาพจริงกับทุก formation ที่มี (4-3-3, 4-4-2, 3-5-2, 4-2-3-1)
- SVG overlay ต้องมี `pointer-events-none` (กันบัง tap การ์ด/ช่อง) และกำหนด z-order ชัดเจน (อยู่เหนือพื้นสนาม ใต้การ์ดผู้เล่น)

## ไฟล์ที่กระทบ

- `src/lib/chemistryConfig.ts` — เพิ่ม `FULL_UNITY_RATING_BONUS`
- `src/lib/chemistry.ts` — แก้ avgOvr divisor, เพิ่ม fullUnity check + bonus, เพิ่ม field `fullUnity` ใน `ChemResult`
- `src/app/team/page.tsx` — ส่ง `fullUnity` ต่อให้ `TeamBuilder`
- `src/components/TeamBuilder.tsx` — badge "Full Unity" + SVG เส้นเขียวรอบ 11 จุดเมื่อ `fullUnity === true` (เรียงจุดเป็นวง, `pointer-events-none`, z-order ถูกต้อง)
- `docs/system-reference.md` — อัพเดตตาราง `ChemResult` (7.8) ให้มี field `fullUnity` และตาราง `chemistryConfig.ts` (7.7) ให้มี `MAX_SQUAD_SIZE`, `FULL_UNITY_RATING_BONUS` — **หมายเหตุ:** ตอนแก้ไฟล์นี้พบว่าตารางปัจจุบัน (บรรทัด 562, 572) ยังอ้างอิง `league` (`LINK_WEIGHT.league`, `ChemEntry.league`) ซึ่งถูกตัดออกจากโค้ดจริงไปแล้วตั้งแต่ 2026-07-16 (ดู `docs/TASKS.md` ขั้น 10) — เป็น doc drift เก่าที่ไม่เกี่ยวกับงานนี้โดยตรง แต่ควรแก้พร้อมกันเพราะอยู่ในตารางเดียวกันที่กำลังแก้อยู่แล้ว

## Test matrix (automated)

เพิ่ม test สำหรับ `computeChemistry()` (ตามแพทเทิร์นสคริปต์ verify ที่โปรเจคใช้อยู่แล้วในขั้นอื่นๆ) ครอบคลุม:
1. Squad ว่างเปล่า (filled=0) → rating=0 เหมือนเดิม
2. Squad ไม่ครบ (เช่น filled=5, OVR สูง+synergy เต็ม) → rating ลดตามสัดส่วนสอดคล้องสูตรใหม่ (ไม่ใช่ใกล้เคียงทีมครบแบบเดิม)
3. Squad ครบ 11 คนทั่วไป (ไม่ mono-club) → ผลลัพธ์เหมือนพฤติกรรมเดิมทุกประการ (regression check)
4. Full Unity ครบเงื่อนไขจริง (11 คนสโมสรเดียวกัน + ตำแหน่ง exact ทุกคน) → `fullUnity=true`, rating = สูตรเดิม + 2
5. มี 1 คนสโมสรต่างจากที่เหลือ (ครบ 11 + ตำแหน่งตรงหมด) → `fullUnity=false`
6. มี 1 คนตำแหน่งไม่ exact (อยู่ sameGroup แต่ไม่ตรง ทั้งที่สโมสรเดียวกันหมด) → `fullUnity=false`
7. ตำแหน่งตรงผ่าน `altPositions` (ไม่ใช่ position หลัก) → นับเป็น exact ได้ (ตาม `fitPosition()` เดิม) → ยังติด Full Unity ได้ถ้าเงื่อนไขอื่นผ่าน
8. ถอดผู้เล่น 1 คนออกจาก Full Unity squad → `fullUnity` กลับเป็น false (และ UI ต้องซ่อนเส้น/badge ตาม)

## Verification

- Automated test matrix ด้านบนผ่านทั้งหมด
- Browser check ผ่าน Preview: จัดทีมให้ครบ Full Unity จริงแล้วดู badge + เส้นเขียวขึ้นจริงเป็นวงเรียบร้อยไม่ตัดสนาม (เช็คหลาย formation), ลองถอดการ์ด 1 ใบออกแล้วดูเส้น/badge หายไปทันที, เช็คว่าเส้นไม่บัง tap ช่อง/การ์ด
