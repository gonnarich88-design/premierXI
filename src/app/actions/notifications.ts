"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
