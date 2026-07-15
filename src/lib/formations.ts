// ตำแหน่งช่องในแต่ละ Formation + พิกัดบนสนาม (x,y = 0-100; y สูง = ฝั่งรับ/GK)
export type Slot = { pos: string; x: number; y: number };

export const FORMATIONS: Record<string, Slot[]> = {
  "4-3-3": [
    { pos: "GK", x: 50, y: 92 },
    { pos: "LB", x: 16, y: 70 },
    { pos: "CB", x: 38, y: 74 },
    { pos: "CB", x: 62, y: 74 },
    { pos: "RB", x: 84, y: 70 },
    { pos: "CM", x: 30, y: 48 },
    { pos: "CM", x: 50, y: 52 },
    { pos: "CM", x: 70, y: 48 },
    { pos: "LW", x: 18, y: 22 },
    { pos: "ST", x: 50, y: 16 },
    { pos: "RW", x: 82, y: 22 },
  ],
  "4-4-2": [
    { pos: "GK", x: 50, y: 92 },
    { pos: "LB", x: 16, y: 70 },
    { pos: "CB", x: 38, y: 74 },
    { pos: "CB", x: 62, y: 74 },
    { pos: "RB", x: 84, y: 70 },
    { pos: "LM", x: 16, y: 46 },
    { pos: "CM", x: 40, y: 50 },
    { pos: "CM", x: 60, y: 50 },
    { pos: "RM", x: 84, y: 46 },
    { pos: "ST", x: 38, y: 18 },
    { pos: "ST", x: 62, y: 18 },
  ],
  "3-5-2": [
    { pos: "GK", x: 50, y: 92 },
    { pos: "CB", x: 30, y: 74 },
    { pos: "CB", x: 50, y: 76 },
    { pos: "CB", x: 70, y: 74 },
    { pos: "LM", x: 12, y: 48 },
    { pos: "CM", x: 35, y: 52 },
    { pos: "CM", x: 50, y: 54 },
    { pos: "CM", x: 65, y: 52 },
    { pos: "RM", x: 88, y: 48 },
    { pos: "ST", x: 38, y: 18 },
    { pos: "ST", x: 62, y: 18 },
  ],
  "4-2-3-1": [
    { pos: "GK", x: 50, y: 92 },
    { pos: "LB", x: 16, y: 70 },
    { pos: "CB", x: 38, y: 74 },
    { pos: "CB", x: 62, y: 74 },
    { pos: "RB", x: 84, y: 70 },
    { pos: "CDM", x: 38, y: 56 },
    { pos: "CDM", x: 62, y: 56 },
    { pos: "CAM", x: 50, y: 38 },
    { pos: "LW", x: 18, y: 34 },
    { pos: "RW", x: 82, y: 34 },
    { pos: "ST", x: 50, y: 14 },
  ],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);
export const DEFAULT_FORMATION = "4-3-3";
