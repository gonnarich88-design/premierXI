import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

// Header บางๆ ด้านบน (แสดงเฉพาะตอนล็อกอิน) — กระดิ่งแจ้งเตือน + badge + ออกจากระบบ
// Solid icon, ไม่ใช้ emoji ตามกฎ UI
export default function AppHeader({ unread }: { unread: number }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur">
      <Link href="/" className="text-sm font-extrabold tracking-tight text-primary">
        Premier XI
      </Link>
      <div className="-mr-1 flex items-center gap-1">
        <Link
          href="/notifications"
          aria-label="การแจ้งเตือน"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-foreground"
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
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="ออกจากระบบ"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-red-300"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M16 17v-3H9v-4h7V7l5 5-5 5ZM14 2a2 2 0 0 1 2 2v2h-2V4H5v16h9v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9Z" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  );
}
