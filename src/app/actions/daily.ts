"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { claimDaily, type ClaimResult } from "@/lib/daily";
import { createNotification } from "@/lib/notifications";

export async function claimDailyAction(): Promise<ClaimResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  const result = await claimDaily(userId);
  if (result.ok) {
    revalidatePath("/");

    const parts = [`+${result.reward.silver} Silver`];
    if (result.reward.gold) parts.push(`+${result.reward.gold} Gold`);
    if (result.reward.packTicket)
      parts.push(`+${result.reward.packTicket} Ticket`);
    await createNotification({
      userId,
      type: "DAILY_REWARD",
      title: `รับรางวัลล็อกอินวันที่ ${result.streak}`,
      body: parts.join(" · "),
      href: "/",
    });
    if (result.leveledUp) {
      await createNotification({
        userId,
        type: "LEVEL_UP",
        title: `เลเวลอัพเป็น Lv.${result.level}!`,
        href: "/profile",
      });
    }
    if (result.milestone) {
      const packName = result.milestone.packId === "evolution" ? "Evolution Pack" : "Royal Prime Pack";
      await createNotification({
        userId,
        type: "PACK_OPENED",
        title: `Login ครบตามเป้า! ได้ ${packName} ฟรี 🎁`,
        body: `เปิดฟรี ${result.milestone.cards.length} ใบ — โปรโมชั่นเปิดตัวเกม`,
        href: "/collection",
      });
    }
  }
  return result;
}
