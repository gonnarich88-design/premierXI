import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getPvpStatus } from "@/lib/pvp";
import PvpMatch from "@/components/PvpMatch";

export default async function PvpPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const status = await getPvpStatus(userId, new Date());

  return (
    <div className="px-4 pb-6 pt-6">
      <h1 className="text-xl font-bold">PvP</h1>
      <PvpMatch status={status} />
    </div>
  );
}
