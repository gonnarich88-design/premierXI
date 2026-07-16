import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.AUTH_SECRET || "px-dev-insecure-secret-change-me";
const COOKIE = "px_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 วัน

// ===== Password hashing (Node scrypt — ไม่ต้องพึ่ง native dep) =====
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  return (
    hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf)
  );
}

// ===== Signed token (mini-JWT ด้วย HMAC — ไม่ต้องพึ่ง lib ภายนอก) =====
function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64url");
}

function signToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifyToken(token: string): Record<string, unknown> | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (sign(body) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

// ===== Session cookie =====
export async function createSession(userId: string) {
  const token = signToken({ uid: userId, iat: Date.now() });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  const uid = payload?.uid;
  return typeof uid === "string" ? uid : null;
}

/** ดึงผู้ใช้ปัจจุบันจาก session (null ถ้าไม่ล็อกอิน) */
export async function getCurrentUser() {
  const uid = await getSessionUserId();
  if (!uid) return null;
  return prisma.user.findUnique({
    where: { id: uid },
    select: {
      id: true,
      username: true,
      phone: true,
      isAdmin: true,
      level: true,
      exp: true,
      silver: true,
      gold: true,
      packTicket: true,
      shards: true,
      evoShards: true,
      primeShards: true,
      pityCounter: true,
      starterClaimed: true,
    },
  });
}
