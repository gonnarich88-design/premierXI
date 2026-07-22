// src/app/fantasy/leaderboard/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getLatestScoredGameweek, getLeaderboard, getMyLeaderboardRow } from "@/lib/fantasy";
import FantasyLeaderboard from "@/components/FantasyLeaderboard";

export const metadata = { title: "ตารางอันดับ Fantasy · Premier XI" };

export default async function FantasyLeaderboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const lastScored = await getLatestScoredGameweek();

  return (
    <div className="px-3 pt-3 pb-6">
      <Link href="/fantasy" className="text-sm text-primary">
        ← กลับ
      </Link>

      {lastScored ? (
        <FantasyLeaderboard
          gameweekNumber={lastScored.number}
          rows={await getLeaderboard(lastScored.id)}
          myRow={await getMyLeaderboardRow(lastScored.id, userId)}
          myUserId={userId}
        />
      ) : (
        <p className="mt-10 text-center text-sm text-muted">
          ยังไม่มี Gameweek ที่ปิดคิดคะแนนแล้ว กลับมาเช็คใหม่ภายหลัง
        </p>
      )}
    </div>
  );
}
