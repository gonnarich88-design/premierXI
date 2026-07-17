"use server";

import { getSessionUserId } from "@/lib/auth";
import { openPack, openPackWithShards, type OpenResult } from "@/lib/packs";
import { InsufficientFundsError } from "@/lib/economy";
import { createNotification, notifyLevelRewards } from "@/lib/notifications";

export type OpenPackResponse =
  | { ok: true; result: OpenResult }
  | { ok: false; error: string };

async function notifyResult(userId: string, result: OpenResult) {
  const special = result.cards.find((c) => c.isSpecial);
  const highlight = special ?? result.cards[0];
  const dupCount = result.cards.filter((c) => c.isDuplicate).length;
  const shardsTotal = result.cards.reduce((sum, c) => sum + c.shardsGained, 0);

  await createNotification({
    userId,
    type: "PACK_OPENED",
    title: `เปิดซองได้ ${highlight.playerName}${special ? " ⭐" : ""}`,
    body: `${highlight.tier} · ${highlight.position} · OVR ${highlight.ovr} · ${result.cards.length} ใบ${
      dupCount ? ` (ซ้ำ ${dupCount} ใบ +${shardsTotal} Shards)` : ""
    }`,
    href: "/collection",
  });
  if (result.leveledUp) {
    await notifyLevelRewards(userId, result.level, result.levelRewards);
  }
}

export async function openPackAction(packId: string): Promise<OpenPackResponse> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  try {
    const result = await openPack(userId, packId);
    await notifyResult(userId, result);
    return { ok: true, result };
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return { ok: false, error: "ยอดเงินไม่พอสำหรับเปิดซองนี้" };
    }
    return { ok: false, error: "เปิดซองไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

export async function openPackWithShardsAction(exchangeId: string): Promise<OpenPackResponse> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  try {
    const result = await openPackWithShards(userId, exchangeId);
    await notifyResult(userId, result);
    return { ok: true, result };
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return { ok: false, error: "Shard ไม่พอสำหรับแลกซองนี้" };
    }
    return { ok: false, error: "แลกซองไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
