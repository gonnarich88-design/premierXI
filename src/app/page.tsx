import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { devLoginAction } from "@/app/actions/auth";
import { getDailyStatus } from "@/lib/daily";
import DailyClaim from "@/components/DailyClaim";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 text-center">
        <h1 className="bg-gradient-to-r from-accent to-primary bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
          PREMIER XI
        </h1>
        <p className="mt-1 text-sm text-muted">
          สะสมการ์ดนักฟุตบอลพรีเมียร์ลีก
        </p>
      </header>

      {user ? <LoggedInHome userId={user.id} user={user} /> : <GuestHome />}
    </div>
  );
}

function GuestHome() {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-surface p-6 text-center">
        <h2 className="text-lg font-bold">ยินดีต้อนรับสู่ Premier XI</h2>
        <p className="mt-2 text-sm text-muted">
          สมัครสมาชิกเพื่อรับ Starter Pack ฟรี แล้วเริ่มสะสมการ์ดนักเตะได้เลย
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/register"
          className="rounded-xl bg-primary py-3 text-center font-bold text-primary-foreground hover:bg-primary-strong"
        >
          สมัครสมาชิก
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-border bg-surface py-3 text-center font-bold hover:border-primary"
        >
          เข้าสู่ระบบ
        </Link>
      </div>

      {/* TEMP: ปุ่มบัญชีทดสอบ (ลบเมื่อระบบเสร็จ) */}
      <form action={devLoginAction}>
        <button
          type="submit"
          className="w-full rounded-xl border border-dashed border-accent/60 bg-surface py-3 text-sm font-semibold text-accent"
        >
          เข้าสู่ระบบด้วยบัญชีทดสอบ (test)
        </button>
      </form>
    </section>
  );
}

async function LoggedInHome({
  userId,
  user,
}: {
  userId: string;
  user: {
    username: string;
    level: number;
    exp: number;
    silver: number;
    gold: number;
    packTicket: number;
    starterClaimed: boolean;
  };
}) {
  const cardCount = await prisma.userCard.count({ where: { userId } });
  const daily = await getDailyStatus(userId);
  const need = user.level * 100;
  const pct = Math.min(100, Math.round((user.exp / need) * 100));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        สวัสดี <span className="font-semibold text-foreground">{user.username}</span>
      </p>

      {/* Currency bar */}
      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-border bg-surface/60 p-3 text-center text-xs">
        <Stat label="Silver" value={user.silver} className="text-silver" />
        <Stat label="Gold" value={user.gold} className="text-gold" />
        <Stat label="Ticket" value={user.packTicket} className="text-accent" />
        <Stat label="การ์ด" value={cardCount} className="text-primary" />
      </div>

      {/* Level / EXP */}
      <div className="rounded-2xl border border-border bg-surface/60 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold text-primary">Level {user.level}</span>
          <span className="text-muted">
            {user.exp} / {need} EXP
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Starter Pack — ยังไม่เปิด */}
      {!user.starterClaimed && (
        <Link
          href="/pack"
          className="block rounded-2xl border border-accent bg-gradient-to-br from-primary/25 to-accent/20 p-4"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">Starter Pack รอเปิด</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              ฟรี
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            เปิดฟรีเพื่อรับการ์ดตั้งต้น 11 ใบ + 300 Silver + 1 Ticket → แตะที่นี่
          </p>
        </Link>
      )}

      {/* Daily login */}
      <DailyClaim
        canClaim={daily.canClaim}
        streak={daily.streak}
        nextReward={daily.nextReward}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/pack"
          className="rounded-xl bg-primary py-4 text-center font-bold text-primary-foreground hover:bg-primary-strong"
        >
          เปิดซอง
        </Link>
        <Link
          href="/team"
          className="rounded-xl border border-border bg-surface py-4 text-center font-bold hover:border-primary"
        >
          จัดทีม
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div>
      <div className={`font-bold ${className ?? ""}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-muted">{label}</div>
    </div>
  );
}
