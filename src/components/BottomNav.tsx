"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

// Solid icons (no emojis per UI guidelines)
const items: (NavItem & { matches?: string[] })[] = [
  {
    href: "/",
    label: "หน้าหลัก",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 1-1.06 1.06l-.44-.44V20a1 1 0 0 1-1 1h-4v-5h-4v5H5a1 1 0 0 1-1-1v-6.85l-.44.44a.75.75 0 0 1-1.06-1.06l8.97-8.63Z" />
      </svg>
    ),
  },
  {
    href: "/pack",
    label: "Store",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 2 3 6v12l9 4 9-4V6l-9-4Zm0 2.2 6.1 2.7L12 9.6 5.9 6.9 12 4.2ZM5 8.6l6 2.7v8.2l-6-2.7V8.6Zm14 0v8.2l-6 2.7v-8.2l6-2.7Z" />
      </svg>
    ),
  },
  {
    href: "/pvp",
    label: "PvP",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="m6.9 3-3.9 2 8.1 8.1-1.5 1.5-1.3-1.3L4 18.6 5.4 20l4.3-4.3 1.3 1.3 1.5-1.5L20 3.7 16.1 5 12 9.1 6.9 3Zm11.1 12.5L14 11.4l1.5-1.5L21 15.5V20l-4.5-1.4-1.3-1.3 1.5-1.5 1.3 1.7Z" />
      </svg>
    ),
  },
  {
    href: "/fantasy",
    label: "Fantasy",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M6 3h12v2h2a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4h-.1A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 7.1 11H7a4 4 0 0 1-4-4V6a1 1 0 0 1 1-1h2V3Zm0 4H5a2 2 0 0 0 2 2V7Zm12 0v2a2 2 0 0 0 2-2h-2Z" />
      </svg>
    ),
  },
  {
    href: "/club",
    label: "My Club",
    matches: ["/club", "/team", "/collection"],
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 2 4 5v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V5l-8-3Z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-surface/90 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = item.href === "/"
            ? pathname === "/"
            : (item.matches ?? [item.href]).some((m) => pathname.startsWith(m));
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2 text-[11px] transition-colors ${
                  active ? "text-primary" : "text-muted hover:text-foreground"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
