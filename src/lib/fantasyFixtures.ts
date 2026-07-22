// src/lib/fantasyFixtures.ts
import { prisma } from "@/lib/prisma";

export type Fixture = {
  id: string;
  homeClub: string;
  awayClub: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: Date | null;
  status: string;
};

/** ตารางแข่งของ Gameweek หนึ่ง — เรียงตามเวลาเตะ (แมตช์ที่ยังไม่ตั้งเวลาไปอยู่ท้ายสุด) */
export async function getFixtures(gameweekId: string): Promise<Fixture[]> {
  return prisma.match.findMany({
    where: { gameweekId },
    orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      homeClub: true,
      awayClub: true,
      homeScore: true,
      awayScore: true,
      kickoffAt: true,
      status: true,
    },
  });
}
