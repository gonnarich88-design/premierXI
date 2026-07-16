import { POSITION_GROUP, type Position } from "@/lib/constants";
import {
  LINK_WEIGHT,
  LINK_SCORE_THRESHOLDS,
  POSITION_FACTOR,
  MAX_TEAM_CHEM,
  MAX_CHEM_RATING_BONUS,
} from "@/lib/chemistryConfig";

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
      if (other.club === e.club) linkScore += LINK_WEIGHT.club;
      if (other.nation === e.nation) linkScore += LINK_WEIGHT.nation;
      if (other.league === e.league) linkScore += LINK_WEIGHT.league;
    }

    // แปลง linkScore → 0-3
    const base =
      LINK_SCORE_THRESHOLDS.find((t) => linkScore >= t.min)?.base ?? 0;

    // factor ตำแหน่ง
    let factor: number;
    if (positionFits(e)) factor = POSITION_FACTOR.exact;
    else if (
      POSITION_GROUP[e.position as Position] ===
      POSITION_GROUP[e.slotPos as Position]
    )
      factor = POSITION_FACTOR.sameGroup;
    else factor = POSITION_FACTOR.offGroup;

    return Math.round(base * factor);
  });

  const teamChem = perSlot.reduce((a, b) => a + b, 0);
  const avgOvr = Math.round(
    filledEntries.reduce((a, e) => a + e.ovr, 0) / filled,
  );
  // chemistry เต็ม MAX_TEAM_CHEM → โบนัสสูงสุด MAX_CHEM_RATING_BONUS
  const rating = Math.round(
    avgOvr * (1 + (teamChem / MAX_TEAM_CHEM) * MAX_CHEM_RATING_BONUS),
  );

  return { teamChem, avgOvr, rating, filled, perSlot };
}
