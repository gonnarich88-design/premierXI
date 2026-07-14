"use server";

import { getSessionUserId } from "@/lib/auth";
import { openPack, type OpenResult } from "@/lib/packs";
import { InsufficientFundsError } from "@/lib/economy";

export type OpenPackResponse =
  | { ok: true; result: OpenResult }
  | { ok: false; error: string };

export async function openPackAction(
  packId: string,
): Promise<OpenPackResponse> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  try {
    const result = await openPack(userId, packId);
    return { ok: true, result };
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return { ok: false, error: "ยอดเงินไม่พอสำหรับเปิดซองนี้" };
    }
    return { ok: false, error: "เปิดซองไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
