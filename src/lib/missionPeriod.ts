import { dayIndex } from "@/lib/daily";

/** periodKey ของมิชชั่นรายวัน — ใช้ epoch-day เดียวกับ Daily Login (dayIndex ใน daily.ts) เพื่อให้ boundary UTC ตรงกันทั้งระบบ */
export function dailyPeriodKey(d: Date): string {
  return String(dayIndex(d));
}

/** periodKey ของมิชชั่นรายสัปดาห์ — epoch-week (ไม่ใช่ปฏิทิน Mon-Sun) เรียบง่าย ไม่ต้องพึ่ง library ปฏิทิน */
export function weeklyPeriodKey(d: Date): string {
  return String(Math.floor(dayIndex(d) / 7));
}
