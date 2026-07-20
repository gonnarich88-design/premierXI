// src/app/actions/fantasy.ts
"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { saveEntry, type LineupInput } from "@/lib/fantasy";

export type FantasyActionResult = { ok: boolean; error?: string };

export async function saveEntryAction(
  gameweekId: string,
  formation: string,
  lineup: LineupInput[],
): Promise<FantasyActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  try {
    await saveEntry(userId, gameweekId, formation, lineup);
    revalidatePath("/fantasy");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ผิดพลาด" };
  }
}
