"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { claimDaily, type ClaimResult } from "@/lib/daily";

export async function claimDailyAction(): Promise<ClaimResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  const result = await claimDaily(userId);
  if (result.ok) revalidatePath("/");
  return result;
}
