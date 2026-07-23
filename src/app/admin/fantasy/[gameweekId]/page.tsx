// src/app/admin/fantasy/[gameweekId]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGameweekAdminDetail, type GameweekAdminDetail } from "@/lib/fantasyAdmin";
import { upsertMatchAction, upsertPlayerStatAction, closeGameweekAction } from "@/app/actions/fantasyAdmin";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/fantasyConfig";

export const metadata = { title: "จัดการ Gameweek · Admin" };

type MatchWithStats = GameweekAdminDetail["matches"][number];
type StatByPlayerId = Map<string, { minutes: number; goals: number; assists: number; yellow: number; red: number; ownGoals: number }>;

export default async function AdminGameweekDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameweekId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");

  const { gameweekId } = await params;
  const { error } = await searchParams;
  const gameweek = await getGameweekAdminDetail(gameweekId);
  if (!gameweek) notFound();

  const locked = gameweek.status === "SCORING" || gameweek.status === "SCORED";
  const allScored =
    gameweek.matches.length > 0 &&
    gameweek.matches.every(
      (m) => m.status === "POSTPONED" || m.status === "CANCELLED" || (m.homeScore !== null && m.awayScore !== null),
    );

  return (
    <div className="px-4 pb-10 pt-5">
      <h1 className="mb-1 text-lg font-bold">Gameweek {gameweek.number}</h1>
      <p className="mb-4 text-xs text-muted">
        Deadline: {gameweek.deadline.toLocaleString("th-TH")} · เดือน {gameweek.monthKey} · สถานะ {gameweek.status}
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {!locked && (
        <form action={upsertMatchAction} className="surface-card mb-6 space-y-3 rounded-xl p-4">
          <input type="hidden" name="gameweekId" value={gameweekId} />
          <h2 className="text-sm font-semibold">เพิ่มแมตช์ใหม่</h2>
          <div className="grid grid-cols-2 gap-3">
            <select
              name="homeClub"
              required
              defaultValue=""
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="" disabled>ทีมเหย้า</option>
              {PREMIER_LEAGUE_CLUBS.map((club) => (
                <option key={club} value={club}>{club}</option>
              ))}
            </select>
            <select
              name="awayClub"
              required
              defaultValue=""
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="" disabled>ทีมเยือน</option>
              {PREMIER_LEAGUE_CLUBS.map((club) => (
                <option key={club} value={club}>{club}</option>
              ))}
            </select>
          </div>
          <input
            name="kickoffAt"
            type="datetime-local"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            name="status"
            defaultValue="SCHEDULED"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="POSTPONED">POSTPONED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <button type="submit" className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
            เพิ่มแมตช์
          </button>
        </form>
      )}

      {gameweek.matches.map((match) => (
        <MatchCard key={match.id} gameweekId={gameweekId} match={match} locked={locked} />
      ))}

      {!locked && (
        <form action={closeGameweekAction} className="mt-6">
          <input type="hidden" name="gameweekId" value={gameweekId} />
          <button
            type="submit"
            disabled={!allScored}
            className="w-full rounded-xl bg-red-500 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {allScored ? "ปิด Gameweek และคิดคะแนน" : "ต้องกรอกสกอร์ทุกแมตช์ก่อนปิด"}
          </button>
        </form>
      )}
      {gameweek.status === "SCORING" && (
        <form action={closeGameweekAction} className="mt-4">
          <input type="hidden" name="gameweekId" value={gameweekId} />
          <p className="mb-2 text-sm text-amber-300">กำลังประมวลผลคะแนนอยู่ — ถ้าค้างนานเกินไปกดปุ่มนี้เพื่อ resume</p>
          <button type="submit" className="w-full rounded-xl border border-amber-400/50 py-2.5 text-sm font-semibold text-amber-300">
            ลองปิด Gameweek อีกครั้ง
          </button>
        </form>
      )}
    </div>
  );
}

