import Link from "next/link";
import { ReactNode } from "react";

const CURRENCIES = [
  { value: 0, icon: CoinIcon, color: "#f5c451" },
  { value: 0, icon: GemIcon, color: "#34d399" },
  { value: 0, icon: TokenIcon, color: "#f87171" },
];

const CARDS = [
  { title: "Colors", badge: "11", icon: PaletteIcon, href: "#colors" },
  { title: "Typography", badge: null, icon: TypeIcon, href: "#typography" },
  { title: "Components", badge: "7", icon: LayersIcon, href: "#components" },
  { title: "Motion", badge: null, icon: SparklesIcon, href: "#motion" },
  { title: "Icons", badge: "5", icon: GridIcon, href: "#icons" },
  { title: "Patterns", badge: null, icon: LayoutIcon, href: "#patterns", full: true },
];

const COLORS = [
  { name: "background", var: "--background" },
  { name: "surface", var: "--surface" },
  { name: "surface-2", var: "--surface-2" },
  { name: "border", var: "--border" },
  { name: "foreground", var: "--foreground" },
  { name: "muted", var: "--muted" },
  { name: "primary", var: "--primary" },
  { name: "primary-strong", var: "--primary-strong" },
  { name: "accent", var: "--accent" },
  { name: "gold", var: "--gold" },
  { name: "silver", var: "--silver" },
];

const HUB_CARD =
  "relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-gradient-to-br from-[#2f374c] via-[#252b3a] to-[#151821] shadow-lg shadow-black/30 transition hover:brightness-110";

