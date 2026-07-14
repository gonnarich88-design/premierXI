import Link from "next/link";

// Header บางๆ ด้านบน (แสดงเฉพาะตอนล็อกอิน) — กระดิ่งแจ้งเตือน + badge
// Solid icon, ไม่ใช้ emoji ตามกฎ UI
export default function AppHeader({ unread }: { unread: number }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur">
      <Link href="/" className="text-sm font-extrabold tracking-tight text-primary">
        Premier XI
      </Link>
      <Link
        href="/notifications"
        aria-label="การแจ้งเตือน"
        className="relative -mr-1 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
          <path d="M12 2a6 6 0 0 0-6 6c0 3.09-.78 5.2-1.64 6.6-.5.82.1 1.9 1.07 1.9h13.14c.97 0 1.57-1.08 1.07-1.9C18.78 13.2 18 11.09 18 8a6 6 0 0 0-6-6Zm0 20a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </header>
  );
}
