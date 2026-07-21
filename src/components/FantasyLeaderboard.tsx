// src/components/FantasyLeaderboard.tsx
import type { LeaderboardRow } from "@/lib/fantasy";

export default function FantasyLeaderboard({
  gameweekNumber,
  rows,
  myRow,
  myUserId,
}: {
  gameweekNumber: number;
  rows: LeaderboardRow[];
  myRow: LeaderboardRow | null;
  myUserId: string;
}) {
  const myRowInTop = rows.some((r) => r.userId === myUserId);

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface/60 p-4">
      <h2 className="mb-3 text-sm font-semibold">Weekly Leaderboard — Gameweek {gameweekNumber}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีผลคะแนน</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.userId}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                r.userId === myUserId ? "bg-primary/15 font-semibold" : "bg-background"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-muted">{r.rank ?? "-"}</span>
                <span>{r.username}</span>
              </span>
              <span className="flex items-center gap-2">
                {r.rewardTier && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">{r.rewardTier}</span>
                )}
                <span>{r.points} แต้ม</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {myRow && !myRowInTop && (
        <div className="sticky bottom-16 mt-3 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <span className="w-6 text-muted">{myRow.rank ?? "-"}</span>
            <span>{myRow.username} (คุณ)</span>
          </span>
          <span>{myRow.points} แต้ม</span>
        </div>
      )}
    </div>
  );
}
