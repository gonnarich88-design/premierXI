import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PACKS } from "@/lib/packs";
import PackShop from "@/components/PackShop";

export default async function PackPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const packs = Object.values(PACKS).map((p) => ({
    id: p.id,
    name: p.name,
    currency: p.currency,
    cost: p.cost,
    desc: p.desc,
    rates: p.rates,
    pityThreshold: p.pityThreshold ?? null,
  }));

  return (
    <PackShop
      packs={packs}
      wallet={{
        silver: user.silver,
        gold: user.gold,
        packTicket: user.packTicket,
        shards: user.shards,
      }}
      pity={user.pityCounter}
      starterClaimed={user.starterClaimed}
    />
  );
}
