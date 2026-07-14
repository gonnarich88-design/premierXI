import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cardCount = await prisma.userCard.count({ where: { userId: user.id } });

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xl font-bold text-primary-foreground">
          {user.username.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-bold">{user.username}</h1>
          <p className="text-sm text-muted">{user.phone}</p>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Info label="Level" value={`Lv.${user.level}`} />
        <Info label="EXP" value={`${user.exp}`} />
        <Info label="Silver" value={user.silver.toLocaleString()} />
        <Info label="Gold" value={user.gold.toLocaleString()} />
        <Info label="Pack Ticket" value={`${user.packTicket}`} />
        <Info label="Shards" value={`${user.shards}`} />
        <Info label="การ์ดที่มี" value={`${cardCount}`} />
        {user.isAdmin && <Info label="สิทธิ์" value="Admin" />}
      </div>

      <Link
        href="/collection"
        className="mb-3 block w-full rounded-xl border border-border bg-surface py-3 text-center font-semibold hover:border-primary"
      >
        ดูคลังการ์ดทั้งหมด
      </Link>

      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-xl border border-border bg-surface py-3 font-semibold text-red-300 hover:border-red-400/50"
        >
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 font-bold">{value}</div>
    </div>
  );
}
