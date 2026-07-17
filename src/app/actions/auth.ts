"use server";

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
} from "@/lib/auth";
export type AuthState = { error?: string } | undefined;

const usernameRe = /^[a-zA-Z0-9_]{3,20}$/;
const phoneRe = /^0\d{8,9}$/; // เบอร์ไทย: ขึ้นต้น 0 ตามด้วยตัวเลข 9-10 หลัก

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!usernameRe.test(username))
    return { error: "username ต้องเป็น a-z, 0-9, _ ยาว 3-20 ตัว" };
  if (!phoneRe.test(phone))
    return { error: "เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)" };
  if (password.length < 6) return { error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัว" };

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) return { error: "username นี้ถูกใช้แล้ว" };
  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) return { error: "เบอร์โทรนี้ถูกใช้แล้ว" };

  const user = await prisma.user.create({
    data: { username, phone, passwordHash: hashPassword(password) },
    select: { id: true },
  });

  // ไม่แจกการ์ดทันที — ผู้เล่นจะเปิด Starter Pack ฟรีเองในหน้าเปิดซอง
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);

  redirect("/");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "username หรือรหัสผ่านไม่ถูกต้อง" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);

  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ===== TEMP: บัญชีทดสอบ (ลบทั้งบล็อกนี้ + ปุ่มในหน้า login/home เมื่อระบบเสร็จ) =====
// เปิดใช้เฉพาะตอนตั้ง ENABLE_DEV_LOGIN=true ใน .env (ไม่ใช้ NODE_ENV เพราะ preview รัน `next build && next start`
// ซึ่ง NODE_ENV เป็น "production" เสมอ) — ต้องลบ env var นี้ออกก่อน deploy จริงเพื่อปิดช่องโหว่
const TEST_USERNAME = "test";
const TEST_PHONE = "0800000000";
const TEST_PASSWORD = "test1234";
const DEV_LOGIN_ENABLED = process.env.ENABLE_DEV_LOGIN === "true";

export async function devLoginAction() {
  if (!DEV_LOGIN_ENABLED) notFound();
  let user = await prisma.user.findUnique({
    where: { username: TEST_USERNAME },
    select: { id: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: TEST_USERNAME,
        phone: TEST_PHONE,
        passwordHash: hashPassword(TEST_PASSWORD),
      },
      select: { id: true },
    });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);
  redirect("/");
}

// เริ่มใหม่: ลบบัญชี test เดิม (การ์ด + ทีม cascade) แล้วสร้างใหม่ + ล็อกอิน = เข้าครั้งแรก
export async function resetTestUserAction() {
  if (!DEV_LOGIN_ENABLED) notFound();
  await prisma.user.deleteMany({ where: { username: TEST_USERNAME } });
  const user = await prisma.user.create({
    data: {
      username: TEST_USERNAME,
      phone: TEST_PHONE,
      passwordHash: hashPassword(TEST_PASSWORD),
      lastLoginAt: new Date(),
    },
    select: { id: true },
  });
  await createSession(user.id);
  redirect("/");
}
