import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listGameweeksForAdmin } from "@/lib/fantasyAdmin";
import { createGameweekAction } from "@/app/actions/fantasyAdmin";

export const metadata = { title: "จัดการ Fantasy · Admin" };

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "SCORED"
      ? "bg-primary/20 text-primary"
      : status === "SCORING"
        ? "bg-amber-500/20 text-amber-300"
        : "bg-border text-muted";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}>{status}</span>;
}

export default async function AdminFantasyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");

  const { error } = await searchParams;
  const gameweeks = await listGameweeksForAdmin();

  return (
    <div className="px-4 pt-5">
      <h1 className="mb-4 text-lg font-bold">จัดการ Fantasy — Gameweek</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <form action={createGameweekAction} className="mb-6 space-y-3 rounded-xl border border-border bg-surface/60 p-4">
        <div>
          <label className="mb-1 block text-sm text-muted">หมายเลข Gameweek</label>
          <input
            name="number"
            type="number"
            required
            min={1}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="เช่น 1"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Deadline</label>
          <input
            name="deadline"
            type="datetime-local"
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <button type="submit" className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
          สร้าง Gameweek
        </button>
      </form>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Gameweek ทั้งหมด ({gameweeks.length})
      </h2>
      {gameweeks.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มี Gameweek</p>
      ) : (
        <ul className="space-y-2">
          {gameweeks.map((gw) => (
            <li key={gw.id}>
              <Link
                href={`/admin/fantasy/${gw.id}`}
                className="block rounded-xl border border-border bg-surface/60 p-3 hover:border-primary"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Gameweek {gw.number}</span>
                  <StatusBadge status={gw.status} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  Deadline: {gw.deadline.toLocaleString("th-TH")} · {gw.matchCount} แมตช์ · {gw.entryCount} ทีม
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
