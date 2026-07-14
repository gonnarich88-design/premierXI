import { POSITION_GROUP, type Position } from "@/lib/constants";

export type ChemEntry = {
  ovr: number;
  position: string;
  altPositions: string[];
  club: string;
  nation: string;
  league: string;
  slotPos: string;
};

export type ChemResult = {
  teamChem: number; // 0-33
  avgOvr: number;
  rating: number; // OVR ปรับด้วย chemistry
  filled: number;
  perSlot: number[]; // chem 0-3 ต่อผู้เล่น (ตาม index ที่ส่งเข้ามา)
};

// เช็คว่าการ์ดลงช่องนี้ได้ไหม (ตรงตำแหน่งหลักหรือตำแหน่งรอง)
function positionFits(entry: ChemEntry): boolean {
  if (entry.position === entry.slotPos) return true;
  if (entry.altPositions.includes(entry.slotPos)) return true;
  // กลุ่มเดียวกันถือว่าพอลงได้แบบครึ่งคะแนน (จัดการใน factor)
  return false;
}

/**
 * คำนวณ Chemistry แบบเรียบง่าย:
 * - แต่ละผู้เล่นได้แต้มจากการเชื่อมกับเพื่อนร่วมทีม (สโมสร +2, ชาติ +1, ลีก +0.5)
 * - แปลงเป็น 0-3 แต้ม แล้วคูณ factor ตำแหน่ง (ลงตรงตำแหน่ง 1.0, กลุ่มเดียวกัน 0.6, ผิดกลุ่ม 0.3)
 * - teamRating = avgOVR ปรับขึ้นสูงสุด ~+10% ตาม chemistry
 */
export function computeChemistry(entries: (ChemEntry | null)[]): ChemResult {
  const filledEntries = entries.filter((e): e is ChemEntry => e !== null);
  const filled = filledEntries.length;

  if (filled === 0) {
    return { teamChem: 0, avgOvr: 0, rating: 0, filled: 0, perSlot: entries.map(() => 0) };
  }

  const perSlot = entries.map((e) => {
    if (!e) return 0;

    let linkScore = 0;
    for (const other of filledEntries) {
      if (other === e) continue;
      if (other.club === e.club) linkScore += 2;
      if (other.nation === e.nation) linkScore += 1;
      if (other.league === e.league) linkScore += 0.5;
    }

    // แปลง linkScore → 0-3
    let base: number;
    if (linkScore >= 9) base = 3;
    else if (linkScore >= 5) base = 2;
    else if (linkScore >= 2) base = 1;
    else base = 0;

    // factor ตำแหน่ง
    let factor: number;
    if (positionFits(e)) factor = 1;
    else if (
      POSITION_GROUP[e.position as Position] ===
      POSITION_GROUP[e.slotPos as Position]
    )
      factor = 0.6;
    else factor = 0.3;

    return Math.round(base * factor);
  });

  const teamChem = perSlot.reduce((a, b) => a + b, 0);
  const avgOvr = Math.round(
    filledEntries.reduce((a, e) => a + e.ovr, 0) / filled,
  );
  // chemistry เต็ม 33 → โบนัสสูงสุด +10%
  const rating = Math.round(avgOvr * (1 + teamChem / 330));

  return { teamChem, avgOvr, rating, filled, perSlot };
}
