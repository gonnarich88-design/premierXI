import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href?: string;
  glow?: boolean;
  hub?: boolean;
  className?: string;
  children: ReactNode;
};

/** Bento surface การ์ดมาตรฐาน ตาม docs/design.md
 *  - default = `.surface-card` (app surface ทั่วไป)
 *  - `hub` = `.surface-hub` (hub/reference theme จาก `/design-system`)
 */
export default function Card({ href, glow = false, hub = false, className = "", children }: Props) {
  const surface = hub ? "surface-hub rounded-[24px]" : "surface-card rounded-2xl";
  const cls = `${surface} block p-4 transition hover:brightness-110 ${glow ? "hover:glow-primary" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return <div className={cls}>{children}</div>;
}
