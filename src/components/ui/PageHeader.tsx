import Link from "next/link";
import type { ReactNode } from "react";

/** Back arrow + title (+ trailing action slot) — แทน "← กลับ" เปล่าๆ ตาม docs/design.md */
export default function PageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-center gap-2">
      <Link
        href={backHref}
        aria-label="กลับ"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M15.71 6.71a1 1 0 0 0-1.42-1.42l-6 6a1 1 0 0 0 0 1.42l6 6a1 1 0 0 0 1.42-1.42L10.41 12l5.3-5.29Z" />
        </svg>
      </Link>
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {action}
    </header>
  );
}
