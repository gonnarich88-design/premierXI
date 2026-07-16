// ค่าที่ใช้คำนวณ Chemistry ทั้งหมด รวมไว้ที่เดียวเพื่อปรับสมดุลง่าย (ดูวิธีคำนวณใน src/lib/chemistry.ts)

/**
 * แต้ม link score ต่อคู่ผู้เล่นที่มีจุดร่วมกัน (สโมสร/ชาติ)
 * ไม่มี league เพราะเกมนี้มีแต่ Premier League ลีกเดียว ทุกการ์ดแมตช์กันเสมอ 100% —
 * ถ้ามี weight ที่ >0 จะกลายเป็น floor ปลอมที่การันตีคะแนนสูงโดยไม่ต้องจัดทีมเก่งอะไรเลย
 * (ทดสอบแล้ว: ทีมที่ไม่มี synergy จริงเลยแต่ league เดียวกันหมด ได้ teamChem 22/33 ทันที)
 */
export const LINK_WEIGHT = {
  club: 2,
  nation: 1,
} as const;

/** เกณฑ์แปลง linkScore รวม → คะแนนฐาน (base) 0-3 ต่อคน เรียงจากเกณฑ์สูงไปต่ำ */
export const LINK_SCORE_THRESHOLDS = [
  { min: 9, base: 3 },
  { min: 5, base: 2 },
  { min: 2, base: 1 },
  { min: 0, base: 0 },
] as const;

/** factor คูณคะแนนฐานตามความเหมาะสมตำแหน่งที่ลงเล่น */
export const POSITION_FACTOR = {
  exact: 1, // ตรงตำแหน่งหลักหรือตำแหน่งรอง (altPositions)
  sameGroup: 0.6, // อยู่กลุ่มเดียวกัน (GK/DEF/MID/ATT) แต่ไม่ตรงเป๊ะ
  offGroup: 0.3, // คนละกลุ่ม
} as const;

/** Chemistry เต็มทีม (11 ตำแหน่ง x คะแนนฐานสูงสุด 3 แต้ม/คน) */
export const MAX_TEAM_CHEM = 33;

/**
 * ค่าปรับ OVR ลงถ้าเล่นผิดตำแหน่ง (แยกจาก chemistry bonus) — กันกลยุทธ์ยัดการ์ด OVR สูงสุด
 * ทุกช่องโดยไม่สนตำแหน่ง (เดิม rating มีแต่โบนัส ไม่มีบทลงโทษ ทำให้ตำแหน่งไม่มีความหมายเลย)
 */
export const POSITION_OVR_PENALTY = {
  exact: 0,
  sameGroup: 10,
  offGroup: 25,
} as const;

/** โบนัส rating สูงสุดเมื่อ chemistry เต็ม (เช่น 0.1 = ปรับ OVR ขึ้นได้สูงสุด 10%) */
export const MAX_CHEM_RATING_BONUS = 0.1;

/**
 * ขนาดทีมเต็ม (11 คน) — ใช้เป็นตัวหารคงที่สำหรับ avgOvr แทนจำนวนคนที่ลงจริง
 * กันทีมไม่ครบ 11 คนแต่ยังได้ Rating สูงเทียบเท่าทีมครบ (avgOvr เดิมหารด้วย filled ทำให้ทีม
 * ไม่กี่คนที่ OVR สูง+synergy กันดี ได้ Rating ใกล้เคียงทีมเต็มโดยไม่ต้องกรอกให้ครบเลย)
 */
export const MAX_SQUAD_SIZE = 11;

/**
 * Rating บวกพิเศษเมื่อครบเงื่อนไข Full Unity (11 คนสโมสรเดียวกันเป๊ะ + ตำแหน่ง exact ทุกคน)
 * ค่านี้เป็น experimental — ยังไม่มีระบบ PvP/Matchmaking ที่ Rating มีผลจริง (ดู docs/TASKS.md ขั้น 6)
 * ต้องกลับมาทบทวนตอนสร้างระบบนั้น ว่า +2 ยังเหมาะสมอยู่ไหม
 */
export const FULL_UNITY_RATING_BONUS = 2;
