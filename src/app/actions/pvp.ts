"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { playPvpMatch, type PvpMatchResult } from "@/lib/pvp";
import { notifyPvpMatch, notifyPvpSeasonEnd, notifyLevelRewards } from "@/lib/notifications";

export async function playPvpMatchAction(): Promise<PvpMatchResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const result = await playPvpMatch(userId, new Date());
  if (result.ok) {
    revalidatePath("/pvp");
    revalidatePath("/", "layout");
    await notifyPvpMatch(userId, result);
    if (result.seasonEndReward) {
      await notifyPvpSeasonEnd(userId, result.seasonEndReward);
    }
    if (result.leveledUp) {
      await notifyLevelRewards(userId, result.level, result.levelRewards);
    }
  }
  return result;
}
