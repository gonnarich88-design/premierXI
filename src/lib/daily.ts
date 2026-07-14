import { prisma } from "@/lib/prisma";

// index วันแบบ UTC (จำนวนวันนับจาก epoch) ใช้เทียบว่าวันเดียวกัน/วันต่อกันไหม
function dayIndex(d: Date): number {
  return Math.floor(d.getTime() / 86_400_000);
}

export type DailyReward = {
  day: number; // วันในรอบ 1-7
  silver: number;
  exp: number;
  packTicket: number;
  gold: number;
};

/** รางวัลตาม streak (รอบ 7 วัน + โบนัสทุก 30 วัน) */
export function rewardForStreak(streak: number): DailyReward {
  const day = ((streak - 1) % 7) + 1;
  return {
    day,
    silver: 100 + day * 30,
    exp: 30,
    packTicket: day === 7 ? 1 : 0,
    gold: streak % 30 === 0 ? 5 : 0,
  };
}

export type DailyStatus = {
  canClaim: boolean;
  streak: number;
  nextStreak: number;
  nextReward: DailyReward;
};

export async function getDailyStatus(userId: string): Promise<DailyStatus> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { loginStreak: true, lastClaimDate: true },
  });

  const today = dayIndex(new Date());
  const last = user.lastClaimDate ? dayIndex(user.lastClaimDate) : null;
  const canClaim = last !== today;
  const nextStreak = last === today - 1 ? user.loginStreak + 1 : 1;

  return {
    canClaim,
    streak: user.loginStreak,
    nextStreak,
    nextReward: rewardForStreak(canClaim ? nextStreak : user.loginStreak + 1),
  };
}

export type ClaimResult =
  | { ok: true; reward: DailyReward; streak: number }
  | { ok: false; error: string };

export async function claimDaily(userId: string): Promise<ClaimResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { loginStreak: true, lastClaimDate: true, level: true, exp: true },
    });

    const now = new Date();
    const today = dayIndex(now);
    const last = user.lastClaimDate ? dayIndex(user.lastClaimDate) : null;

    if (last === today) return { ok: false, error: "วันนี้รับไปแล้ว" };

    const streak = last === today - 1 ? user.loginStreak + 1 : 1;
    const reward = rewardForStreak(streak);

    // exp + level up
    let level = user.level;
    let exp = user.exp + reward.exp;
    while (exp >= level * 100) {
      exp -= level * 100;
      level += 1;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        silver: { increment: reward.silver },
        packTicket: { increment: reward.packTicket },
        gold: { increment: reward.gold },
        loginStreak: streak,
        lastClaimDate: now,
        level,
        exp,
      },
    });

    return { ok: true, reward, streak };
  });
}
