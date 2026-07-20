// src/components/FantasyPitch.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import { saveEntryAction } from "@/app/actions/fantasy";
import { POSITION_GROUP, type Position } from "@/lib/constants";
import { FORMATIONS } from "@/lib/formations";

type OwnedCard = {
  id: string;
  ovr: number;
  position: string;
  tier: string;
  imageUrl: string | null;
  name: string;
  playerId: string;
};

type StarterSlot = {
  slotIndex: number;
  pos: string;
  x: number;
  y: number;
  cardId: string | null;
  card: OwnedCard | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

type BenchSlot = {
  slotIndex: number;
  priority: number;
  cardId: string | null;
  card: OwnedCard | null;
};

type PickerSlot = { slotIndex: number; pos?: string; priority?: number };

export default function FantasyPitch({
  gameweekId,
  gameweekNumber,
  deadline,
  locked,
  formation: initialFormation,
  formations,
  starters,
  bench,
  ownedCards,
}: {
  gameweekId: string;
  gameweekNumber: number;
  deadline: string;
  locked: boolean;
  formation: string;
  formations: string[];
  starters: StarterSlot[];
  bench: BenchSlot[];
  ownedCards: OwnedCard[];
}) {
  const router = useRouter();
  const [formation, setFormationState] = useState(initialFormation);
  const [slotCard, setSlotCard] = useState<Record<number, string | null>>(() => {
    const init: Record<number, string | null> = {};
    for (const s of starters) init[s.slotIndex] = s.cardId;
    for (const b of bench) init[b.slotIndex] = b.cardId;
    return init;
  });
  const [captainSlot, setCaptainSlot] = useState<number | null>(
    starters.find((s) => s.isCaptain)?.slotIndex ?? null,
  );
  const [viceSlot, setViceSlot] = useState<number | null>(
    starters.find((s) => s.isViceCaptain)?.slotIndex ?? null,
  );
  const [pickerSlot, setPickerSlot] = useState<PickerSlot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layout = FORMATIONS[formation] ?? FORMATIONS[initialFormation];
  const cardById = new Map(ownedCards.map((c) => [c.id, c]));
  const usedPlayerIds = new Set(
    Object.values(slotCard)
      .filter((id): id is string => !!id)
      .map((id) => cardById.get(id)?.playerId)
      .filter((id): id is string => !!id),
  );

  function pickFormation(f: string) {
    if (f === formation || pending || locked) return;
    setFormationState(f);
    // ตำแหน่งของแต่ละ index (0-10) อาจเปลี่ยนกลุ่มเมื่อสลับ formation — เคลียร์ตัวจริงทั้งหมดกันค่าค้างผิดตำแหน่ง
    setSlotCard((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 11; i++) next[i] = null;
      return next;
    });
    setCaptainSlot(null);
    setViceSlot(null);
  }

  function pick(slotIndex: number, cardId: string | null) {
    setSlotCard((prev) => ({ ...prev, [slotIndex]: cardId }));
    if (cardId === null) {
      if (captainSlot === slotIndex) setCaptainSlot(null);
      if (viceSlot === slotIndex) setViceSlot(null);
    }
    setPickerSlot(null);
  }

  function setCaptain(slotIndex: number) {
    setCaptainSlot(slotIndex);
    if (viceSlot === slotIndex) setViceSlot(null);
  }

  function setVice(slotIndex: number) {
    setViceSlot(slotIndex);
    if (captainSlot === slotIndex) setCaptainSlot(null);
  }

  async function save() {
    setPending(true);
    setError(null);
    const lineup = Object.entries(slotCard)
      .filter(([, cardId]) => cardId)
      .map(([slotIndexStr, cardId]) => {
        const slotIndex = Number(slotIndexStr);
        return {
          cardId: cardId as string,
          slotIndex,
          isCaptain: slotIndex === captainSlot,
          isViceCaptain: slotIndex === viceSlot,
        };
      });
    const result = await saveEntryAction(gameweekId, formation, lineup);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  return (
    <div className="px-3 pt-5 pb-24">
      <div className="mb-3 text-center">
        <p className="text-sm font-bold">Gameweek {gameweekNumber}</p>
        <p className="text-xs text-muted">
          {locked ? "ล็อกทีมแล้ว" : `แก้ทีมได้ถึง ${new Date(deadline).toLocaleString("th-TH")}`}
        </p>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {formations.map((f) => (
          <button
            key={f}
            onClick={() => pickFormation(f)}
            disabled={locked}
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

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-green-800/60 to-green-900/70">
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-white/15" />

        {layout.map((slot, i) => {
          const cardId = slotCard[i];
          const card = cardId ? cardById.get(cardId) ?? null : null;
          return (
            <button
              key={i}
              onClick={() => !locked && setPickerSlot({ slotIndex: i, pos: slot.pos })}
              disabled={locked}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: "20%" }}
            >
              {card ? (
                <div className="relative w-full">
                  <PlayerCard imageUrl={card.imageUrl} name={card.name} ovr={card.ovr} position={card.position} />
                  {captainSlot === i && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      C
                    </span>
                  )}
                  {viceSlot === i && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-black">
                      V
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-black/20">
                  <span className="text-[10px] font-bold text-white/70">{slot.pos}</span>
                  <span className="text-lg leading-none text-white/50">+</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-muted">แตะช่องในสนามเพื่อจัดผู้เล่น</p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold text-muted">ตัวสำรอง</p>
        <div className="grid grid-cols-4 gap-2">
          {bench.map((b) => {
            const cardId = slotCard[b.slotIndex];
            const card = cardId ? cardById.get(cardId) ?? null : null;
            return (
              <button
                key={b.slotIndex}
                onClick={() => !locked && setPickerSlot({ slotIndex: b.slotIndex, priority: b.priority })}
                disabled={locked}
                className="relative"
              >
                {card ? (
                  <PlayerCard imageUrl={card.imageUrl} name={card.name} ovr={card.ovr} position={card.position} />
                ) : (
                  <div className="flex aspect-[900/1269] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-2">
                    <span className="text-lg text-muted">+</span>
                  </div>
                )}
                <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[9px] font-bold text-white">
                  {b.priority}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}

      {!locked && (
        <button
          onClick={save}
          disabled={pending}
          className="mt-4 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกทีม"}
        </button>
      )}

      {pickerSlot && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70"
          onClick={() => !pending && setPickerSlot(null)}
        >
          <div
            className="mx-auto max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">
                เลือกผู้เล่น{pickerSlot.pos ? ` ช่อง ${pickerSlot.pos}` : ` ตัวสำรอง ${pickerSlot.priority}`}
              </h3>
              {slotCard[pickerSlot.slotIndex] && (
                <button onClick={() => pick(pickerSlot.slotIndex, null)} className="text-sm text-red-300">
                  เอาออก
                </button>
              )}
            </div>

            {(() => {
              const currentCardId = slotCard[pickerSlot.slotIndex];
              const candidates = ownedCards.filter((c) =>
                pickerSlot.pos
                  ? POSITION_GROUP[c.position as Position] === POSITION_GROUP[pickerSlot.pos as Position]
                  : true,
              );
              if (candidates.length === 0) {
                return <p className="py-6 text-center text-sm text-muted">ไม่มีการ์ดที่ใช้ได้ในช่องนี้</p>;
              }
              return (
                <div className="grid grid-cols-4 gap-2">
                  {candidates.map((c) => {
                    const usedElsewhere = c.id !== currentCardId && usedPlayerIds.has(c.playerId);
                    return (
                      <button
                        key={c.id}
                        onClick={() => !usedElsewhere && pick(pickerSlot.slotIndex, c.id)}
                        disabled={usedElsewhere}
                        className={`relative rounded-lg p-0.5 ${usedElsewhere ? "opacity-30" : ""}`}
                      >
                        <PlayerCard imageUrl={c.imageUrl} name={c.name} ovr={c.ovr} position={c.position} />
                        <span className="mt-0.5 block truncate text-center text-[9px] text-muted">
                          {c.ovr} {c.position}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {pickerSlot.pos && slotCard[pickerSlot.slotIndex] && (
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <button
                  onClick={() => setCaptain(pickerSlot.slotIndex)}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                    captainSlot === pickerSlot.slotIndex
                      ? "bg-primary text-primary-foreground"
                      : "border border-border"
                  }`}
                >
                  ตั้งเป็นกัปตัน (C)
                </button>
                <button
                  onClick={() => setVice(pickerSlot.slotIndex)}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                    viceSlot === pickerSlot.slotIndex ? "bg-accent text-black" : "border border-border"
                  }`}
                >
                  ตั้งเป็นรองกัปตัน (V)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
