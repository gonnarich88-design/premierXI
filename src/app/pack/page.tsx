import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PACKS, SHARD_EXCHANGE } from "@/lib/packs";
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
    fillerRates: p.fillerRates,
    special: p.special ?? null,
  }));

  const shardExchanges = Object.entries(SHARD_EXCHANGE).map(([id, e]) => ({
    id,
    packId: e.packId,
    field: e.field,
    cost: e.cost,
  }));

  return (
    <PackShop
      packs={packs}
      shardExchanges={shardExchanges}
      wallet={{
        silver: user.silver,
        gold: user.gold,
        packTicket: user.packTicket,
        shards: user.shards,
        evoShards: user.evoShards,
        primeShards: user.primeShards,
      }}
      starterClaimed={user.starterClaimed}
    />
  );
}
