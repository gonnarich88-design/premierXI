import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/lib/constants";
import type { LevelUpReward, OpenedCard } from "@/lib/packs";

const PACK_NAMES: Record<string, string> = {
  standard: "Standard Pack",
  evolution: "Evolution Pack",
  royalprime: "Royal Prime Pack",
};

/** แจ้งเตือน level-up พร้อมรางวัลที่ได้ (silver/gold ทุกเลเวล + ซองฟรีถ้าถึง milestone 5/10/25) */
export async function notifyLevelRewards(
  userId: string,
  level: number,
  levelRewards: LevelUpReward[],
): Promise<void> {
  const totalSilver = levelRewards.reduce((sum, r) => sum + r.silver, 0);
  const totalGold = levelRewards.reduce((sum, r) => sum + r.gold, 0);

  const parts = [`+${totalSilver} Silver`];
  if (totalGold) parts.push(`+${totalGold} Gold`);
  for (const r of levelRewards) {
    if (r.pack) parts.push(`ได้ ${PACK_NAMES[r.pack.packId] ?? r.pack.packId} ฟรี 🎁`);
  }

  await createNotification({
    userId,
    type: "LEVEL_UP",
    title: `เลเวลอัพเป็น Lv.${level}!`,
    body: parts.join(" · "),
    href: "/profile",
  });
}

/** แจ้งเตือนเคลมมิชชั่นสำเร็จ — silver/EXP เสมอ + ซองฟรีถ้ามี (เช่น weekly_login5) */
export async function notifyMissionClaimed(
  userId: string,
  missionLabel: string,
  reward: { silver: number; exp: number },
  pack?: { packId: string; cards: OpenedCard[] },
): Promise<void> {
  const parts = [`+${reward.silver} Silver`];
  if (reward.exp) parts.push(`+${reward.exp} EXP`);
  if (pack) parts.push(`ได้ ${PACK_NAMES[pack.packId] ?? pack.packId} ฟรี`);

  await createNotification({
    userId,
    type: "MISSION_CLAIMED",
    title: `เคลมมิชชั่นสำเร็จ: ${missionLabel}`,
    body: parts.join(" · "),
    href: "/",
  });
}

/**
 * สร้างการแจ้งเตือนส่วนตัว — best-effort: ถ้า write พังจะไม่ throw
 * (ไม่ให้ noti ล้มไปทำให้ flow หลัก เช่น เปิดซอง/รับรางวัล พังตาม)
 */
export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
      },
    });
  } catch (e) {
    console.error("createNotification failed", e);
  }
}

/** จำนวนที่ยังไม่อ่าน = noti ส่วนตัวที่ยังไม่อ่าน + ข่าวที่ใหม่กว่าเวลาอ่านล่าสุด */
export async function getUnreadCount(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastReadNewsAt: true },
  });
  const since = user?.lastReadNewsAt ?? new Date(0);

  const [unreadNotifs, unreadNews] = await Promise.all([
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.announcement.count({
      where: { published: true, createdAt: { gt: since } },
    }),
  ]);
  return unreadNotifs + unreadNews;
}

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: Date;
};

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  isNew: boolean;
};

/** ดึงข้อมูลหน้า Notification Center (ข่าว + กิจกรรม) */
export async function getNotificationCenter(userId: string): Promise<{
  news: NewsItem[];
  notifications: NotificationItem[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastReadNewsAt: true },
  });
  const since = user?.lastReadNewsAt ?? new Date(0);

  const [news, notifications] = await Promise.all([
    prisma.announcement.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    news: news.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
      isNew: n.createdAt > since,
    })),
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      read: n.read,
      createdAt: n.createdAt,
    })),
  };
}

/** ทำเครื่องหมายว่าอ่านแล้วทั้งหมด (noti ส่วนตัว + ข่าว) */
export async function markAllRead(userId: string): Promise<void> {
  await Promise.all([
    prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { lastReadNewsAt: new Date() },
    }),
  ]);
}
