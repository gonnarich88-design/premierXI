"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimMissionAction } from "@/app/actions/missions";
import { Reward } from "@/components/DailyClaim";
import Card from "@/components/ui/Card";
import type { MissionStatus } from "@/lib/missions";

export default function MissionList({ missions }: { missions: MissionStatus[] }) {
  const daily = missions.filter((m) => m.period === "daily");
  const weekly = missions.filter((m) => m.period === "weekly");

  return (
    <Card hub>
      <h2 className="mb-2 font-bold">มิชชั่นวันนี้</h2>
      <div className="space-y-2">
        {daily.map((m) => (
          <MissionRow key={m.key} mission={m} />
        ))}
      </div>

      <h2 className="mb-2 mt-4 font-bold">มิชชั่นสัปดาห์นี้</h2>
      <div className="space-y-2">
        {weekly.map((m) => (
          <MissionRow key={m.key} mission={m} />
        ))}
      </div>
    </Card>
  );
}

function MissionRow({ mission }: { mission: MissionStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState(mission.claimed);
  const [prevPropClaimed, setPrevPropClaimed] = useState(mission.claimed);
  const [error, setError] = useState<string | null>(null);

  // sync กับ prop เสมอ กัน state ค้างข้าม period (เช่น เปิดหน้าทิ้งไว้ข้ามวัน/สัปดาห์แล้ว refresh)
  // ปรับระหว่าง render ตามแพทเทิร์นที่ React แนะนำ แทน useEffect เพื่อไม่ให้เกิด render ซ้อน
  if (mission.claimed !== prevPropClaimed) {
    setPrevPropClaimed(mission.claimed);
    setClaimed(mission.claimed);
  }

  const ready = mission.progress >= mission.target;

  async function claim() {
    if (pending || claimed || !ready) return;
    setPending(true);
    setError(null);
    const res = await claimMissionAction(mission.key);
    if (res.ok) {
      setClaimed(true);
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{mission.label}</p>
          <p className="text-[11px] text-muted">
            {mission.progress}/{mission.target}
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
          style={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
        <Reward label="Silver" value={mission.reward.silver} className="text-silver" />
        {mission.reward.exp > 0 && (
          <Reward label="EXP" value={mission.reward.exp} className="text-primary" />
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
