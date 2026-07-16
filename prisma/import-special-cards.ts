/**
 * Import การ์ดพิเศษ (Evolution / Royal Prime) จากรูปใน public/card/<category>/*.png
 * ใช้ข้อมูลที่ดึงจากรูป (vision) ในไฟล์ data/extracted/<category>.json
 *
 * ต่างจาก import-cards.ts (normal, แยกโฟลเดอร์ทีม) ตรงที่:
 * - ไม่มีโฟลเดอร์ทีมย่อย รูปอยู่ตรงกับ category เลย
 * - extracted json มี club/nation ต่อการ์ดโดยตรง (ไม่ derive จากชื่อโฟลเดอร์)
 * - ไม่ลบข้อมูลทั้งฐาน ลบเฉพาะการ์ด category นี้ก่อน reimport (กันซ้ำตอนรันหลายครั้ง)
 *
 * รูปแบบ data/extracted/<category>.json:
 * {
 *   "category": "evolution",
 *   "cards": [
 *     { "file": "Haaland.png", "ovr": 92, "position": "ST", "altPositions": [],
 *       "foot": "L", "skillMoves": 3, "weakFoot": 3, "indexRating": 83.7,
 *       "nation": "Norway", "club": "Manchester City" }
 *   ]
 * }
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { generateStats } from "../src/lib/cardgen";
import { POSITIONS } from "../src/lib/constants";

const prisma = new PrismaClient();
const EXTRACT_DIR = join(process.cwd(), "data", "extracted");

type Extracted = {
  file: string;
  ovr: number;
  position: string;
  altPositions?: string[];
  nation?: string;
  club: string;
  foot?: string;
  skillMoves?: number;
  weakFoot?: number;
  indexRating?: number | null;
};

const CATEGORIES: { category: string; tier: string }[] = [
  { category: "evolution", tier: "Hero" },
  { category: "royalprime", tier: "Legend" },
];

const validPos = new Set<string>(POSITIONS);

async function importCategory(category: string, tier: string) {
  const cardsDir = join(process.cwd(), "public", "card", category);
  const jsonPath = join(EXTRACT_DIR, `${category}.json`);

  if (!existsSync(cardsDir) || !existsSync(jsonPath)) {
    console.log(`ข้าม ${category}: ไม่พบโฟลเดอร์รูปหรือ extract json`);
    return { imported: 0, warnings: [] as string[] };
  }

  const parsed = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const rows: Extracted[] = parsed.cards ?? [];
  const byFile = new Map(rows.map((r) => [r.file, r]));

  const files = readdirSync(cardsDir).filter((f) => f.toLowerCase().endsWith(".png"));

  // reimport แบบ idempotent: ลบเฉพาะการ์ด category นี้ก่อน (ไม่แตะ normal หรือ category อื่น)
  await prisma.userCard.deleteMany({ where: { card: { category } } });
  await prisma.card.deleteMany({ where: { category } });

  let imported = 0;
  const warnings: string[] = [];

  for (const file of files) {
    const data = byFile.get(file);
    if (!data) {
      warnings.push(`${category}/${file}: ไม่มีข้อมูลใน extract`);
      continue;
    }
    const name = file.replace(/\.png$/i, "");
    const ovr = Number(data.ovr);
    let position = String(data.position || "").toUpperCase();
    if (!validPos.has(position)) {
      warnings.push(`${category}/${file}: ตำแหน่ง "${position}" ไม่รู้จัก → CM`);
      position = "CM";
    }
    if (!Number.isFinite(ovr) || ovr < 40 || ovr > 99) {
      warnings.push(`${category}/${file}: OVR ผิดปกติ (${data.ovr}) → ข้าม`);
      continue;
    }
    const club = data.club?.trim();
    if (!club) {
      warnings.push(`${category}/${file}: ไม่มีสโมสร → ข้าม`);
      continue;
    }

    const stats = generateStats(ovr, position);
    const nation = data.nation?.trim() || "Unknown";

    // upsert player by name+club (ใช้ player ตัวเดียวกับที่มีอยู่แล้วถ้าเคย import จาก normal/category อื่น)
    let player = await prisma.player.findFirst({
      where: { name, club },
      select: { id: true },
    });
    if (!player) {
      player = await prisma.player.create({
        data: { name, club, nation, position },
        select: { id: true },
      });
    }

    await prisma.card.create({
      data: {
        playerId: player.id,
        tier,
        category,
        position,
        ovr,
        ...stats,
        altPositions:
          data.altPositions && data.altPositions.length ? data.altPositions.join(",") : null,
        foot: data.foot ?? null,
        skillMoves: data.skillMoves ?? null,
        weakFoot: data.weakFoot ?? null,
        indexRating: data.indexRating ?? null,
        imageUrl: `/card/${category}/${file}`,
      },
    });
    imported++;
  }

  return { imported, warnings };
}

async function main() {
  let total = 0;
  const allWarnings: string[] = [];

  for (const { category, tier } of CATEGORIES) {
    const { imported, warnings } = await importCategory(category, tier);
    console.log(`${category}: import ${imported} การ์ด (tier ${tier})`);
    total += imported;
    allWarnings.push(...warnings);
  }

  console.log(`\n=== Import การ์ดพิเศษเสร็จ ===`);
  console.log(`รวมทั้งหมด: ${total} การ์ด`);
  if (allWarnings.length) {
    console.log(`\nคำเตือน (${allWarnings.length}):`);
    allWarnings.forEach((w) => console.log("  - " + w));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
