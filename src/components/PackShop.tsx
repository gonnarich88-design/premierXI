"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openPackAction } from "@/app/actions/pack";
import { openStarterPackAction } from "@/app/actions/starter";
import { TIER_COLOR, type CardTier } from "@/lib/constants";
import PlayerCard from "@/components/PlayerCard";

type PackMeta = {
  id: string;
  name: string;
  currency: "silver" | "gold" | "packTicket" | "shards";
  cost: number;
  desc: string;
  rates: { Bronze: number; Silver: number; Gold: number };
  pityThreshold: number | null;
};

type Wallet = {
  silver: number;
  gold: number;
  packTicket: number;
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
};

type Reveal = {
  cards: RevealCard[];
  isDuplicate: boolean;
  shardsGained: number;
};

const CURRENCY_LABEL: Record<string, string> = {
  silver: "Silver",
  gold: "Gold",
  packTicket: "Ticket",
  shards: "Shards",
};

export default function PackShop({
  packs,
  wallet,
  pity,
  starterClaimed,
}: {
  packs: PackMeta[];
  wallet: Wallet;
  pity: number;
  starterClaimed: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "opening" | "revealed">("idle");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen(pack: PackMeta) {
    if (phase === "opening") return;
    setError(null);
    setReveal(null);
    setPhase("opening");
    const res = await openPackAction(pack.id);
    if (!res.ok) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    // หน่วงเล็กน้อยให้เห็น animation ซองสั่น
    setTimeout(() => {
      setReveal({
        cards: [res.result.card],
        isDuplicate: res.result.isDuplicate,
        shardsGained: res.result.shardsGained,
      });
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
      setReveal({ cards: res.cards, isDuplicate: false, shardsGained: 0 });
      setPhase("revealed");
    }, 900);
  }

  function close() {
    setPhase("idle");
    setReveal(null);
    router.refresh();
  }

  const isStarter = (reveal?.cards.length ?? 0) > 1;

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">เปิดซองนักเตะ</h1>
        <div className="flex gap-3 text-xs">
          <span className="text-silver">Silver {wallet.silver.toLocaleString()}</span>
          <span className="text-gold">Gold {wallet.gold}</span>
          <span className="text-accent">Ticket {wallet.packTicket}</span>
        </div>
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
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
                รับครั้งแรก: การ์ดตั้งต้น 11 ใบ (ครบทุกตำแหน่ง) + 300 Silver + 1 Ticket
              </p>
            </div>
            <button
              onClick={handleOpenStarter}
              disabled={phase === "opening"}
              className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              เปิดฟรี
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {packs.map((pack) => {
          const balance = wallet[pack.currency];
          const canAfford = balance >= pack.cost;
          return (
            <div
              key={pack.id}
              className="rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-surface p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold">{pack.name}</h2>
                  <p className="mt-0.5 text-xs text-muted">{pack.desc}</p>
                  <div className="mt-2 flex gap-2 text-[10px] text-muted">
                    <TierPct label="Bronze" v={pack.rates.Bronze} />
                    <TierPct label="Silver" v={pack.rates.Silver} />
                    <TierPct label="Gold" v={pack.rates.Gold} />
                  </div>
                  {pack.pityThreshold && (
                    <p className="mt-1 text-[10px] text-accent">
                      Pity: {pity}/{pack.pityThreshold} → การันตี Gold
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleOpen(pack)}
                  disabled={!canAfford || phase === "opening"}
                  className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary-strong disabled:opacity-40"
                >
                  {pack.cost} {CURRENCY_LABEL[pack.currency]}
                </button>
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

          {phase === "revealed" && reveal && isStarter && (
            <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-8">
              <p className="shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-accent">
                ยินดีต้อนรับสู่ Premier XI
              </p>
              <p className="mb-4 shrink-0 text-center text-lg font-bold">
                Starter Pack —{" "}
                <span className="text-accent">การ์ด {reveal.cards.length} ใบ</span>
              </p>
              <div className="w-full max-w-md min-h-0 flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 gap-3 pb-2">
                  {reveal.cards.map((c, i) => {
                    const isGold = c.tier === "Gold";
                    const glow = TIER_COLOR[c.tier as CardTier] ?? "#8b5cf6";
                    return (
                      <div
                        key={c.id}
                        className="card-reveal relative"
                        style={{
                          animationDelay: `${i * 60}ms`,
                          filter: `drop-shadow(0 0 ${isGold ? 10 : 3}px ${glow})`,
                        }}
                      >
                        {isGold && (
                          <span className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gold px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-primary-foreground shadow">
                            Gold
                          </span>
                        )}
                        <PlayerCard
                          imageUrl={c.imageUrl}
                          name={c.playerName}
                          ovr={c.ovr}
                          position={c.position}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={close}
                className="my-4 shrink-0 rounded-xl bg-primary px-8 py-3 font-bold text-primary-foreground hover:bg-primary-strong"
              >
                เริ่มจัดทีม
              </button>
            </div>
          )}

          {phase === "revealed" && reveal && !isStarter && (
            <div className="flex flex-1 flex-col items-center justify-center px-6">
              {(() => {
                const card = reveal.cards[0];
                return (
                  <>
                    <div
                      className="card-reveal w-56 rounded-2xl"
                      style={{
                        filter: `drop-shadow(0 0 24px ${
                          TIER_COLOR[card.tier as CardTier] ?? "#8b5cf6"
                        })`,
                      }}
                    >
                      <PlayerCard
                        imageUrl={card.imageUrl}
                        name={card.playerName}
                        ovr={card.ovr}
                        position={card.position}
                      />
                    </div>

                    <div className="mt-4 text-center">
                      <p className="text-lg font-bold">
                        {card.playerName}{" "}
                        <span style={{ color: TIER_COLOR[card.tier as CardTier] }}>
                          {card.ovr} {card.position}
                        </span>
                      </p>
                      <p className="text-xs text-muted">{card.club}</p>
                      {reveal.isDuplicate ? (
                        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-1 text-sm text-accent">
                          การ์ดซ้ำ → รับ {reveal.shardsGained} Shards
                        </p>
                      ) : (
                        <p className="mt-2 rounded-lg bg-primary/20 px-3 py-1 text-sm text-primary">
                          การ์ดใหม่!
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}

              <button
                onClick={close}
                className="mt-6 rounded-xl bg-primary px-8 py-3 font-bold text-primary-foreground hover:bg-primary-strong"
              >
                เยี่ยม
              </button>
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
