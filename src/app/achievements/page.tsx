import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAchievementStatus } from "@/lib/achievements";
import AchievementList from "@/components/AchievementList";

export default async function AchievementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const achievements = await getAchievementStatus(user.id);

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Achievement</h1>
        <p className="mt-0.5 text-sm text-muted">สะสมความสำเร็จ รับรางวัล Silver / Gold / ซองฟรี</p>
      </header>
      <AchievementList achievements={achievements} />
    </div>
  );
}
