// src/lib/fantasyTotw.ts
// Team of the Week — คำนวณสดจาก PlayerMatchStat ของ Gameweek นั้น (ไม่ persist ตารางแยก) reuse scorePlayer
// เดิมจาก fantasyScoring.ts ตรงๆ ห้ามเขียนสูตรคะแนนซ้ำที่นี่
import { prisma } from "@/lib/prisma";
import { scorePlayer, type MatchStatLine } from "@/lib/fantasyScoring";
import { POSITION_GROUP, type Position } from "@/lib/constants";
import type { PositionGroup } from "@/lib/fantasyConfig";
import { FORMATIONS } from "@/lib/formations";

export type TotwPlayer = {
  playerId: string;
  name: string;
  club: string;
  group: PositionGroup;
  points: number;
  goals: number;
  assists: number;
  minutes: number;
};

export type TotwSlot = {
  slotIndex: number;
  pos: string;
  x: number;
  y: number;
  group: PositionGroup;
  player: TotwPlayer | null;
};

/** ทีมยอดเยี่ยมประจำ Gameweek แบบฟอร์เมชั่น 4-3-3 — เลือกผู้เล่นคะแนนสูงสุดของแต่ละกลุ่มตำแหน่ง (GK×1/DEF×4/MID×3/ATT×3)
 * ตำแหน่งไหนมีผู้เล่นไม่พอ ปล่อยช่องว่างไว้ (ไม่ error ไม่ดึงจากกลุ่มอื่นมาแทน) */
export async function getTeamOfTheWeek(gameweekId: string): Promise<TotwSlot[]> {
  // ONE query — join matches → stats → player ครั้งเดียว ไม่มี N+1
  const matches = await prisma.match.findMany({
    where: { gameweekId },
    include: {
      stats: {
        include: { player: { select: { id: true, name: true, club: true } } },
      },
    },
  });

  const acc = new Map<string, TotwPlayer>();
  for (const m of matches) {
    if (m.homeScore === null || m.awayScore === null) continue; // POSTPONED/CANCELLED ไม่มีสกอร์ ข้าม
    for (const s of m.stats) {
      // ใช้ positionGroup ที่ freeze ไว้ตอนแอดมินกรอกสถิติ (upsertPlayerStat) ห้าม derive จาก Player.position สด
      // ที่นี่ — re-import การ์ด (prisma/card-import.ts) แก้ Player.position ได้ จะทำให้ TOTW ย้อนหลังเพี้ยนถ้า derive สด
      const group = s.positionGroup as PositionGroup;
      const line: MatchStatLine = {
        playerId: s.playerId,
        minutes: s.minutes,
        goals: s.goals,
        assists: s.assists,
        yellow: s.yellow,
        red: s.red,
        ownGoals: s.ownGoals,
        goalsConceded: s.clubSide === "HOME" ? m.awayScore : m.homeScore,
      };
      const pts = scorePlayer(line, group);
      const cur = acc.get(s.playerId) ?? {
        playerId: s.playerId,
        name: s.player.name,
        club: s.player.club,
        group,
        points: 0,
        goals: 0,
        assists: 0,
        minutes: 0,
      };
      cur.points += pts; // sum ข้าม DGW (แมตช์เดียวกันในสัปดาห์เดียวกันมากกว่า 1 นัด)
      cur.goals += s.goals;
      cur.assists += s.assists;
      cur.minutes += s.minutes;
      acc.set(s.playerId, cur);
    }
  }

  const byGroup: Record<PositionGroup, TotwPlayer[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of acc.values()) byGroup[p.group].push(p);
  for (const group of Object.keys(byGroup) as PositionGroup[]) {
    byGroup[group].sort(
      (a, b) =>
        b.points - a.points ||
        b.goals - a.goals ||
        b.assists - a.assists ||
        b.minutes - a.minutes ||
        a.playerId.localeCompare(b.playerId), // tie-break สุดท้าย กัน order ไม่ deterministic
    );
  }

  const picked: Record<PositionGroup, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  return FORMATIONS["4-3-3"].map((slot, i) => {
    const group = POSITION_GROUP[slot.pos as Position];
    const player = byGroup[group][picked[group]++] ?? null;
    return { slotIndex: i, pos: slot.pos, x: slot.x, y: slot.y, group, player };
  });
}
