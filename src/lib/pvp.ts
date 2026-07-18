// PvP (Phase 3) — pattern เดียวกับ packs.ts/daily.ts: pure function ก่อน แยกจาก DB access
// เพื่อเทสได้โดยไม่พึ่ง Math.random()/new Date() จริงตอนรัน — ดู docs/superpowers/specs/2026-07-17-pvp-design.md

export const PVP_TIERS = [
  { key: "bronze", label: "Bronze", min: 0 },
  { key: "silver", label: "Silver", min: 100 },
  { key: "gold", label: "Gold", min: 250 },
  { key: "elite", label: "Elite", min: 450 },
  { key: "champion", label: "Champion", min: 700 },
  { key: "legend", label: "Legend", min: 1000 },
] as const;
export type PvpTierKey = (typeof PVP_TIERS)[number]["key"];
export type PvpTier = (typeof PVP_TIERS)[number];

/** Tier ไม่ store แยกใน DB — derive จาก pvpRP เสมอ (single source of truth เดียวกับแนวทาง levelReward() ใน economy.ts) */
export function tierForRP(rp: number): PvpTier {
  return [...PVP_TIERS].reverse().find((t) => rp >= t.min)!;
}

/** season = เดือนปฏิทิน UTC เสมอ ("2026-07") — ตัว boundary UTC เดียวกับที่ dayIndex()/daily.ts ใช้ทั้งระบบ */
export function seasonKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** โบนัส EXP ต่อ win-streak คำนวณจาก streak ใหม่หลัง increment แล้ว (newStreak=1→0, 2→+5, 3→+10, 4+→เพดาน+15) */
export function winStreakBonus(newStreak: number): number {
  return Math.min((newStreak - 1) * 5, 15);
}

/** multiplier ตาม opponent strength — ใช้ร่วมกันทั้ง EXP/Silver (ตอนชนะ) และ RP (ทั้งชนะ/แพ้) */
export function rpMultiplier(oppRating: number, myRating: number): number {
  return Math.min(1.5, Math.max(0.5, oppRating / myRating));
}

/** RP ที่ได้/เสียต่อแมตช์ — ทิศทางสลับกันตั้งใจตอนแพ้ (คู่แข่งอ่อนกว่าเสีย RP เยอะกว่า คู่แข่งแรงกว่าเสียน้อยกว่า)
 * ที่ multiplier=1 ชนะ+20/แพ้-15 ไม่ zero-sum โดยตั้งใจ (progression ladder ชดเชยด้วย hard reset รายเดือน — ดูสเปคหัวข้อ 7) */
export function rpDeltaForOutcome(outcome: "win" | "draw" | "lose", mult: number): number {
  if (outcome === "win") return Math.round(20 * mult);
  if (outcome === "lose") return -Math.round(15 * (2 - mult));
  return 0;
}
