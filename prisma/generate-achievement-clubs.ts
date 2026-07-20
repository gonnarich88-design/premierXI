/**
 * Generate frozen club-collection snapshot สำหรับ Achievement ระบบ "สะสมครบทีม"
 *
 * Query Player group by club, ตัดสโมสรที่มีนักเตะคนเดียว (ข้อมูล seed ไม่ครบ — ดู Non-goals),
 * แบ่ง tier small (<=25 คน) / large (>25 คน) ตามสเปค, เขียนผลลัพธ์ไปที่
 * data/achievements/club-collection.json — ไฟล์นี้คือ single source of truth ของ target แต่ละสโมสร
 * (ห้าม achievementConfig.ts คำนวณ target สดจาก COUNT(*) ของ Player — ดู
 * docs/superpowers/specs/2026-07-20-achievement-collection-design.md หัวข้อ 3)
 *
 * รันครั้งแรกตอน implement ระบบนี้ (npm run db:generate-achievement-clubs) — รันซ้ำได้ในอนาคต
 * แบบตั้งใจถ้ามีสโมสร/นักเตะเพิ่ม (ไม่ใช่ auto-run ทุกครั้งที่ deploy)
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const OUTPUT_DIR = join(process.cwd(), "data", "achievements");
const OUTPUT_PATH = join(OUTPUT_DIR, "club-collection.json");
const MIN_CLUB_SIZE = 2; // ตัดสโมสรที่มีนักเตะคนเดียวออก (West Ham United/Leicester City/Burnley — ดู Non-goals)
const SMALL_TIER_MAX = 25; // small: <=25 คน, large: >25 คน (ดูสเปคหัวข้อ 3)

function slugifyClub(clubName: string): string {
  return (
    "club_" +
    clubName
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

async function main() {
  const players = await prisma.player.findMany({ select: { id: true, club: true } });

  const byClub = new Map<string, string[]>();
  for (const p of players) {
    const arr = byClub.get(p.club) ?? [];
    arr.push(p.id);
    byClub.set(p.club, arr);
  }

  const included = [...byClub.entries()].filter(([, playerIds]) => playerIds.length >= MIN_CLUB_SIZE);
  const excluded = [...byClub.entries()].filter(([, playerIds]) => playerIds.length < MIN_CLUB_SIZE);

  const clubs = included
    .map(([clubName, playerIds]) => ({
      key: slugifyClub(clubName),
      clubName,
      playerIds,
      size: playerIds.length,
      tier: playerIds.length <= SMALL_TIER_MAX ? ("small" as const) : ("large" as const),
    }))
    .sort((a, b) => a.size - b.size);

  console.log(`ตัดสโมสรที่มีนักเตะน้อยกว่า ${MIN_CLUB_SIZE} คนออก (${excluded.length} สโมสร):`);
  for (const [clubName, ids] of excluded) console.log(`  - ${clubName}: ${ids.length} คน`);

  console.log(`\nรวม ${clubs.length} สโมสรเข้า achievement catalog:`);
  for (const c of clubs) console.log(`  - ${c.key} (${c.clubName}): ${c.size} คน [${c.tier}]`);

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify({ clubs }, null, 2) + "\n", "utf-8");
  console.log(`\nเขียนไฟล์: ${OUTPUT_PATH}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
