// Premier XI — ค่าคงที่กลาง (แทน enum เพราะ SQLite ไม่รองรับ)

/** ระดับของการ์ด เรียงจากต่ำ→สูง */
export const CARD_TIERS = [
  "Bronze",
  "Silver",
  "Gold",
  "Elite",
  "Hero",
  "Icon",
  "Event",
  "TOTW",
  "TOTS",
  "Legend",
] as const;
export type CardTier = (typeof CARD_TIERS)[number];

/** ตำแหน่งนักเตะ (ครอบคลุมที่ปรากฏบนการ์ด EA) */
export const POSITIONS = [
  "GK",
  "LB",
  "LWB",
  "CB",
  "RB",
  "RWB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
  "CF",
] as const;
export type Position = (typeof POSITIONS)[number];

/** หมวดตำแหน่งกว้าง ๆ (ใช้ตอนจัด Starter Pack / Formation) */
export const POSITION_GROUP: Record<Position, "GK" | "DEF" | "MID" | "ATT"> = {
  GK: "GK",
  LB: "DEF",
  LWB: "DEF",
  CB: "DEF",
  RB: "DEF",
  RWB: "DEF",
  CDM: "MID",
  CM: "MID",
  CAM: "MID",
  LM: "MID",
  RM: "MID",
  LW: "ATT",
  RW: "ATT",
  ST: "ATT",
  CF: "ATT",
};

/** สกุลเงินในเกม */
export const CURRENCIES = ["silver", "gold", "packTicket", "shards"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** สี hex ประจำ tier (ใช้ในการ์ด UI) */
export const TIER_COLOR: Record<CardTier, string> = {
  Bronze: "#a97142",
  Silver: "#c9d1e0",
  Gold: "#f5c451",
  Elite: "#7c3aed",
  Hero: "#e11d48",
  Icon: "#f8fafc",
  Event: "#22d3ee",
  TOTW: "#111827",
  TOTS: "#2563eb",
  Legend: "#f59e0b",
};

/** อัตราแลกเปลี่ยน mock: ฝาก 100 บาท = 10 Gold */
export const DEPOSIT_RATE_GOLD_PER_BAHT = 10 / 100;
