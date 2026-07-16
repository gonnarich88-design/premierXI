import { prisma } from "@/lib/prisma";
import { grantFreePack, type OpenedCard } from "@/lib/packs";

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

/** milestone แจกซองพิเศษฟรีครั้งเดียว ตอน login สะสมครบ (นับจาก totalLogins ไม่ใช่ streak — ไม่ต้องติดต่อกัน) */
export const LOGIN_MILESTONES = {
  evolution: { totalLogins: 15, field: "evoMilestoneClaimed" as const, packId: "evolution" },
  royalprime: { totalLogins: 30, field: "primeMilestoneClaimed" as const, packId: "royalprime" },
};

/** รางวัลตาม streak (รอบ 7 วัน + โบนัสทุก 30 วัน)
 * วันที่ 7 ได้ silver bonus ก้อนใหญ่แทน Pack Ticket เดิม (ยกเลิก Ticket Pack แล้ว) + gold เล็กน้อยให้สาย F2P ค่อยๆสะสมไปเปิด Evolution/Royal Prime ได้
 * calibrate ให้เปิด Standard Pack (300 silver) ได้ประมาณ 1 ครั้งทุก 1-1.5 วันถ้า login ต่อเนื่อง
 */
export function rewardForStreak(streak: number): DailyReward {
  const day = ((streak - 1) % 7) + 1;
  return {
    day,
    silver: 100 + day * 30 + (day === 7 ? 300 : 0),
    exp: 30,
    packTicket: 0,
    gold: (day === 7 ? 2 : 0) + (streak % 30 === 0 ? 5 : 0),
  };
}

export type DailyStatus = {
  canClaim: boolean;
  streak: number;
  nextStreak: number;
  nextReward: DailyReward;
  totalLogins: number;
};

export async function getDailyStatus(userId: string): Promise<DailyStatus> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { loginStreak: true, lastClaimDate: true, totalLogins: true },
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
    totalLogins: user.totalLogins,
  };
}

export type MilestoneReward = {
  packId: string;
  cards: OpenedCard[];
};

export type ClaimResult =
  | {
      ok: true;
      reward: DailyReward;
      streak: number;
      leveledUp: boolean;
      level: number;
      milestone?: MilestoneReward;
    }
  | { ok: false; error: string };

export async function claimDaily(userId: string): Promise<ClaimResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        loginStreak: true,
        lastClaimDate: true,
        level: true,
        exp: true,
        totalLogins: true,
        evoMilestoneClaimed: true,
        primeMilestoneClaimed: true,
      },
    });

    const now = new Date();
    const today = dayIndex(now);
    const last = user.lastClaimDate ? dayIndex(user.lastClaimDate) : null;

    if (last === today) return { ok: false, error: "วันนี้รับไปแล้ว" };

    const streak = last === today - 1 ? user.loginStreak + 1 : 1;
    const reward = rewardForStreak(streak);
    const totalLogins = user.totalLogins + 1;

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
        totalLogins,
        level,
        exp,
      },
    });

    // launch promotion: login สะสมครบ 15/30 วัน (ครั้งเดียวตลอดไป ไม่วนซ้ำ)
    let milestone: MilestoneReward | undefined;
    for (const m of Object.values(LOGIN_MILESTONES)) {
      const alreadyClaimed = m.field === "evoMilestoneClaimed" ? user.evoMilestoneClaimed : user.primeMilestoneClaimed;
      if (!alreadyClaimed && totalLogins >= m.totalLogins) {
        const result = await grantFreePack(tx, userId, m.packId);
        await tx.user.update({ where: { id: userId }, data: { [m.field]: true } });
        milestone = { packId: m.packId, cards: result.cards };
        break; // totalLogins เพิ่มทีละ 1 ต่อครั้ง เลยชนได้ milestone เดียวต่อการ claim
      }
    }

    return { ok: true, reward, streak, leveledUp: level > user.level, level, milestone };
  });
}
