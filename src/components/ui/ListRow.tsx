import Link from "next/link";
import type { ReactNode } from "react";
import Avatar from "./Avatar";

type Props = {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  href?: string;
  trailing?: ReactNode;
  className?: string;
};

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-muted">
    <path d="M9.29 6.71a1 1 0 0 1 1.42 0l5 5a1 1 0 0 1 0 1.42l-5 5a1 1 0 1 1-1.42-1.42L13.59 13H5a1 1 0 1 1 0-2h8.59L9.29 8.12a1 1 0 0 1 0-1.41Z" />
  </svg>
);

/** แถวรายการ: avatar + title + subtitle จาง + chevron ต่อท้าย ตาม docs/design.md */
export default function ListRow({ title, subtitle, imageUrl, href, trailing, className = "" }: Props) {
  const body = (
    <div
      className={`surface-card flex items-center gap-3 rounded-2xl p-3 transition hover:brightness-110 ${className}`}
    >
      <Avatar imageUrl={imageUrl} alt={title} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {trailing ?? (href && <ChevronIcon />)}
    </div>
  );

  if (href) {
    return <Link href={href}>{body}</Link>;
  }

  return body;
}
