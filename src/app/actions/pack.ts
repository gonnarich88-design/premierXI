"use server";

import { getSessionUserId } from "@/lib/auth";
import { openPack, type OpenResult } from "@/lib/packs";
import { InsufficientFundsError } from "@/lib/economy";
import { createNotification } from "@/lib/notifications";

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

    await createNotification({
      userId,
      type: "PACK_OPENED",
      title: `เปิดซองได้ ${result.card.playerName}`,
      body: `${result.card.tier} · ${result.card.position} · OVR ${result.card.ovr}${
        result.isDuplicate ? ` (ซ้ำ +${result.shardsGained} Shards)` : ""
      }`,
      href: "/collection",
    });
    if (result.leveledUp) {
      await createNotification({
        userId,
        type: "LEVEL_UP",
        title: `เลเวลอัพเป็น Lv.${result.level}!`,
        href: "/profile",
      });
    }

    return { ok: true, result };
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return { ok: false, error: "ยอดเงินไม่พอสำหรับเปิดซองนี้" };
    }
    return { ok: false, error: "เปิดซองไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
