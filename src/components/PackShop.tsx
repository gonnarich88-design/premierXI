"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openPackAction, openPackWithShardsAction } from "@/app/actions/pack";
import { openStarterPackAction } from "@/app/actions/starter";
import { TIER_COLOR, type CardTier } from "@/lib/constants";
import PlayerCard from "@/components/PlayerCard";
import Button from "@/components/ui/Button";

type PackMeta = {
  id: string;
  name: string;
  currency: "silver" | "gold" | "shards";
  cost: number;
  desc: string;
  fillerRates: { Bronze: number; Silver: number; Gold: number };
  special: { category: string; bonusChance: number } | null;
};

type ShardExchange = {
  id: string;
  packId: string;
  cost: number;
};

type Wallet = {
  silver: number;
  gold: number;
  shards: number;
};

type RevealCard = {
  id: string;
  ovr: number;
  position: string;
  tier: string;
  imageUrl: string | null;
  playerName: string;
  club: string;
  isDuplicate: boolean;
  shardsGained: number;
  isSpecial: boolean;
};

type Reveal = {
  cards: RevealCard[];
  isStarter: boolean;
};

const CURRENCY_LABEL: Record<string, string> = {
  silver: "Silver",
  gold: "Gold",
  shards: "Shards",
};

const CURRENCY_ICON: Record<string, string> = {
  silver: "/assets/misc/coin-silver-icon.png",
  gold: "/assets/misc/coin-gold-icon.png",
  shards: "/assets/misc/shard-icon.png",
};

function CurrencyIcon({ currency, className }: { currency: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ไฟล์ static ขนาดเล็กคงที่ ดู AppHeader.tsx
    <img
      src={CURRENCY_ICON[currency]}
      alt=""
      className={`${currency === "shards" ? "object-contain" : "rounded-full object-cover"} ${className ?? ""}`}
    />
  );
}

