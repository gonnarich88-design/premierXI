import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateSquad } from "@/lib/squad";
import { FORMATIONS, FORMATION_NAMES } from "@/lib/formations";
import { computeChemistry, type ChemEntry } from "@/lib/chemistry";
import TeamBuilder from "@/components/TeamBuilder";

export default async function TeamPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const squad = await getOrCreateSquad(userId);
  const layout = FORMATIONS[squad.formation] ?? FORMATIONS["4-3-3"];

  const owned = await prisma.userCard.findMany({
    where: { userId },
    include: { card: { include: { player: true } } },
    orderBy: { card: { ovr: "desc" } },
  });

  // สร้าง entries เรียงตาม slot index เพื่อคำนวณ chemistry
  const chemEntries: (ChemEntry | null)[] = layout.map((slot, i) => {
    const card = squad.slots[i]?.card;
    if (!card) return null;
    return {
      ovr: card.ovr,
      position: card.position,
      altPositions: card.altPositions ? card.altPositions.split(",") : [],
      club: card.player.club,
      nation: card.player.nation,
      league: card.player.league,
      slotPos: slot.pos,
    };
  });
  const chem = computeChemistry(chemEntries);

  const slots = layout.map((slot, i) => {
    const card = squad.slots[i]?.card;
    return {
      index: i,
      pos: slot.pos,
      x: slot.x,
      y: slot.y,
      chem: chem.perSlot[i],
      card: card
        ? {
            id: card.id,
            ovr: card.ovr,
            position: card.position,
            tier: card.tier,
            imageUrl: card.imageUrl,
            name: card.player.name,
            club: card.player.club,
          }
        : null,
    };
  });

  const ownedCards = owned.map((uc) => ({
    id: uc.card.id,
    ovr: uc.card.ovr,
    position: uc.card.position,
    tier: uc.card.tier,
    imageUrl: uc.card.imageUrl,
    name: uc.card.player.name,
    club: uc.card.player.club,
  }));

  return (
    <TeamBuilder
      formation={squad.formation}
      formations={FORMATION_NAMES}
      slots={slots}
      ownedCards={ownedCards}
      rating={chem.rating}
      teamChem={chem.teamChem}
      filled={chem.filled}
    />
  );
}