export default function DesignSystemPage() {
  return (
    <div
      className="-mx-4 -mt-6 min-h-[calc(100dvh-4rem)] px-4 pt-4 pb-20"
      style={{ background: "radial-gradient(120% 60% at 50% -10%, rgba(76, 29, 149, 0.35), #05040a 60%)" }}
    >
      {/* App-style header */}
      <header className="mb-3 flex items-center justify-between py-2">
        <button
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
        >
          <GearIcon />
        </button>
        <h1 className="text-lg font-bold text-white">Design System</h1>
        <Link
          href="/collection"
          aria-label="Collection"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
        >
          <BagIcon />
        </Link>
      </header>

      {/* Currency row */}
      <div className="mb-4 flex justify-end gap-4">
        {CURRENCIES.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 text-sm font-bold text-white">
            <c.icon color={c.color} />
            <span>{c.value.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Hero card */}
      <div className={`${HUB_CARD} mb-4 aspect-[16/10]`}>
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" />

        <span className="absolute left-5 top-5 z-10 text-xl font-bold text-white">Premier XI</span>
        <span className="absolute bottom-5 left-5 z-10 rounded-full bg-[#0ea5e9] px-3.5 py-1.5 text-xs font-extrabold text-[#05040a]">
          Design Reference
        </span>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className={`group ${HUB_CARD} flex flex-col justify-between p-4 ${
              card.full ? "col-span-2 aspect-[2.2/1]" : "aspect-square"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" />
            <span className="relative z-10 text-sm font-bold text-white">{card.title}</span>
            <div className="relative z-10 flex flex-1 items-center justify-center">
              <card.icon className="h-14 w-14 text-white/90 transition group-hover:scale-105" />
            </div>
            {card.badge ? (
              <span className="relative z-10 self-start rounded-full bg-[#0ea5e9] px-2.5 py-1 text-[10px] font-extrabold text-[#05040a]">
                {card.badge} items
              </span>
            ) : (
              <span className="relative z-10 h-6" />
            )}
          </Link>
        ))}
      </div>

      {/* Reference sections */}
      <Section title="Colors" id="colors">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COLORS.map((c) => (
            <div
              key={c.name}
              className="rounded-2xl p-3 text-xs font-semibold"
              style={{ backgroundColor: `var(${c.var})`, color: c.name === "foreground" || c.name === "gold" || c.name === "silver" ? "#05040a" : "#f4f1fb" }}
            >
              {c.name}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" id="typography">
        <div className="space-y-2 rounded-[24px] border border-white/[0.06] bg-gradient-to-br from-[#2f374c] via-[#252b3a] to-[#151821] p-4">
          <p className="text-3xl font-extrabold tracking-tight text-transparent bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] bg-clip-text">
            Display
          </p>
          <p className="text-stat-hero text-2xl text-white">Stat Hero 88</p>
          <p className="text-stat-label">Stat Label</p>
          <p className="text-xl font-bold text-white">Title</p>
          <p className="text-sm text-white/80">Body</p>
          <p className="text-xs text-white/50">Muted</p>
        </div>
      </Section>

      <Section title="Components" id="components">
        <div className="space-y-3 rounded-[24px] border border-white/[0.06] bg-gradient-to-br from-[#2f374c] via-[#252b3a] to-[#151821] p-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] px-4 py-2 text-sm font-bold text-white">Gradient</span>
            <span className="rounded-full border border-[#8b5cf6] px-4 py-2 text-sm font-bold text-[#8b5cf6]">Outline</span>
            <span className="rounded-xl bg-[#8b5cf6] px-4 py-2 text-sm font-bold text-white">Solid</span>
            <span className="rounded-xl px-4 py-2 text-sm font-bold text-white/60 hover:text-white">Ghost</span>
          </div>
          <div className="rounded-2xl border border-[#362358] bg-[#1a0f33]/60 p-3 text-sm text-white/80">Card surface</div>
          <div className="flex divide-x divide-[#362358] rounded-2xl border border-[#362358] bg-[#1a0f33]/60 py-3">
            <div className="flex flex-1 flex-col items-center gap-0.5 px-2">
              <span className="text-stat-hero text-2xl text-white">88</span>
              <span className="text-stat-label">Rating</span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-0.5 px-2">
              <span className="text-stat-hero text-2xl text-white">12</span>
              <span className="text-stat-label">Wins</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Motion" id="motion">
        <div className="flex gap-3">
          <div className="pack-shake rounded-[20px] border border-white/[0.06] bg-gradient-to-br from-[#2f374c] via-[#252b3a] to-[#151821] px-5 py-3 text-sm font-semibold text-white">
            Pack Shake
          </div>
          <div className="card-reveal rounded-[20px] border border-white/[0.06] bg-gradient-to-br from-[#2f374c] via-[#252b3a] to-[#151821] px-5 py-3 text-sm font-semibold text-white">
            Card Reveal
          </div>
        </div>
      </Section>

      <Section title="Icons" id="icons">
        <div className="flex flex-wrap gap-4 rounded-[24px] border border-white/[0.06] bg-gradient-to-br from-[#2f374c] via-[#252b3a] to-[#151821] p-4">
          <GearIcon className="h-8 w-8 text-white" />
          <BagIcon className="h-8 w-8 text-white" />
          <PaletteIcon className="h-8 w-8 text-white" />
          <TypeIcon className="h-8 w-8 text-white" />
          <LayersIcon className="h-8 w-8 text-white" />
        </div>
      </Section>

      <Section title="Patterns" id="patterns">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 rounded-[24px] border border-white/[0.06] bg-gradient-to-br from-[#2f374c] via-[#252b3a] to-[#151821] p-4">
            <span className="text-sm font-bold text-white">Bento Hub</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="aspect-square rounded-2xl bg-[#0f111a]" />
              <div className="aspect-square rounded-2xl bg-[#0f111a]" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-8">
      <h2 className="mb-3 text-lg font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

function GearIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5Zm7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.66a.5.5 0 0 0 .11-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.37-2.65A.5.5 0 0 0 13.25 2h-2.5a.5.5 0 0 0-.49.42L9.89 5.07a7.03 7.03 0 0 0-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .11.64L5.34 9.53c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66a.5.5 0 0 0-.11.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1.01c.53.4 1.1.74 1.69.98l.37 2.65a.5.5 0 0 0 .49.42h2.5a.5.5 0 0 0 .49-.42l.37-2.65a7.03 7.03 0 0 0 1.69-.98l2.49 1.01a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.11-.64l-2.11-1.66Z" />
    </svg>
  );
}

function BagIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17 6h-2V5a3 3 0 0 0-6 0v1H7a2 3 0 0 0-2 3v9a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V9a2 3 0 0 0-2-3Zm-6-1a1 1 0 0 1 2 0v1h-2V5Zm-2 5a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm6 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z" />
    </svg>
  );
}

function CoinIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={color}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-1.5c0-.83.67-1.5 1.5-1.5h.5c.28 0 .5.22.5.5v.5c0 .28-.22.5-.5.5h-1v1Zm0-4.5h-1c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2h1c1.1 0 2 .9 2 2v.5h-2v-.5h-1v1.5h1c1.1 0 2 .9 2 2v.5c0 1.1-.9 2-2 2Z" />
    </svg>
  );
}

function GemIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={color}>
      <path d="M12 2 3 9l9 13 9-13-9-7Zm0 3.5L18.5 9 12 19 5.5 9 12 5.5Z" />
    </svg>
  );
}

function TokenIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={color}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-8h2v-4h-2v4Zm0 2v2h2v-2h-2Z" />
    </svg>
  );
}

function PaletteIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.69-.28-1.32-.73-1.77-.45-.46-.73-1.09-.73-1.77 0-1.38 1.12-2.5 2.5-2.5h2.33c2.76 0 5-2.24 5-5 0-4.14-4.5-7.46-9.87-7.46Zm-4.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
  );
}

function TypeIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 6h7v2H9v10H7V8H4V6Zm9 0h7v2h-3v10h-2V8h-2V6Z" />
    </svg>
  );
}

function LayersIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="m12 2 10 5-10 5L2 7l10-5Zm0 9 5.5-2.75L22 12l-10 5L2 12l4.5-3.75L12 11Zm0 7 5.5-2.75L22 19l-10 5-10-5 4.5-3.75L12 18Z" />
    </svg>
  );
}

function SparklesIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="m12 2 .9 4.1L17 7l-4.1.9L12 12l-.9-4.1L7 7l4.1-.9L12 2Zm5 9 1.4 2.6L21 15l-2.6 1.4L17 19l-1.4-2.6L13 15l2.6-1.4L17 11ZM5 11l1.1 2.4L8.5 14.5l-2.4 1.1L5 18l-1.1-2.4L1.5 14.5l2.4-1.1L5 11Z" />
    </svg>
  );
}

function GridIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />
    </svg>
  );
}

function LayoutIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3 4h18v3H3V4Zm0 6h12v3H3v-3Zm0 6h18v3H3v-3Z" />
    </svg>
  );
}
