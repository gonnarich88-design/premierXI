import { POSITION_GROUP, type Position } from "@/lib/constants";
import {
  LINK_WEIGHT,
  LINK_SCORE_THRESHOLDS,
  POSITION_FACTOR,
  POSITION_OVR_PENALTY,
  MAX_TEAM_CHEM,
  MAX_CHEM_RATING_BONUS,
  MAX_SQUAD_SIZE,
  FULL_UNITY_RATING_BONUS,
} from "@/lib/chemistryConfig";

export type ChemEntry = {
  ovr: number;
  position: string;
  altPositions: string[];
  club: string;
  nation: string;
  slotPos: string;
};

export type ChemResult = {
  teamChem: number; // 0-33
  avgOvr: number;
  rating: number; // OVR ปรับด้วย chemistry
  filled: number;
  perSlot: number[]; // chem 0-3 ต่อผู้เล่น (ตาม index ที่ส่งเข้ามา)
  fullUnity: boolean; // ครบ 11 คน + สโมสรเดียวกันเป๊ะ + ตำแหน่ง exact ทุกคน
};

type PositionFit = "exact" | "sameGroup" | "offGroup";

// จัดระดับความเข้ากันของตำแหน่งการ์ดกับช่องที่ลง (ใช้ร่วมกันทั้ง chemistry factor และ OVR penalty)
function fitPosition(entry: ChemEntry): PositionFit {
  if (entry.position === entry.slotPos) return "exact";
  if (entry.altPositions.includes(entry.slotPos)) return "exact";
  if (
    POSITION_GROUP[entry.position as Position] ===
    POSITION_GROUP[entry.slotPos as Position]
  )
    return "sameGroup";
  return "offGroup";
}

/**
 * คำนวณ Chemistry แบบเรียบง่าย:
 * - แต่ละผู้เล่นได้แต้มจากการเชื่อมกับเพื่อนร่วมทีม (สโมสร +2, ชาติ +1)
 * - แปลงเป็น 0-3 แต้ม แล้วคูณ factor ตำแหน่ง (ลงตรงตำแหน่ง 1.0, กลุ่มเดียวกัน 0.6, ผิดกลุ่ม 0.3)
 * - avgOvr คิดจาก OVR จริงหักด้วย POSITION_OVR_PENALTY ถ้าเล่นผิดตำแหน่ง (กันยัดการ์ด OVR สูงสุด
 *   ทุกช่องโดยไม่สนตำแหน่ง — ถ้าไม่หัก ตำแหน่งจะไม่มีผลอะไรต่อพลังทีมเลยนอกจาก chemistry bonus เล็กน้อย)
 * - teamRating = avgOVR (หลังหัก penalty) ปรับขึ้นสูงสุด ~+10% ตาม chemistry
 */
export function computeChemistry(entries: (ChemEntry | null)[]): ChemResult {
  const filledEntries = entries.filter((e): e is ChemEntry => e !== null);
  const filled = filledEntries.length;

  if (filled === 0) {
    return {
      teamChem: 0,
      avgOvr: 0,
      rating: 0,
      filled: 0,
      perSlot: entries.map(() => 0),
      fullUnity: false,
    };
  }

  let effectiveOvrSum = 0;

  const perSlot = entries.map((e) => {
    if (!e) return 0;

    const fit = fitPosition(e);
    effectiveOvrSum += e.ovr - POSITION_OVR_PENALTY[fit];

    let linkScore = 0;
    for (const other of filledEntries) {
      if (other === e) continue;
      if (other.club === e.club) linkScore += LINK_WEIGHT.club;
      if (other.nation === e.nation) linkScore += LINK_WEIGHT.nation;
    }

    // แปลง linkScore → 0-3
    const base =
      LINK_SCORE_THRESHOLDS.find((t) => linkScore >= t.min)?.base ?? 0;

    return Math.round(base * POSITION_FACTOR[fit]);
  });

  const teamChem = perSlot.reduce((a, b) => a + b, 0);
  // หารด้วย MAX_SQUAD_SIZE คงที่ (ไม่ใช่ filled) กันทีมไม่ครบได้ rating สูงเทียบเท่าทีมครบ
  const avgOvr = Math.round(effectiveOvrSum / MAX_SQUAD_SIZE);

  const fullUnity =
    filled === MAX_SQUAD_SIZE &&
    filledEntries.every((e) => e.club === filledEntries[0].club) &&
    filledEntries.every((e) => fitPosition(e) === "exact");

  // chemistry เต็ม MAX_TEAM_CHEM → โบนัสสูงสุด MAX_CHEM_RATING_BONUS
  const baseRating = Math.round(
    avgOvr * (1 + (teamChem / MAX_TEAM_CHEM) * MAX_CHEM_RATING_BONUS),
  );
  const rating = fullUnity ? baseRating + FULL_UNITY_RATING_BONUS : baseRating;

  return { teamChem, avgOvr, rating, filled, perSlot, fullUnity };
}
