import type { ReactNode } from "react";

/** ตัวเลขเด่น + label เล็กใต้ (§1.4/§2 ของ docs/design.md) */
export function Stat({
  value,
  label,
  className = "",
}: {
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-0.5 px-2 text-center ${className}`}>
      <span className="text-stat-hero text-2xl text-foreground">{value}</span>
      <span className="text-stat-label">{label}</span>
    </div>
  );
}

/** แถวสถิติคั่นเส้นบาง แบบ Screen 2 ของรูปตัวอย่าง — ใส่ <Stat> เป็นลูกได้หลายตัว */
export function StatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`surface-card flex items-stretch divide-x divide-border rounded-2xl py-3 ${className}`}
    >
      {children}
    </div>
  );
}
