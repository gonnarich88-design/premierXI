"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { claimAchievement, type ClaimAchievementResult } from "@/lib/achievements";
import { notifyLevelRewards, notifyAchievementUnlocked } from "@/lib/notifications";

export async function claimAchievementAction(achievementKey: string): Promise<ClaimAchievementResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const result = await claimAchievement(userId, achievementKey);
  if (result.ok) {
    revalidatePath("/achievements");
    revalidatePath("/profile");
    await notifyAchievementUnlocked(userId, result.achievementLabel, result.reward, result.pack);
    if (result.leveledUp) {
      await notifyLevelRewards(userId, result.level, result.levelRewards);
    }
  }
  return result;
}
