import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlayerCard from "@/components/PlayerCard";
import PageHeader from "@/components/ui/PageHeader";

export default async function CollectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cards = await prisma.userCard.findMany({
    where: { userId: user.id },
    include: { card: { include: { player: true } } },
    orderBy: { card: { ovr: "desc" } },
  });

  return (
    <div className="px-4 pt-3">
      <PageHeader
        title="คลังการ์ด"
        backHref="/club"
        action={<span className="shrink-0 text-sm text-muted">{cards.length} ใบ</span>}
      />

      {cards.length === 0 ? (
        <div className="surface-card rounded-2xl p-6 text-center text-sm text-muted">
          ยังไม่มีการ์ด — ไปที่หน้า{" "}
          <Link href="/pack" className="text-accent">
            เปิดซอง
          </Link>{" "}
          เพื่อเริ่มสะสม
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {cards.map((uc) => (
            <PlayerCard
              key={uc.id}
              imageUrl={uc.card.imageUrl}
              name={uc.card.player.name}
              ovr={uc.card.ovr}
              position={uc.card.position}
            />
          ))}
        </div>
      )}
    </div>
  );
}
