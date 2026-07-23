// src/app/fantasy/fixtures/page.tsx
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getCurrentGameweek } from "@/lib/fantasy";
import { getFixtures, type Fixture } from "@/lib/fantasyFixtures";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "ตารางแข่ง Fantasy · Premier XI" };

function MatchStatus({ m }: { m: Fixture }) {
  if (m.status === "PLAYED") {
    return (
      <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
        {m.homeScore} - {m.awayScore}
      </span>
    );
  }
  if (m.status === "POSTPONED" || m.status === "CANCELLED") {
    return (
      <span className="shrink-0 rounded-full bg-border px-2 py-0.5 text-[10px] font-bold text-muted">
        {m.status === "POSTPONED" ? "เลื่อนแข่ง" : "ยกเลิก"}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs text-muted">
      {m.kickoffAt ? m.kickoffAt.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "ยังไม่กำหนดเวลา"}
    </span>
  );
}

export default async function FantasyFixturesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const gameweek = await getCurrentGameweek();
  const fixtures = gameweek ? await getFixtures(gameweek.id) : [];

  return (
    <div className="px-4 pt-3 pb-6">
      <PageHeader
        title={`ตารางแข่ง${gameweek ? ` — Gameweek ${gameweek.number}` : ""}`}
        backHref="/fantasy"
      />

      {!gameweek ? (
        <p className="mt-10 text-center text-sm text-muted">ยังไม่มี Gameweek เปิดตอนนี้</p>
      ) : fixtures.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">ยังไม่มีแมตช์ใน Gameweek นี้</p>
      ) : (
        <ul className="space-y-2">
          {fixtures.map((m) => (
            <li
              key={m.id}
              className="surface-card flex items-center justify-between gap-2 rounded-xl p-3 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{m.homeClub}</span>
              <span className="shrink-0 text-xs text-muted">vs</span>
              <span className="min-w-0 flex-1 truncate text-right">{m.awayClub}</span>
              <MatchStatus m={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
