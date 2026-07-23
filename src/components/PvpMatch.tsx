"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playPvpMatchAction } from "@/app/actions/pvp";
import type { PvpStatus, PvpMatchResult } from "@/lib/pvp";
import Button from "@/components/ui/Button";

const TIER_COLOR: Record<string, string> = {
  bronze: "#a97142",
  silver: "#c9d1e0",
  gold: "#f5c451",
  elite: "#7c3aed",
  champion: "#e11d48",
  legend: "#f59e0b",
};

const TIER_LABEL: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  elite: "Elite",
  champion: "Champion",
  legend: "Legend",
};

function BallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2 3 6v12l9 4 9-4V6l-9-4Zm0 2.2 6.1 2.7L12 9.6 5.9 6.9 12 4.2ZM5 8.6l6 2.7v8.2l-6-2.7V8.6Zm14 0v8.2l-6 2.7v-8.2l6-2.7Z" />
    </svg>
  );
}

type MatchResultView = Extract<PvpMatchResult, { ok: true }>;

export default function PvpMatch({ status }: { status: PvpStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResultView | null>(null);

  const squadReady = status.squadFilled === 11;
  const needsTicket = status.matchesRemaining === 0;
  const canAfford = !needsTicket || status.gold >= 3;

  async function play() {
    if (pending || !squadReady || !canAfford) return;
    setPending(true);
    setError(null);
    const res = await playPvpMatchAction();
    if (res.ok) {
      setResult(res);
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  const rangeSize = status.nextTierMin ? status.nextTierMin - status.currentTierMin : 1;
  const progressPct = status.nextTierMin
    ? Math.min(100, ((status.rp - status.currentTierMin) / rangeSize) * 100)
    : 100;

  return (
    <div className="mt-4 space-y-4">
      <div className="surface-card rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <span
              className="rounded-lg px-2 py-1 text-sm font-bold text-black"
              style={{ backgroundColor: TIER_COLOR[status.tier] }}
            >
              {status.tierLabel}
            </span>
            <p className="mt-1 text-xs text-muted">{status.rp} RP</p>
          </div>
          <p className="text-xs text-muted">โควตาวันนี้เหลือ {status.matchesRemaining}/5</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {!squadReady && (
        <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
          จัดทีมให้ครบ 11 ตำแหน่งก่อน —{" "}
          <a href="/team" className="underline">
            ไปหน้าจัดทีม
          </a>
        </p>
      )}

      <Button
        onClick={play}
        disabled={pending || !squadReady || !canAfford}
        variant="gradient"
        size="lg"
        className="text-lg"
      >
        {pending ? "..." : needsTicket ? "ซื้อ Match Ticket (3 Gold) แล้วแข่ง" : "แข่งเลย"}
      </Button>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {result && (
        <div className="surface-card rounded-2xl p-4">
          <p className="text-stat-hero text-center text-2xl">
            {result.myGoals} - {result.oppGoals}
          </p>
          <p className="text-center text-sm text-muted">
            {result.outcome === "win" ? "ชนะ!" : result.outcome === "draw" ? "เสมอ" : "แพ้"}
          </p>

          <div className="mt-3 space-y-1">
            {result.events.map((e, i) => (
              <p key={i} className="flex items-center gap-1.5 text-sm">
                <BallIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="text-muted">{e.minute}&apos;</span>
                <span className={e.team === "me" ? "font-semibold" : "text-muted"}>{e.scorer}</span>
                {e.assist && <span className="text-xs text-muted">(assist: {e.assist})</span>}
              </p>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-surface-2 px-2 py-1">
              <span className={`font-bold ${result.rpDelta >= 0 ? "text-primary" : "text-red-300"}`}>
                {result.rpDelta >= 0 ? "+" : ""}
                {result.rpDelta}
              </span>{" "}
              RP
            </span>
            <span className="rounded-lg bg-surface-2 px-2 py-1">
              <span className="font-bold text-primary">+{result.expGained}</span> EXP
            </span>
            <span className="rounded-lg bg-surface-2 px-2 py-1">
              <span className="font-bold text-silver">+{result.silverGained}</span> Silver
            </span>
          </div>

          {(result.promoted || result.demoted) && (
            <p className="mt-2 rounded-lg bg-accent/20 px-3 py-2 text-sm text-accent">
              {result.promoted ? "เลื่อนขั้นเป็น" : "ตกขั้นเป็น"} {TIER_LABEL[result.tierAfter] ?? result.tierAfter}!
            </p>
          )}

          {result.seasonEndReward && (
            <p className="mt-2 rounded-lg bg-primary/20 px-3 py-2 text-sm text-primary">
              จบ Season! รางวัล Tier {TIER_LABEL[result.seasonEndReward.tier] ?? result.seasonEndReward.tier}: +
              {result.seasonEndReward.silver} Silver
              {result.seasonEndReward.gold ? ` · +${result.seasonEndReward.gold} Gold` : ""}
              {result.seasonEndReward.pack ? " · ได้ซองฟรี" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
