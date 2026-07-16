# Chemistry: Full-Team Dilution + Full Unity Bonus

**วันที่:** 2026-07-16
**สถานะ:** Approved — พร้อมเขียนแผน implementation

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
- ใหม่: `avgOvr = Math.round(effectiveOvrSum / entries.length)` (entries.length เท่ากับ 11 เสมอ ตาม formation layout ทุกแบบ)

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

### 3. Visual

- สนามปกติ (ไม่ติด Full Unity): หน้าตาเดิมทุกอย่าง ไม่มีเส้นใดๆ
- ติดเงื่อนไข Full Unity: วาดเส้นสีเขียวบางๆ (SVG overlay) เชื่อม **วงเดียวรอบ 11 จุด** ตามตำแหน่ง x/y ของแต่ละ slot (ไม่ใช่ mesh ทุกคู่) + badge ข้อความ "Full Unity" ใกล้ๆ stat แถวบน (แยกจาก stat Rating/Chemistry/ผู้เล่น เดิม)

## ไฟล์ที่กระทบ

- `src/lib/chemistryConfig.ts` — เพิ่ม `FULL_UNITY_RATING_BONUS`
- `src/lib/chemistry.ts` — แก้ avgOvr divisor, เพิ่ม fullUnity check + bonus, เพิ่ม field `fullUnity` ใน `ChemResult`
- `src/app/team/page.tsx` — ส่ง `fullUnity` ต่อให้ `TeamBuilder`
- `src/components/TeamBuilder.tsx` — badge "Full Unity" + SVG เส้นเขียวรอบ 11 จุดเมื่อ `fullUnity === true`

## Verification

- Unit-level manual check (สคริปต์ทดสอบแบบที่โปรเจคเคยใช้ในขั้นอื่นๆ): ทีมไม่ครบ 11 → rating ลดลงตามสัดส่วนจริง, ทีมครบ 11 สโมสรเดียวกัน+ตำแหน่งตรงหมด → `fullUnity=true` และ rating บวก +2 ตรงตามสเปค, ทีมครบ 11 แต่สโมสรไม่ตรงกันหมดหรือมีตำแหน่ง sameGroup → `fullUnity=false`
- Browser check ผ่าน Preview: จัดทีมให้ครบ Full Unity จริงแล้วดู badge + เส้นเขียวขึ้นจริง, ลองถอดการ์ด 1 ใบออกแล้วดูเส้น/badge หายไป
