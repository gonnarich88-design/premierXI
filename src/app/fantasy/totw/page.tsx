// src/app/fantasy/totw/page.tsx
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getLatestScoredGameweek } from "@/lib/fantasy";
import { getTeamOfTheWeek, type TotwSlot } from "@/lib/fantasyTotw";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "TOTW · Premier XI" };

export default async function FantasyTotwPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const gameweek = await getLatestScoredGameweek();
  const slots = gameweek ? await getTeamOfTheWeek(gameweek.id) : [];

  return (
    <div className="px-3 pt-3 pb-6">
      <PageHeader
        title={`Team of the Week${gameweek ? ` — GW${gameweek.number}` : ""}`}
        backHref="/fantasy"
      />

      {!gameweek ? (
        <p className="mt-10 text-center text-sm text-muted">ยังไม่มี Gameweek ที่ปิดคิดคะแนนแล้ว กลับมาเช็คใหม่ภายหลัง</p>
      ) : (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-green-800/60 to-green-900/70">
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
          <div className="absolute left-0 top-1/2 h-px w-full bg-white/15" />
          {slots.map((slot) => (
            <TotwSlotBadge key={slot.slotIndex} slot={slot} />
          ))}
        </div>
      )}
    </div>
  );
}

function TotwSlotBadge({ slot }: { slot: TotwSlot }) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: "22%" }}
    >
      {slot.player ? (
        <div className="flex w-full flex-col items-center rounded-lg bg-black/50 px-1 py-1 text-center">
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {slot.player.points} แต้ม
          </span>
          <span className="mt-0.5 w-full truncate text-[10px] font-semibold text-white">{slot.player.name}</span>
          <span className="truncate text-[9px] text-white/60">{slot.player.club}</span>
        </div>
      ) : (
        <div className="flex aspect-square w-2/3 flex-col items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-black/20">
          <span className="text-[9px] font-bold text-white/60">{slot.pos}</span>
        </div>
      )}
    </div>
  );
}
