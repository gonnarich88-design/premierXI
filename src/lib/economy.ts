import { prisma } from "@/lib/prisma";
import {
  type Currency,
  DEPOSIT_RATE_GOLD_PER_BAHT,
} from "@/lib/constants";
import { Prisma } from "@prisma/client";

export class InsufficientFundsError extends Error {
  constructor(
    public currency: Currency,
    public have: number,
    public need: number,
  ) {
    super(`ยอด ${currency} ไม่พอ (มี ${have} ต้องการ ${need})`);
    this.name = "InsufficientFundsError";
  }
}

/** เพิ่มเงินสกุลใดสกุลหนึ่งให้ผู้ใช้ (amount ต้อง > 0) */
export async function addCurrency(
  userId: string,
  currency: Currency,
  amount: number,
  tx?: Prisma.TransactionClient,
) {
  if (amount <= 0) throw new Error("amount ต้องมากกว่า 0");
  const db = tx ?? prisma;
  return db.user.update({
    where: { id: userId },
    data: { [currency]: { increment: amount } },
    select: { id: true, [currency]: true },
  });
}

/** หักเงิน — กันติดลบด้วยการเช็คยอดก่อนใน transaction */
export async function spendCurrency(
  userId: string,
  currency: Currency,
  amount: number,
  tx?: Prisma.TransactionClient,
) {
  if (amount <= 0) throw new Error("amount ต้องมากกว่า 0");

  const run = async (db: Prisma.TransactionClient) => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { [currency]: true },
    });
    const have = (user as unknown as Record<Currency, number>)[currency];
    if (have < amount) throw new InsufficientFundsError(currency, have, amount);
    return db.user.update({
      where: { id: userId },
      data: { [currency]: { decrement: amount } },
      select: { id: true, [currency]: true },
    });
  };

  return tx ? run(tx) : prisma.$transaction(run);
}

export type ExpResult = { level: number; exp: number; levelsGained: number[] };

/**
 * คำนวณ level-up จาก EXP ที่ได้รับ (ต้องใช้ EXP = level ปัจจุบัน × 100 ต่อเลเวล ต้นทุนสะสมถึง
 * level N ≈ 50N(N-1) — กำลังสอง) เป็น pure function ไม่แตะ DB เพื่อให้ผู้เรียก (packs.ts/daily.ts)
 * ใช้ร่วมกันได้ภายใน transaction ของตัวเอง แทนก็อป while-loop ซ้ำ 3 ที่แบบเดิม
 * คืน levelsGained ทุกเลเวลที่ข้ามผ่าน (เผื่อ EXP ก้อนใหญ่ข้ามหลายเลเวลพร้อมกัน) ให้ผู้เรียกเอาไป
 * เทียบกับ LEVEL_MILESTONES เพื่อแจกรางวัลต่อเลเวล
 */
export function applyExp(level: number, exp: number, gained: number): ExpResult {
  exp += gained;
  const levelsGained: number[] = [];
  while (exp >= level * 100) {
    exp -= level * 100;
    level += 1;
    levelsGained.push(level);
  }
  return { level, exp, levelsGained };
}

export type LevelReward = { silver: number; gold: number; freePackId?: string };

/**
 * รางวัล level-up ตาม gdd.txt "ทุก Level ได้ Silver + Pack" (Cosmetic ยังไม่มีระบบรองรับ ข้ามไปก่อน):
 * ทุกเลเวล = Silver เพิ่มตามเลเวล, ทุก 5/10/25 เลเวล = แถมซองฟรี (เช็คจากสูงไปต่ำ เอาแค่ระดับเดียว
 * กันรางวัลซ้อนทับตอนหารลงตัวหลายเงื่อนไขพร้อมกัน เช่น level 25 หารด้วย 5 ลงตัวด้วย)
 */
export function levelReward(level: number): LevelReward {
  const silver = level * 20;
  if (level % 25 === 0) return { silver, gold: 10, freePackId: "royalprime" };
  if (level % 10 === 0) return { silver, gold: 5, freePackId: "evolution" };
  if (level % 5 === 0) return { silver, gold: 0, freePackId: "standard" };
  return { silver, gold: 0 };
}

/** โบนัส Gold ตอนเติมเงินจริงครั้งแรก (โปรโมชั่นเปิดตัวเกม) */
const FIRST_DEPOSIT_BONUS_RATE = 0.2;

/** mock deposit: แปลงเงินบาทเป็น Gold ตามอัตราที่กำหนด + โบนัส 20% ถ้าเป็นการเติมครั้งแรก */
export async function mockDeposit(userId: string, baht: number) {
  if (baht <= 0) throw new Error("จำนวนเงินต้องมากกว่า 0");
  const baseGold = Math.floor(baht * DEPOSIT_RATE_GOLD_PER_BAHT);
  if (baseGold <= 0) throw new Error("จำนวนเงินน้อยเกินไป");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { hasDeposited: true },
    });
    const isFirstDeposit = !user.hasDeposited;
    const bonusGold = isFirstDeposit ? Math.floor(baseGold * FIRST_DEPOSIT_BONUS_RATE) : 0;
    const gold = baseGold + bonusGold;

    await tx.user.update({
      where: { id: userId },
      data: { gold: { increment: gold }, hasDeposited: true },
    });

    return { baht, gold: baseGold, bonusGold, totalGold: gold, isFirstDeposit };
  });
}
