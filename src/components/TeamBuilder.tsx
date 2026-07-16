"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import { setFormationAction, assignSlotAction } from "@/app/actions/squad";
import { POSITION_GROUP, type Position } from "@/lib/constants";
import { MAX_TEAM_CHEM } from "@/lib/chemistryConfig";

type Card = {
  id: string;
  ovr: number;
  position: string;
  tier: string;
  imageUrl: string | null;
  name: string;
  club: string;
};

type OwnedCard = Card & { altPositions: string[] };

type Slot = {
  index: number;
  pos: string;
  x: number;
  y: number;
  chem: number;
  card: Card | null;
};

export default function TeamBuilder({
  formation,
  formations,
  slots,
  ownedCards,
  rating,
  teamChem,
  filled,
  fullUnity,
}: {
  formation: string;
  formations: string[];
  slots: Slot[];
  ownedCards: OwnedCard[];
  rating: number;
  teamChem: number;
  filled: number;
  fullUnity: boolean;
}) {
  const router = useRouter();
  const [sheetSlot, setSheetSlot] = useState<Slot | null>(null);
  const [pending, setPending] = useState(false);

  const usedIds = new Set(slots.filter((s) => s.card).map((s) => s.card!.id));

  async function pickFormation(f: string) {
    if (f === formation || pending) return;
    setPending(true);
    await setFormationAction(f);
    router.refresh();
    setPending(false);
  }

  async function assign(index: number, cardId: string | null) {
    setPending(true);
    await assignSlotAction(index, cardId);
    setSheetSlot(null);
    router.refresh();
    setPending(false);
  }

  return (
    <div className="px-3 pt-5">
      {/* Header stats */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Rating" value={rating || "-"} className="text-primary" />
        <Stat label="Chemistry" value={`${teamChem}/${MAX_TEAM_CHEM}`} className="text-accent" />
        <Stat label="ผู้เล่น" value={`${filled}/11`} className="text-foreground" />
      </div>

      {fullUnity && (
        <div className="mb-3 flex justify-center">
          <span className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-400">
            Full Unity
          </span>
        </div>
      )}

      {/* Formation selector */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {formations.map((f) => (
          <button
            key={f}
            onClick={() => pickFormation(f)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${
              f === formation
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Pitch */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-green-800/60 to-green-900/70">
        {/* markings */}
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-white/15" />

        {fullUnity && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <polygon
              points={ringPoints(slots)}
              fill="none"
              stroke="#4ade80"
              strokeWidth="0.6"
              strokeLinejoin="round"
              opacity="0.85"
            />
          </svg>
        )}

        {slots.map((s) => (
          <button
            key={s.index}
            onClick={() => setSheetSlot(s)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: "20%" }}
          >
            {s.card ? (
              <div className="w-full">
                <PlayerCard
                  imageUrl={s.card.imageUrl}
                  name={s.card.name}
                  ovr={s.card.ovr}
                  position={s.card.position}
                />
                <div className="mt-0.5 flex justify-center gap-0.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className={`h-1.5 w-1.5 rounded-full ${
                        d < s.chem ? "bg-accent" : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-black/20">
                <span className="text-[10px] font-bold text-white/70">
                  {s.pos}
                </span>
                <span className="text-lg leading-none text-white/50">+</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        แตะช่องในสนามเพื่อจัดผู้เล่น
      </p>

      {/* Card picker sheet */}
      {sheetSlot && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70"
          onClick={() => !pending && setSheetSlot(null)}
        >
          <div
            className="mx-auto max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">
                เลือกผู้เล่นช่อง {sheetSlot.pos}
              </h3>
              {sheetSlot.card && (
                <button
                  onClick={() => assign(sheetSlot.index, null)}
                  disabled={pending}
                  className="text-sm text-red-300"
                >
                  เอาออก
                </button>
              )}
            </div>

            {(() => {
              const candidates = ownedCards.filter(
                (c) =>
                  c.position === sheetSlot.pos ||
                  c.altPositions.includes(sheetSlot.pos) ||
                  POSITION_GROUP[c.position as Position] ===
                    POSITION_GROUP[sheetSlot.pos as Position],
              );
              if (candidates.length === 0) {
                return (
                  <p className="py-6 text-center text-sm text-muted">
                    ไม่มีการ์ดที่เล่นตำแหน่ง {sheetSlot.pos} ได้
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-4 gap-2">
                  {candidates.map((c) => {
                    const used =
                      usedIds.has(c.id) && c.id !== sheetSlot.card?.id;
                    const exactFit =
                      c.position === sheetSlot.pos ||
                      c.altPositions.includes(sheetSlot.pos);
                    return (
                      <button
                        key={c.id}
                        onClick={() => !used && assign(sheetSlot.index, c.id)}
                        disabled={pending || used}
                        className={`relative rounded-lg p-0.5 ${
                          exactFit ? "ring-1 ring-accent" : ""
                        } ${used ? "opacity-30" : ""}`}
                      >
                        <PlayerCard
                          imageUrl={c.imageUrl}
                          name={c.name}
                          ovr={c.ovr}
                          position={c.position}
                        />
                        <span className="mt-0.5 block truncate text-center text-[9px] text-muted">
                          {c.ovr} {c.position}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-2">
      <div className={`text-lg font-bold ${className ?? ""}`}>{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

function ringPoints(points: { x: number; y: number }[]): string {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const sorted = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  return sorted.map((p) => `${p.x},${p.y}`).join(" ");
}
