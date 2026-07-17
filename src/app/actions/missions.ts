"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { claimMission, type ClaimMissionResult } from "@/lib/missions";
import { notifyLevelRewards, notifyMissionClaimed } from "@/lib/notifications";

export async function claimMissionAction(missionKey: string): Promise<ClaimMissionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const result = await claimMission(userId, missionKey, new Date());
  if (result.ok) {
    revalidatePath("/", "layout");
    await notifyMissionClaimed(userId, result.missionLabel, result.reward, result.pack);
    if (result.leveledUp) {
      await notifyLevelRewards(userId, result.level, result.levelRewards);
    }
  }
  return result;
}