export default function PackShop({
  packs,
  shardExchanges,
  wallet,
  starterClaimed,
}: {
  packs: PackMeta[];
  shardExchanges: ShardExchange[];
  wallet: Wallet;
  starterClaimed: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "opening" | "revealed">("idle");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runOpen(action: () => Promise<Awaited<ReturnType<typeof openPackAction>>>) {
    if (phase === "opening") return;
    setError(null);
    setReveal(null);
    setPhase("opening");
    const res = await action();
    if (!res.ok) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    setTimeout(() => {
      setReveal({ cards: res.result.cards, isStarter: false });
      setPhase("revealed");
    }, 900);
  }

  async function handleOpenStarter() {
    if (phase === "opening") return;
    setError(null);
    setReveal(null);
    setPhase("opening");
    const res = await openStarterPackAction();
    if (!res.ok) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    setTimeout(() => {
      setReveal({
        cards: res.cards.map((c) => ({ ...c, isDuplicate: false, shardsGained: 0, isSpecial: false })),
        isStarter: true,
      });
      setPhase("revealed");
    }, 900);
  }

  function close() {
    setPhase("idle");
    setReveal(null);
    router.refresh();
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">เปิดซองนักเตะ</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1">
            <CurrencyIcon currency="silver" className="h-4 w-4" />
            <span className="text-silver">{wallet.silver.toLocaleString()}</span>
          </span>
          <span className="flex items-center gap-1">
            <CurrencyIcon currency="gold" className="h-4 w-4" />
            <span className="text-gold">{wallet.gold.toLocaleString()}</span>
          </span>
          <span className="flex items-center gap-1">
            <CurrencyIcon currency="shards" className="h-4 w-4" />
            <span className="text-shard">{wallet.shards.toLocaleString()}</span>
          </span>
        </div>
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {/* Starter Pack — ฟรีครั้งแรก */}
      {!starterClaimed && (
        <div className="mb-4 rounded-2xl border border-accent bg-gradient-to-br from-primary/25 to-accent/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold">Starter Pack</h2>
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  ฟรี
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                รับครั้งแรก: การ์ดตั้งต้น 11 ใบ (ครบทุกตำแหน่ง) + 300 Silver
              </p>
            </div>
            <Button
              onClick={handleOpenStarter}
              disabled={phase === "opening"}
              variant="gradient"
              className="shrink-0"
            >
              เปิดฟรี
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {packs.map((pack) => {
          const balance = wallet[pack.currency];
          const canAfford = balance >= pack.cost;
          const exchange = shardExchanges.find((e) => e.packId === pack.id);
          return (
            <div
              key={pack.id}
              className="surface-hub p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold">{pack.name}</h2>
                  <p className="mt-0.5 text-xs text-muted">{pack.desc}</p>
                  <div className="mt-2 flex gap-2 text-[10px] text-muted">
                    <TierPct label="Bronze" v={pack.fillerRates.Bronze} />
                    <TierPct label="Silver" v={pack.fillerRates.Silver} />
                    <TierPct label="Gold" v={pack.fillerRates.Gold} />
                  </div>
                  {pack.special && (
                    <p className="mt-1 text-[10px] text-accent">
                      การันตี 1 ใบพิเศษ + {Math.round(pack.special.bonusChance * 100)}% ลุ้นใบที่ 2
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button
                    onClick={() => runOpen(() => openPackAction(pack.id))}
                    disabled={!canAfford || phase === "opening"}
                    variant="gradient"
                    aria-label={`ซื้อด้วย ${pack.cost} ${CURRENCY_LABEL[pack.currency]}`}
                  >
                    {pack.cost}
                    <CurrencyIcon currency={pack.currency} className="h-4 w-4" />
                  </Button>
                  {exchange && (
                    <button
                      onClick={() => runOpen(() => openPackWithShardsAction(exchange.id))}
                      disabled={wallet.shards < exchange.cost || phase === "opening"}
                      className="flex items-center gap-1 rounded-full border border-accent px-3 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-30"
                      aria-label={`แลก ${exchange.cost} Shards`}
                    >
                      แลก {exchange.cost}
                      <CurrencyIcon currency="shards" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reveal overlay */}
      {phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
          {phase === "opening" && (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="pack-shake text-center">
                <div className="mx-auto flex h-40 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-5xl font-black text-primary-foreground shadow-2xl">
                  ?
                </div>
                <p className="mt-4 text-sm text-muted">กำลังเปิดซอง...</p>
              </div>
            </div>
          )}

          {phase === "revealed" && reveal && (
            <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-8">
              <p className="shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-accent">
                {reveal.isStarter ? "ยินดีต้อนรับสู่ Premier XI" : "ผลการเปิดซอง"}
              </p>
              <p className="mb-4 shrink-0 text-center text-lg font-bold">
                {reveal.isStarter ? "Starter Pack" : "การ์ดที่ได้"} —{" "}
                <span className="text-accent">{reveal.cards.length} ใบ</span>
              </p>
              <div className="w-full max-w-md min-h-0 flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 gap-3 pb-2">
                  {reveal.cards.map((c, i) => {
                    const glow = TIER_COLOR[c.tier as CardTier] ?? "#8b5cf6";
                    return (
                      <div
                        key={`${c.id}-${i}`}
                        className="card-reveal relative"
                        style={{
                          animationDelay: `${i * 60}ms`,
                          filter: `drop-shadow(0 0 ${c.isSpecial ? 12 : 3}px ${glow})`,
                        }}
                      >
                        {c.isSpecial && (
                          <span className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-primary-foreground shadow">
                            {c.tier}
                          </span>
                        )}
                        <PlayerCard
                          imageUrl={c.imageUrl}
                          name={c.playerName}
                          ovr={c.ovr}
                          position={c.position}
                        />
                        {c.isDuplicate && (
                          <p className="mt-1 text-center text-[9px] text-muted">
                            ซ้ำ +{c.shardsGained}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <Button onClick={close} variant="gradient" size="lg" className="my-4 max-w-xs shrink-0">
                {reveal.isStarter ? "เริ่มจัดทีม" : "เยี่ยม"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TierPct({ label, v }: { label: string; v: number }) {
  return (
    <span>
      {label} {Math.round(v * 100)}%
    </span>
  );
}
