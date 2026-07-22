"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markAllRead } from "@/lib/notifications";

// เรียกจาก client component ตอนเปิดหน้า /notifications — ต้องเป็น Server Action (ไม่ใช่เรียกตรงจาก
// render ของหน้า) เพื่อให้ revalidatePath("/", "layout") ทำงานได้จริง ไม่งั้นตัวเลข unread ที่ header
// (มาจาก root layout) จะค้าง ไม่หายแม้เพิ่งอ่านแล้ว เพราะ layout ไม่ถูกสั่ง revalidate
//
// รับ `cutoffIso` ที่ capture ไว้ตอน page.tsx โหลด snapshot (ก่อน hydrate/ก่อน round-trip นี้) แล้วส่งต่อมา
// เพื่อกัน race: ถ้า mark-as-read ทั้งหมดโดยใช้เวลา ณ ตอนที่ action นี้รัน (หลัง hydrate มีดีเลย์) รายการที่เพิ่งถูกสร้าง
// ระหว่างเปิดหน้าจะโดนนับว่าอ่านแล้วทั้งที่ผู้ใช้ไม่เคยเห็นใน snapshot ที่แสดงอยู่
export async function markNotificationsReadAction(cutoffIso: string) {
  const userId = await getSessionUserId();
  if (!userId) return;
  const cutoff = new Date(cutoffIso);
  if (Number.isNaN(cutoff.getTime())) return;
  await markAllRead(userId, cutoff);
  revalidatePath("/", "layout");
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return null;
  return user;
}

function revalidateNews() {
  revalidatePath("/admin/news");
  revalidatePath("/notifications");
}

export async function createAnnouncementAction(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return;

  await prisma.announcement.create({
    data: { title, body, authorId: admin.id },
  });
  revalidateNews();
}

export async function toggleAnnouncementAction(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const current = await prisma.announcement.findUnique({
    where: { id },
    select: { published: true },
  });
  if (!current) return;

  await prisma.announcement.update({
    where: { id },
    data: { published: !current.published },
  });
  revalidateNews();
}

export async function deleteAnnouncementAction(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.announcement.delete({ where: { id } });
  revalidateNews();
}
