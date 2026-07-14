"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimDailyAction } from "@/app/actions/daily";
import type { DailyReward } from "@/lib/daily";

export default function DailyClaim({
  canClaim,
  streak,
  nextReward,
}: {
  canClaim: boolean;
  streak: number;
  nextReward: DailyReward;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState<DailyReward | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    if (pending || !canClaim) return;
    setPending(true);
    setError(null);
    const res = await claimDailyAction();
    if (res.ok) {
      setClaimed(res.reward);
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  const done = claimed !== null || !canClaim;

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">เช็คอินรายวัน</h2>
          <p className="mt-0.5 text-xs text-muted">
            ต่อเนื่อง {streak} วัน · รางวัลวันที่ {nextReward.day}/7
          </p>
        </div>
        <button
          onClick={claim}
          disabled={pending || done}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary-strong disabled:opacity-40"
        >
          {done ? "รับแล้ววันนี้" : pending ? "..." : "รับรางวัล"}
        </button>
      </div>

      {/* preview รางวัลที่จะได้ */}
      {!done && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Reward label="Silver" value={nextReward.silver} className="text-silver" />
          <Reward label="EXP" value={nextReward.exp} className="text-primary" />
          {nextReward.packTicket > 0 && (
            <Reward label="Ticket" value={nextReward.packTicket} className="text-accent" />
          )}
          {nextReward.gold > 0 && (
            <Reward label="Gold" value={nextReward.gold} className="text-gold" />
          )}
        </div>
      )}

      {claimed && (
        <p className="mt-3 rounded-lg bg-primary/20 px-3 py-2 text-sm text-primary">
          รับแล้ว! +{claimed.silver} Silver
          {claimed.packTicket ? ` · +${claimed.packTicket} Ticket` : ""}
          {claimed.gold ? ` · +${claimed.gold} Gold` : ""}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function Reward({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span className="rounded-lg bg-surface-2 px-2 py-1">
      <span className={`font-bold ${className ?? ""}`}>+{value}</span> {label}
    </span>
  );
}
