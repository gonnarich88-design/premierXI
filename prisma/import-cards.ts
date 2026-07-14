/**
 * Import การ์ดจริงจากรูปใน public/card/<category>/<team>/*.png
 * ใช้ข้อมูลที่ดึงจากรูป (vision) ในไฟล์ data/extracted/<team>.json
 *
 * รูปแบบ data/extracted/<team>.json:
 * {
 *   "team": "fulham",
 *   "cards": [
 *     { "file": "Andersen.png", "ovr": 79, "position": "GK",
 *       "altPositions": [], "nation": "Denmark", "foot": "R",
 *       "skillMoves": 1, "weakFoot": 3, "indexRating": 71.2 }
 *   ]
 * }
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { clubFromFolder } from "../src/lib/clubs";
import { deriveTier, generateStats } from "../src/lib/cardgen";
import { POSITIONS } from "../src/lib/constants";

const prisma = new PrismaClient();
const CATEGORY = "normal";
const CARDS_DIR = join(process.cwd(), "public", "card", CATEGORY);
const EXTRACT_DIR = join(process.cwd(), "data", "extracted");

type Extracted = {
  file: string;
  ovr: number;
  position: string;
  altPositions?: string[];
  nation?: string;
  foot?: string;
  skillMoves?: number;
  weakFoot?: number;
  indexRating?: number;
};

const validPos = new Set<string>(POSITIONS);

async function main() {
  const teams = readdirSync(CARDS_DIR).filter((d) =>
    existsSync(join(CARDS_DIR, d)) &&
    readdirSync(join(CARDS_DIR, d)).length >= 0 &&
    !d.startsWith("."),
  );

  // reset catalog (pre-launch — ยังไม่มีผู้ใช้จริง)
  await prisma.userCard.deleteMany();
  await prisma.card.deleteMany();
  await prisma.player.deleteMany();

  let imported = 0;
  const warnings: string[] = [];
  const skippedTeams: string[] = [];

  for (const team of teams) {
    const jsonPath = join(EXTRACT_DIR, `${team}.json`);
    if (!existsSync(jsonPath)) {
      skippedTeams.push(team);
      continue;
    }
    const parsed = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const rows: Extracted[] = parsed.cards ?? [];
    const byFile = new Map(rows.map((r) => [r.file, r]));
    const club = clubFromFolder(team);

    const files = readdirSync(join(CARDS_DIR, team)).filter((f) =>
      f.toLowerCase().endsWith(".png"),
    );

    for (const file of files) {
      const data = byFile.get(file);
      if (!data) {
        warnings.push(`${team}/${file}: ไม่มีข้อมูลใน extract`);
        continue;
      }
      const name = file.replace(/\.png$/i, "");
      const ovr = Number(data.ovr);
      let position = String(data.position || "").toUpperCase();
      if (!validPos.has(position)) {
        warnings.push(`${team}/${file}: ตำแหน่ง "${position}" ไม่รู้จัก → CM`);
        position = "CM";
      }
      if (!Number.isFinite(ovr) || ovr < 40 || ovr > 99) {
        warnings.push(`${team}/${file}: OVR ผิดปกติ (${data.ovr}) → ข้าม`);
        continue;
      }

      const stats = generateStats(ovr, position);
      const nation = data.nation?.trim() || "Unknown";

      // upsert player by name+club
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
          tier: deriveTier(ovr),
          category: CATEGORY,
          position,
          ovr,
          ...stats,
          altPositions:
            data.altPositions && data.altPositions.length
              ? data.altPositions.join(",")
              : null,
          foot: data.foot ?? null,
          skillMoves: data.skillMoves ?? null,
          weakFoot: data.weakFoot ?? null,
          indexRating: data.indexRating ?? null,
          imageUrl: `/card/${CATEGORY}/${team}/${file}`,
        },
      });
      imported++;
    }
  }

  console.log(`\n=== Import เสร็จ ===`);
  console.log(`การ์ดที่ import: ${imported}`);
  if (skippedTeams.length)
    console.log(`ทีมที่ยังไม่มี extract json (${skippedTeams.length}): ${skippedTeams.join(", ")}`);
  if (warnings.length) {
    console.log(`\nคำเตือน (${warnings.length}):`);
    warnings.slice(0, 30).forEach((w) => console.log("  - " + w));
    if (warnings.length > 30) console.log(`  ... อีก ${warnings.length - 30} รายการ`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