async function MatchCard({ gameweekId, match, locked }: { gameweekId: string; match: MatchWithStats; locked: boolean }) {
  const [homePlayers, awayPlayers] = await Promise.all([
    prisma.player.findMany({ where: { club: match.homeClub }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.player.findMany({ where: { club: match.awayClub }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const statByPlayerId: StatByPlayerId = new Map(
    match.stats.map((s) => [s.playerId, { minutes: s.minutes, goals: s.goals, assists: s.assists, yellow: s.yellow, red: s.red, ownGoals: s.ownGoals }]),
  );

  return (
    <div className="surface-card mb-6 rounded-xl p-4">
      <h2 className="mb-3 font-semibold">
        {match.homeClub} vs {match.awayClub}
      </h2>

      {!locked ? (
        <form action={upsertMatchAction} className="mb-4 grid grid-cols-2 gap-3">
          <input type="hidden" name="gameweekId" value={gameweekId} />
          <input type="hidden" name="matchId" value={match.id} />
          <input type="hidden" name="homeClub" value={match.homeClub} />
          <input type="hidden" name="awayClub" value={match.awayClub} />
          <input
            name="homeScore"
            type="number"
            min={0}
            defaultValue={match.homeScore ?? ""}
            placeholder="สกอร์เหย้า"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            name="awayScore"
            type="number"
            min={0}
            defaultValue={match.awayScore ?? ""}
            placeholder="สกอร์เยือน"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            name="status"
            defaultValue={match.status}
            className="col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="PLAYED">PLAYED</option>
            <option value="POSTPONED">POSTPONED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <button type="submit" className="col-span-2 rounded-lg border border-border py-2 text-sm font-semibold hover:border-primary">
            บันทึกสกอร์
          </button>
        </form>
      ) : (
        <p className="mb-4 text-sm text-muted">
          สกอร์: {match.homeScore ?? "-"} - {match.awayScore ?? "-"} ({match.status})
        </p>
      )}

      {!locked && (
        <>
          <PlayerStatTable gameweekId={gameweekId} matchId={match.id} clubName={match.homeClub} clubSide="HOME" players={homePlayers} statByPlayerId={statByPlayerId} />
          <PlayerStatTable gameweekId={gameweekId} matchId={match.id} clubName={match.awayClub} clubSide="AWAY" players={awayPlayers} statByPlayerId={statByPlayerId} />
        </>
      )}
    </div>
  );
}

function PlayerStatTable({
  gameweekId,
  matchId,
  clubName,
  clubSide,
  players,
  statByPlayerId,
}: {
  gameweekId: string;
  matchId: string;
  clubName: string;
  clubSide: "HOME" | "AWAY";
  players: { id: string; name: string }[];
  statByPlayerId: StatByPlayerId;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{clubName}</h3>
      <div className="space-y-2">
        {players.map((p) => {
          const existing = statByPlayerId.get(p.id);
          return (
            <form
              key={p.id}
              action={upsertPlayerStatAction}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2 text-xs"
            >
              <input type="hidden" name="gameweekId" value={gameweekId} />
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="playerId" value={p.id} />
              <input type="hidden" name="clubSide" value={clubSide} />
              <span className="w-24 shrink-0 truncate">{p.name}</span>
              <NumInput name="minutes" label="นาที" defaultValue={existing?.minutes ?? 90} max={120} />
              <NumInput name="goals" label="ประตู" defaultValue={existing?.goals ?? 0} />
              <NumInput name="assists" label="แอสซิสต์" defaultValue={existing?.assists ?? 0} />
              <NumInput name="yellow" label="เหลือง" defaultValue={existing?.yellow ?? 0} />
              <NumInput name="red" label="แดง" defaultValue={existing?.red ?? 0} />
              <NumInput name="ownGoals" label="OG" defaultValue={existing?.ownGoals ?? 0} />
              <button type="submit" className="ml-auto shrink-0 rounded-md border border-border px-2 py-1 font-semibold hover:border-primary">
                บันทึก
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

function NumInput({ name, label, defaultValue, max }: { name: string; label: string; defaultValue: number; max?: number }) {
  return (
    <label className="flex w-14 shrink-0 flex-col items-center">
      <span className="text-[9px] text-muted">{label}</span>
      <input
        name={name}
        type="number"
        min={0}
        max={max}
        defaultValue={defaultValue}
        className="w-full rounded border border-border bg-surface px-1 py-0.5 text-center outline-none focus:border-primary"
      />
    </label>
  );
}
