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

/** ให้ EXP แล้วเลื่อน level อัตโนมัติ (ต้องใช้ EXP = level * 100 ต่อเลเวล) */
export async function grantExp(userId: string, amount: number) {
  if (amount <= 0) throw new Error("amount ต้องมากกว่า 0");
  return prisma.$transaction(async (db) => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { level: true, exp: true },
    });
    let { level, exp } = user;
    exp += amount;
    while (exp >= level * 100) {
      exp -= level * 100;
      level += 1;
    }
    return db.user.update({
      where: { id: userId },
      data: { level, exp },
      select: { id: true, level: true, exp: true },
    });
  });
}

/** mock deposit: แปลงเงินบาทเป็น Gold ตามอัตราที่กำหนด */
export async function mockDeposit(userId: string, baht: number) {
  if (baht <= 0) throw new Error("จำนวนเงินต้องมากกว่า 0");
  const gold = Math.floor(baht * DEPOSIT_RATE_GOLD_PER_BAHT);
  if (gold <= 0) throw new Error("จำนวนเงินน้อยเกินไป");
  await addCurrency(userId, "gold", gold);
  return { baht, gold };
}
