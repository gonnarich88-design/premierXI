// src/app/fantasy/team/page.tsx
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentGameweek, getOrCreateEntry } from "@/lib/fantasy";
import { FORMATIONS, FORMATION_NAMES, DEFAULT_FORMATION } from "@/lib/formations";
import FantasyPitch from "@/components/FantasyPitch";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "จัดทีม Fantasy · Premier XI" };

export default async function FantasyTeamPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const now = new Date();
  const gameweek = await getCurrentGameweek(now);

  if (!gameweek) {
    return (
      <div className="px-4 pt-3">
        <PageHeader title="จัดทีม" backHref="/fantasy" />
        <p className="pt-6 text-center text-sm text-muted">
          ยังไม่มี Gameweek เปิดให้จัดทีมตอนนี้ กลับมาเช็คใหม่ภายหลัง
        </p>
      </div>
    );
  }

  // จุดเดียวที่เรียก getOrCreateEntry ได้ — user ตั้งใจเข้ามาจัดทีมจริง (ไม่ใช่แค่ preview บน hub)
  const entry = await getOrCreateEntry(userId, gameweek.id);
  const layout = FORMATIONS[entry.formation] ?? FORMATIONS[DEFAULT_FORMATION];
  const locked = now >= gameweek.deadline;

  const owned = await prisma.userCard.findMany({
    where: { userId },
    include: { card: { include: { player: true } } },
    orderBy: { card: { ovr: "desc" } },
  });

  const ownedCards = owned.map((uc) => ({
    id: uc.card.id,
    ovr: uc.card.ovr,
    position: uc.card.position,
    tier: uc.card.tier,
    imageUrl: uc.card.imageUrl,
    name: uc.card.player.name,
    playerId: uc.card.playerId,
  }));

  const starters = layout.map((slot, i) => {
    const s = entry.slots.find((x) => x.slotIndex === i);
    const card = s ? ownedCards.find((c) => c.id === s.cardId) ?? null : null;
    return {
      slotIndex: i,
      pos: slot.pos,
      x: slot.x,
      y: slot.y,
      cardId: s?.cardId ?? null,
      card,
      isCaptain: s?.isCaptain ?? false,
      isViceCaptain: s?.isViceCaptain ?? false,
    };
  });

  const bench = Array.from({ length: 4 }, (_, i) => {
    const slotIndex = layout.length + i;
    const s = entry.slots.find((x) => x.slotIndex === slotIndex);
    const card = s ? ownedCards.find((c) => c.id === s.cardId) ?? null : null;
    return { slotIndex, priority: i + 1, cardId: s?.cardId ?? null, card };
  });

  return (
    <div>
      <div className="px-3 pt-3">
        <PageHeader title="จัดทีม" backHref="/fantasy" />
      </div>
      <FantasyPitch
        gameweekId={gameweek.id}
        gameweekNumber={gameweek.number}
        deadline={gameweek.deadline.toISOString()}
        locked={locked}
        formation={entry.formation}
        formations={FORMATION_NAMES}
        starters={starters}
        bench={bench}
        ownedCards={ownedCards}
      />
    </div>
  );
}
