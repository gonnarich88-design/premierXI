// src/app/fantasy/page.tsx
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentGameweek, getOrCreateEntry, getLeaderboard, getMyLeaderboardRow } from "@/lib/fantasy";
import { FORMATIONS, FORMATION_NAMES, DEFAULT_FORMATION } from "@/lib/formations";
import FantasyPitch from "@/components/FantasyPitch";
import FantasyLeaderboard from "@/components/FantasyLeaderboard";

export default async function FantasyPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const now = new Date();
  const gameweek = await getCurrentGameweek(now);

  if (!gameweek) {
    return (
      <div className="px-4 pt-10 text-center text-sm text-muted">
        ยังไม่มี Gameweek เปิดให้จัดทีมตอนนี้ กลับมาเช็คใหม่ภายหลัง
      </div>
    );
  }

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

  // Leaderboard ของ Gameweek ล่าสุดที่ปิดคิดคะแนนแล้ว (ไม่ใช่ GW ที่กำลังจัดทีมอยู่ ซึ่งยังไม่มีผลคะแนน)
  const lastScored = await prisma.gameweek.findFirst({
    where: { status: "SCORED" },
    orderBy: { number: "desc" },
  });
  const leaderboard = lastScored
    ? {
        gameweekNumber: lastScored.number,
        rows: await getLeaderboard(lastScored.id),
        myRow: await getMyLeaderboardRow(lastScored.id, userId),
      }
    : null;

  return (
    <div>
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
      {leaderboard && (
        <FantasyLeaderboard
          gameweekNumber={leaderboard.gameweekNumber}
          rows={leaderboard.rows}
          myRow={leaderboard.myRow}
          myUserId={userId}
        />
      )}
    </div>
  );
}
