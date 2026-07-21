// src/lib/fantasyAdmin.ts
// DB service สำหรับ admin กรอกผลบอล — ทุก mutation เช็ค Gameweek status ก่อนเขียนเสมอ (แก้ผลย้อนหลังหลังปิดไม่ได้)
// ดู docs/superpowers/specs/2026-07-20-fantasy-design.md หัวข้อ 8-9
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seasonKey } from "@/lib/pvp";
import { GAMEWEEK_STATUS } from "@/lib/fantasyConfig";

function assertNotScoredYet(status: string): void {
  if (status === GAMEWEEK_STATUS.SCORING || status === GAMEWEEK_STATUS.SCORED) {
    throw new Error("Gameweek นี้ปิดคิดคะแนนแล้ว แก้ข้อมูลไม่ได้");
  }
}

/** สร้าง Gameweek ใหม่ — monthKey freeze จาก deadline แบบ UTC ตอนสร้าง (ห้าม derive จากวันที่ปิดทีหลัง — สเปคหัวข้อ 10) */
export async function createGameweek(number: number, deadline: Date): Promise<{ id: string }> {
  if (!Number.isInteger(number) || number <= 0) throw new Error("หมายเลข Gameweek ต้องเป็นจำนวนเต็มบวก");
  const monthKey = seasonKey(deadline);
  try {
    return await prisma.gameweek.create({ data: { number, deadline, monthKey }, select: { id: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(`Gameweek หมายเลข ${number} มีอยู่แล้ว`);
    }
    throw err;
  }
}

export type MatchInput = {
  id?: string;
  homeClub: string;
  awayClub: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: Date | null;
  status: "SCHEDULED" | "PLAYED" | "POSTPONED" | "CANCELLED";
};

/** สร้าง/แก้แมตช์ในทีเดียว (id ไม่ระบุ = สร้างใหม่) — validate เหย้า≠เยือน, สกอร์ไม่ติดลบ, ห้าม 0-0 แทนเลื่อน/ยกเลิก
 *
 * เช็ค Gameweek status + เขียนจริงต้องอยู่ใน `prisma.$transaction` เดียวกัน (อ่าน status สดอีกครั้งใน tx ทันทีก่อน
 * write) ไม่ใช่อ่านแยกจากเขียน — ไม่งั้นมี TOCTOU race กับ `closeGameweek`'s CAS: `closeGameweek` เปลี่ยนสถานะเป็น
 * SCORING พอดีหลัง `assertNotScoredYet` เช็คผ่านตรงนี้ แต่ก่อน write จริง จะทำให้ค่าที่ `runScoring` อ่านไปคำนวณ
 * คะแนนแล้วเปลี่ยนกลางทาง (เหมือน `saveEntry`'s deadline race ที่แก้ไปแล้วใน 7A — ใช้ pattern เดียวกัน) */
export async function upsertMatch(gameweekId: string, input: MatchInput): Promise<{ id: string }> {
  if (input.homeClub === input.awayClub) throw new Error("ทีมเหย้ากับทีมเยือนต้องไม่ใช่ทีมเดียวกัน");
  if (input.homeScore !== null && (!Number.isInteger(input.homeScore) || input.homeScore < 0)) {
    throw new Error("สกอร์ทีมเหย้าต้องเป็นจำนวนเต็มไม่ติดลบ");
  }
  if (input.awayScore !== null && (!Number.isInteger(input.awayScore) || input.awayScore < 0)) {
    throw new Error("สกอร์ทีมเยือนต้องเป็นจำนวนเต็มไม่ติดลบ");
  }
  if ((input.status === "POSTPONED" || input.status === "CANCELLED") && (input.homeScore !== null || input.awayScore !== null)) {
    throw new Error("แมตช์ที่เลื่อน/ยกเลิกต้องไม่มีสกอร์ (ห้ามใช้ 0-0 แทน)");
  }

  const data = {
    gameweekId,
    homeClub: input.homeClub,
    awayClub: input.awayClub,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    kickoffAt: input.kickoffAt,
    status: input.status,
  };

  return prisma.$transaction(async (tx) => {
    const gameweek = await tx.gameweek.findUnique({ where: { id: gameweekId }, select: { status: true } });
    if (!gameweek) throw new Error("ไม่พบ Gameweek นี้");
    assertNotScoredYet(gameweek.status);

    if (input.id) {
      const existing = await tx.match.findUnique({ where: { id: input.id }, select: { gameweekId: true } });
      if (!existing || existing.gameweekId !== gameweekId) throw new Error("ไม่พบแมตช์นี้ใน Gameweek ที่ระบุ");
      return tx.match.update({ where: { id: input.id }, data, select: { id: true } });
    }
    return tx.match.create({ data, select: { id: true } });
  });
}

export type GameweekAdminRow = {
  id: string;
  number: number;
  deadline: Date;
  monthKey: string;
  status: string;
  matchCount: number;
  entryCount: number;
};

export async function listGameweeksForAdmin(): Promise<GameweekAdminRow[]> {
  const rows = await prisma.gameweek.findMany({
    orderBy: { number: "desc" },
    select: {
      id: true,
      number: true,
      deadline: true,
      monthKey: true,
      status: true,
      _count: { select: { matches: true, entries: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    deadline: r.deadline,
    monthKey: r.monthKey,
    status: r.status,
    matchCount: r._count.matches,
    entryCount: r._count.entries,
  }));
}

export async function getGameweekAdminDetail(gameweekId: string) {
  return prisma.gameweek.findUnique({
    where: { id: gameweekId },
    include: {
      matches: {
        orderBy: { kickoffAt: "asc" },
        include: { stats: { include: { player: true }, orderBy: { player: { name: "asc" } } } },
      },
    },
  });
}
export type GameweekAdminDetail = NonNullable<Awaited<ReturnType<typeof getGameweekAdminDetail>>>;
