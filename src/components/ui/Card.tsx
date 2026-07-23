import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href?: string;
  glow?: boolean;
  className?: string;
  children: ReactNode;
};

/** Bento surface การ์ดมาตรฐาน (canonicalize จาก pattern เดิมใน club/fantasy hub) ตาม docs/design.md */
export default function Card({ href, glow = false, className = "", children }: Props) {
  const cls = `surface-card block rounded-2xl p-4 transition hover:brightness-110 ${glow ? "hover:glow-primary" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return <div className={cls}>{children}</div>;
}
