// src/app/fantasy/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentGameweek, getLatestScoredGameweek, getMyLeaderboardRow } from "@/lib/fantasy";
import { getNews } from "@/lib/notifications";

export default async function FantasyPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const now = new Date();
  const currentGw = await getCurrentGameweek(now);
  const lastScored = await getLatestScoredGameweek();

  // จัดทีม card — findUnique read-only ล้วน ห้ามเรียก getOrCreateEntry ที่นี่ (มี side effect เขียน draft
  // entry ลง DB แค่เปิดหน้า hub — จุดเดียวที่เรียก getOrCreateEntry ได้คือ /fantasy/team ที่ตั้งใจเข้ามาจัดทีมจริง)
  const myEntry = currentGw
    ? await prisma.fantasyEntry.findUnique({
        where: { userId_gameweekId: { userId, gameweekId: currentGw.id } },
        select: { submittedAt: true },
      })
    : null;

  const matchCount = currentGw ? await prisma.match.count({ where: { gameweekId: currentGw.id } }) : 0;
  const myRow = lastScored ? await getMyLeaderboardRow(lastScored.id, userId) : null;
  const [latestNews] = await getNews(1);

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Fantasy</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/fantasy/fixtures"
          className="rounded-2xl border border-border bg-surface/60 p-4 hover:border-primary"
        >
          <h2 className="text-sm font-semibold">ตารางแข่ง</h2>
          <p className="mt-1 text-xs text-muted">{currentGw ? `GW${currentGw.number}` : "ไม่มีรอบเปิด"}</p>
          <p className="mt-2 text-2xl font-bold text-accent">{currentGw ? `${matchCount} แมตช์` : "-"}</p>
        </Link>

        <Link
          href="/fantasy/team"
          className="rounded-2xl border border-border bg-surface/60 p-4 hover:border-primary"
        >
          <h2 className="text-sm font-semibold">จัดทีม</h2>
          <p className="mt-1 text-xs text-muted">{currentGw ? `GW${currentGw.number}` : "ไม่มีรอบเปิด"}</p>
          <p className="mt-2 text-2xl font-bold text-accent">
            {!currentGw ? "-" : myEntry?.submittedAt ? "ส่งแล้ว" : "ยังไม่ส่ง"}
          </p>
        </Link>

        <Link
          href="/fantasy/news"
          className="rounded-2xl border border-border bg-surface/60 p-4 hover:border-primary"
        >
          <h2 className="text-sm font-semibold">ข่าว</h2>
          <p className="mt-1 truncate text-xs text-muted">{latestNews ? latestNews.title : "ยังไม่มีข่าว"}</p>
        </Link>

        <Link
          href="/fantasy/leaderboard"
          className="rounded-2xl border border-border bg-surface/60 p-4 hover:border-primary"
        >
          <h2 className="text-sm font-semibold">ตารางอันดับ</h2>
          <p className="mt-1 text-xs text-muted">{lastScored ? `GW${lastScored.number}` : "ยังไม่มีผล"}</p>
          <p className="mt-2 text-2xl font-bold text-accent">
            {myRow ? `อันดับ ${myRow.rank ?? "-"}` : "-"}
          </p>
        </Link>

        <Link
          href="/fantasy/totw"
          className="col-span-2 rounded-2xl border border-border bg-surface/60 p-4 hover:border-primary"
        >
          <h2 className="text-sm font-semibold">TOTW — ทีมยอดเยี่ยมประจำสัปดาห์</h2>
          <p className="mt-1 text-xs text-muted">
            {lastScored ? `GW${lastScored.number} — ดูทีมยอดเยี่ยม` : "ยังไม่มีผล"}
          </p>
        </Link>
      </div>
    </div>
  );
}
