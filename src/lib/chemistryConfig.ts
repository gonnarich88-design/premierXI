// ค่าที่ใช้คำนวณ Chemistry ทั้งหมด รวมไว้ที่เดียวเพื่อปรับสมดุลง่าย (ดูวิธีคำนวณใน src/lib/chemistry.ts)

/** แต้ม link score ต่อคู่ผู้เล่นที่มีจุดร่วมกัน (สโมสร/ชาติ/ลีก) */
export const LINK_WEIGHT = {
  club: 2,
  nation: 1,
  league: 0.5,
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

/** โบนัส rating สูงสุดเมื่อ chemistry เต็ม (เช่น 0.1 = ปรับ OVR ขึ้นได้สูงสุด 10%) */
export const MAX_CHEM_RATING_BONUS = 0.1;
