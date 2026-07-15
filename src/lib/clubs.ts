// map ชื่อโฟลเดอร์ → ชื่อสโมสรจริง (โฟลเดอร์สะกดไม่ตรงบ้าง)
export const CLUB_BY_FOLDER: Record<string, string> = {
  arsenal: "Arsenal",
  astonvilla: "Aston Villa",
  bournemouth: "AFC Bournemouth",
  brentford: "Brentford",
  brighton: "Brighton & Hove Albion",
  chelsea: "Chelsea",
  coventry: "Coventry City",
  crystalpalace: "Crystal Palace",
  everton: "Everton",
  fulham: "Fulham",
  hull: "Hull City",
  ipswich: "Ipswich Town",
  leeds: "Leeds United",
  liverpool: "Liverpool",
  mancity: "Manchester City",
  manunited: "Manchester United",
  newcastle: "Newcastle United",
  nottingham: "Nottingham Forest",
  sunderland: "Sunderland",
  tottenham: "Tottenham Hotspur",
};

export function clubFromFolder(folder: string): string {
  return CLUB_BY_FOLDER[folder] ?? folder;
}
