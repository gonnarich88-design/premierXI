"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimAchievementAction } from "@/app/actions/achievements";
import { Reward } from "@/components/DailyClaim";
import type { AchievementStatus } from "@/lib/achievements";
import { PACKS } from "@/lib/packs";

type Tab = "activity" | "collection";

export default function AchievementList({ achievements }: { achievements: AchievementStatus[] }) {
  const [tab, setTab] = useState<Tab>("activity");

  const activity = achievements.filter((a) => a.category === "activity");
  const collection = achievements
    .filter((a) => a.category === "club" || a.category === "meta")
    .sort((a, b) => {
      if (a.category === b.category) return a.label.localeCompare(b.label);
      return a.category === "meta" ? -1 : 1; // Big6 (meta) แสดงเด่นก่อน ตามด้วยสโมสรเรียงชื่อ
    });

  const shown = tab === "activity" ? activity : collection;

  return (
    <div>
      <div className="mb-3 flex gap-2 rounded-xl bg-surface-2 p-1">
        <TabButton label="กิจกรรม" active={tab === "activity"} onClick={() => setTab("activity")} />
        <TabButton label="สะสม" active={tab === "collection"} onClick={() => setTab("collection")} />
      </div>
      <div className="space-y-2">
        {shown.map((a) => (
          <AchievementRow key={a.key} achievement={a} />
        ))}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function AchievementRow({ achievement }: { achievement: AchievementStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState(achievement.claimed);
  const [prevPropClaimed, setPrevPropClaimed] = useState(achievement.claimed);
  const [error, setError] = useState<string | null>(null);

  // sync กับ prop เสมอ (เหมือน MissionList) กัน state ค้างหลัง router.refresh()
  if (achievement.claimed !== prevPropClaimed) {
    setPrevPropClaimed(achievement.claimed);
    setClaimed(achievement.claimed);
  }

  const ready = achievement.progress >= achievement.target;

  async function claim() {
    if (pending || claimed || !ready) return;
    setPending(true);
    setError(null);
    const res = await claimAchievementAction(achievement.key);
    if (res.ok) {
      setClaimed(true);
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{achievement.label}</p>
          <p className="text-[11px] text-muted">
            {achievement.progress}/{achievement.target}
          </p>
        </div>
        <button
          onClick={claim}
          disabled={pending || claimed || !ready}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary-strong disabled:opacity-40"
        >
          {claimed ? "เคลมแล้ว" : pending ? "..." : "เคลม"}
        </button>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
        {achievement.reward.silver > 0 && (
          <Reward label="Silver" value={achievement.reward.silver} className="text-silver" />
        )}
        {achievement.reward.gold > 0 && <Reward label="Gold" value={achievement.reward.gold} className="text-gold" />}
        {achievement.reward.freePackId && (
          <span className="rounded-lg bg-surface-2 px-2 py-1">
            <span className="font-bold text-accent">
              {PACKS[achievement.reward.freePackId]?.name ?? achievement.reward.freePackId}
            </span>{" "}
            ฟรี
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
