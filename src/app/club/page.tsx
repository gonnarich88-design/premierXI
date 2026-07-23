import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateSquad } from "@/lib/squad";
import { FORMATIONS } from "@/lib/formations";
import { computeChemistry, type ChemEntry } from "@/lib/chemistry";
import TeamNameEditor from "@/components/TeamNameEditor";
import Card from "@/components/ui/Card";

export default async function ClubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const squad = await getOrCreateSquad(user.id);
  const layout = FORMATIONS[squad.formation] ?? FORMATIONS["4-3-3"];

  const chemEntries: (ChemEntry | null)[] = layout.map((slot, i) => {
    const card = squad.slots[i]?.card;
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

  const cardCount = await prisma.userCard.count({ where: { userId: user.id } });

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-4">
        <h1 className="text-xl font-bold">My Club</h1>
      </header>

      <TeamNameEditor initialName={user.teamName} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card href="/team">
          <h2 className="text-sm font-semibold">จัดทีม</h2>
          <p className="mt-1 text-xs text-muted">
            {squad.formation} · {chem.filled}/11 · Chemistry {chem.teamChem}/33
          </p>
          <p className="text-stat-hero mt-2 text-2xl text-accent">{chem.rating || "-"}</p>
        </Card>

        <Card href="/collection">
          <h2 className="text-sm font-semibold">คลังการ์ด</h2>
          <p className="mt-1 text-xs text-muted">การ์ดทั้งหมดที่มี</p>
          <p className="text-stat-hero mt-2 text-2xl text-accent">{cardCount} ใบ</p>
        </Card>
      </div>
    </div>
  );
}
