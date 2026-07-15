"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { setFormation, assignSlot } from "@/lib/squad";

export type SquadActionResult = { ok: boolean; error?: string };

export async function setFormationAction(
  formation: string,
): Promise<SquadActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  try {
    await setFormation(userId, formation);
    revalidatePath("/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ผิดพลาด" };
  }
}

export async function assignSlotAction(
  index: number,
  cardId: string | null,
): Promise<SquadActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  try {
    await assignSlot(userId, index, cardId);
    revalidatePath("/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ผิดพลาด" };
  }
}
