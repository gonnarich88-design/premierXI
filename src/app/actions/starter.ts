"use server";

import { getSessionUserId } from "@/lib/auth";
import {
  openStarterPack,
  StarterAlreadyClaimedError,
  type StarterCard,
} from "@/lib/starter";

export type OpenStarterResponse =
  | { ok: true; cards: StarterCard[] }
  | { ok: false; error: string };

export async function openStarterPackAction(): Promise<OpenStarterResponse> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  try {
    const { cards } = await openStarterPack(userId);
    return { ok: true, cards };
  } catch (e) {
    if (e instanceof StarterAlreadyClaimedError) {
      return { ok: false, error: "รับ Starter Pack ไปแล้ว" };
    }
    return { ok: false, error: "เปิด Starter Pack ไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
