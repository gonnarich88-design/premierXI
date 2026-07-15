import { POSITION_GROUP, type Position } from "@/lib/constants";

/** อนุมาน tier ของการ์ด normal จาก OVR (มาตรฐาน EA) */
export function deriveTier(ovr: number): "Bronze" | "Silver" | "Gold" {
  if (ovr >= 75) return "Gold";
  if (ovr >= 65) return "Silver";
  return "Bronze";
}

type Stats = {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
};

// offset ของแต่ละค่าพลังเทียบกับ OVR ตามกลุ่มตำแหน่ง
const OFFSETS: Record<"GK" | "DEF" | "MID" | "ATT", Stats> = {
  GK: { pace: -18, shooting: -45, passing: -8, dribbling: -25, defending: -30, physical: -2 },
  DEF: { pace: -2, shooting: -25, passing: -8, dribbling: -8, defending: 6, physical: 4 },
  MID: { pace: -3, shooting: -5, passing: 5, dribbling: 4, defending: -4, physical: -2 },
  ATT: { pace: 5, shooting: 7, passing: -5, dribbling: 6, defending: -30, physical: -4 },
};

const clamp = (n: number) => Math.max(30, Math.min(99, Math.round(n)));

/**
 * สร้างค่าพลัง 6 ตัวจาก OVR + ตำแหน่ง (deterministic — ไม่มีค่าสุ่ม)
 * ใช้เมื่อค่าพลังไม่ได้อยู่บนหน้าการ์ด
 */
export function generateStats(ovr: number, position: string): Stats {
  const group = POSITION_GROUP[position as Position] ?? "MID";
  const off = OFFSETS[group];
  return {
    pace: clamp(ovr + off.pace),
    shooting: clamp(ovr + off.shooting),
    passing: clamp(ovr + off.passing),
    dribbling: clamp(ovr + off.dribbling),
    defending: clamp(ovr + off.defending),
    physical: clamp(ovr + off.physical),
  };
}
