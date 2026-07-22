"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ClubActionResult = { ok: boolean; error?: string };

// \p{M} จำเป็นสำหรับสระ/วรรณยุกต์ไทย (combining marks) — ไม่งั้นคำไทยทั่วไปอย่าง "ทีม" จะไม่ผ่าน
const teamNameRe = /^[\p{L}\p{M}\p{N} ]{2,20}$/u; // ไทย/อังกฤษ/ตัวเลข/เว้นวรรค 2-20 ตัวอักษร

export async function setTeamNameAction(name: string): Promise<ClubActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const trimmed = name.normalize("NFC").trim();

  if (trimmed === "") {
    await prisma.user.update({ where: { id: userId }, data: { teamName: null } });
    revalidatePath("/club");
    revalidatePath("/fantasy");
    return { ok: true };
  }

  if (!teamNameRe.test(trimmed)) {
    return { ok: false, error: "ชื่อทีมต้องยาว 2-20 ตัวอักษร (ไทย/อังกฤษ/ตัวเลข/เว้นวรรค)" };
  }

  await prisma.user.update({ where: { id: userId }, data: { teamName: trimmed } });
  revalidatePath("/club");
  revalidatePath("/fantasy");
  return { ok: true };
}
