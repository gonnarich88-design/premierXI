import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { devLoginAction, resetTestUserAction } from "@/app/actions/auth";
import { getDailyStatus } from "@/lib/daily";
import DailyClaim from "@/components/DailyClaim";
import MissionList from "@/components/MissionList";
import { getMissionStatus } from "@/lib/missions";
import StarterPackModal from "@/components/StarterPackModal";
import { FORMATIONS } from "@/lib/formations";
import { computeChemistry, type ChemEntry } from "@/lib/chemistry";
import { getPvpStatus } from "@/lib/pvp";
import { getCurrentGameweek } from "@/lib/fantasy";

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

      {/* TEMP: ปุ่มบัญชีทดสอบ (ลบเมื่อระบบเสร็จ) — ซ่อนถ้าไม่ได้เปิด ENABLE_DEV_LOGIN */}
      {process.env.ENABLE_DEV_LOGIN === "true" && (
        <>
          <form action={devLoginAction}>
            <button
              type="submit"
              className="w-full rounded-xl border border-dashed border-accent/60 bg-surface py-3 text-sm font-semibold text-accent"
            >
              เข้าสู่ระบบด้วยบัญชีทดสอบ (test)
            </button>
          </form>
          <form action={resetTestUserAction}>
            <button
              type="submit"
              className="w-full rounded-xl border border-dashed border-border bg-surface py-3 text-sm font-semibold text-muted"
            >
              เริ่มใหม่ (ล้าง test แล้วเข้าครั้งแรก)
            </button>
          </form>
        </>
      )}
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
    teamName: string | null;
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
  const missions = await getMissionStatus(userId, new Date());
  const need = user.level * 100;
  const pct = Math.min(100, Math.round((user.exp / need) * 100));

  // Active Squad summary (สำหรับการ์ด My Club) — อ่านอย่างเดียว ห้ามสร้าง Squad จากหน้า Home
  // (getOrCreateSquad เป็น find-then-create ไม่ atomic เหมาะกับหน้า /club ที่ตั้งใจเข้ามาสร้างเท่านั้น)
  const squad = await prisma.squad.findUnique({
    where: { userId },
    include: { slots: { orderBy: { index: "asc" }, include: { card: { include: { player: true } } } } },
  });
  const layout = squad ? FORMATIONS[squad.formation] ?? FORMATIONS["4-3-3"] : [];
  const chemEntries: (ChemEntry | null)[] = layout.map((slot, i) => {
    const card = squad?.slots[i]?.card;
    if (!card) return null;
    return {
      ovr: card.ovr,
      position: card.position,
      altPositions: card.altPositions ? card.altPositions.split(",") : [],
      club: card.player.club,
      nation: card.player.nation,
      slotPos: slot.pos,
    };
  });
  const chem = computeChemistry(chemEntries);

  // PvP quota วันนี้ (read-only)
  const pvpStatus = await getPvpStatus(userId, new Date());

  // Fantasy: gameweek ปัจจุบัน + เช็คว่า submit ทีมหรือยัง — อ่านอย่างเดียว ห้ามเรียก getOrCreateEntry (มี side effect สร้าง draft)
  const currentGameweek = await getCurrentGameweek(new Date());
  const myEntry = currentGameweek
    ? await prisma.fantasyEntry.findUnique({
        where: { userId_gameweekId: { userId, gameweekId: currentGameweek.id } },
        select: { submittedAt: true },
      })
    : null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        สวัสดี <span className="font-semibold text-foreground">{user.teamName ?? user.username}</span>
      </p>

      {/* Currency bar (Silver/Gold ย้ายไปโชว์ค้างที่ header แล้ว) */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface/60 p-3 text-center text-xs">
        <Stat label="Ticket" value={user.packTicket} className="text-accent" />
        <Stat label="การ์ด" value={cardCount} className="text-primary" />
      </div>

      {/* Shortcut cards: My Club / PvP / Fantasy */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/club"
          className="rounded-2xl border border-border bg-surface/60 p-3 text-center hover:border-primary"
        >
          <p className="text-xs font-semibold">My Club</p>
          <p className="mt-1 text-lg font-bold text-accent">{chem.rating || "-"}</p>
          <p className="text-[10px] text-muted">Chem {chem.teamChem}/33</p>
        </Link>
        <Link
          href="/pvp"
          className="rounded-2xl border border-border bg-surface/60 p-3 text-center hover:border-primary"
        >
          <p className="text-xs font-semibold">PvP</p>
          <p className="mt-1 text-lg font-bold text-accent">{pvpStatus.matchesRemaining}</p>
          <p className="text-[10px] text-muted">แมตช์เหลือวันนี้</p>
        </Link>
        <Link
          href="/fantasy"
          className="rounded-2xl border border-border bg-surface/60 p-3 text-center hover:border-primary"
        >
          <p className="text-xs font-semibold">Fantasy</p>
          <p className="mt-1 text-lg font-bold text-accent">
            {!currentGameweek ? "-" : myEntry?.submittedAt ? "ส่งแล้ว" : "ยังไม่ส่ง"}
          </p>
          <p className="text-[10px] text-muted">
            {currentGameweek ? `GW${currentGameweek.number}` : "ไม่มีรอบเปิด"}
          </p>
        </Link>
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
        <>
          <StarterPackModal />
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
              เปิดฟรีเพื่อรับการ์ดตั้งต้น 11 ใบ + 300 Silver → แตะที่นี่
            </p>
          </Link>
        </>
      )}

      {/* Daily login */}
      <DailyClaim
        canClaim={daily.canClaim}
        streak={daily.streak}
        nextReward={daily.nextReward}
        totalLogins={daily.totalLogins}
      />

      {/* Missions */}
      <MissionList missions={missions} />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/pack"
          className="rounded-xl bg-primary py-4 text-center font-bold text-primary-foreground hover:bg-primary-strong"
        >
          เปิดซอง
        </Link>
        <Link
          href="/club"
          className="rounded-xl border border-border bg-surface py-4 text-center font-bold hover:border-primary"
        >
          My Club
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
