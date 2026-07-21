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
 *
 * Upsert ตาม stable identity (Player: name+club, Card: playerId+category — ดู prisma/card-import.ts) แทนการ
 * ลบ catalog ทั้งชุดแล้วสร้างใหม่ — กัน UserCard/FantasyEntrySlot ของผู้ใช้จริงห้อยลอยหรือถูกถอดทิ้งเงียบๆ ทุกครั้งที่
 * reimport ทั้งไฟล์ทำงานเป็น transaction เดียว (อ่าน/validate ทั้งหมดก่อน แล้วเขียนทีเดียว) rollback ได้เต็มถ้าล้มกลางทาง
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { clubFromFolder } from "../src/lib/clubs";
import { deriveTier } from "../src/lib/cardgen";
import { POSITIONS } from "../src/lib/constants";
import { importCardCatalog, findDuplicateIdentities, type CardImportRow } from "./card-import";

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

export type TeamCollectResult =
  | { skipped: true }
  | { skipped: false; rows: CardImportRow[]; warnings: string[]; complete: boolean };

/** รวมรายชื่อทีมจากทั้งสองฝั่ง: โฟลเดอร์รูปจริง (public/card/normal/<team>) และ extract json (data/extracted/<team>.json
 * ที่มี field "team") — ถ้าใช้แค่ readdirSync(cardsDir) ฝั่งเดียว ทีมที่ extract json ยังอยู่แต่โฟลเดอร์รูปหายไปทั้งก้อน
 * (เช่น deploy ไม่ครบ) จะไม่ถูกเห็นเลย แล้ว sourceComplete จะเข้าใจผิดว่า source ครบ ทำให้การ์ดทีมนั้นถูกมองว่าถอดจริง */
export function discoverTeams(cardsDir: string, extractDir: string): string[] {
  const dirTeams = existsSync(cardsDir)
    ? readdirSync(cardsDir).filter((d) => !d.startsWith(".") && existsSync(join(cardsDir, d)))
    : [];

  // parse failure ห้ามเงียบ (return false) เด็ดขาด — ถ้าทีมนั้นบังเอิญไม่มีโฟลเดอร์รูปด้วย จะไม่ถูก discover
  // เลยทั้ง 2 ทาง แล้ว sourceComplete จะเข้าใจผิดว่าครบ จึงต้อง throw ยกเลิกทั้ง import แทนที่จะข้ามไฟล์นั้นเงียบๆ
  const extractTeams = existsSync(extractDir)
    ? readdirSync(extractDir)
        .filter((f) => f.toLowerCase().endsWith(".json"))
        .map((f) => f.replace(/\.json$/i, ""))
        .filter((name) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(readFileSync(join(extractDir, `${name}.json`), "utf-8"));
          } catch (e) {
            throw new Error(
              `ยกเลิก import: อ่าน/parse extract json ไม่ได้ (${name}.json): ${e instanceof Error ? e.message : e}`,
            );
          }
          return typeof (parsed as { team?: unknown }).team === "string" && (parsed as { team: string }).team.length > 0;
        })
    : [];

  return [...new Set([...dirTeams, ...extractTeams])].sort();
}

/** อ่านและ validate การ์ดของทีมเดียว (pure — ไม่แตะ DB) รับ cardsDir/extractDir เป็น parameter เพื่อ unit test ได้
 * โดยไม่ต้องพึ่ง public/card จริง — `complete: false` = ห้ามรัน stale-removal ของ scope 'normal' ทั้งก้อนรอบนี้ */
export function collectTeamRows(cardsDir: string, extractDir: string, team: string): TeamCollectResult {
  const jsonPath = join(extractDir, `${team}.json`);
  if (!existsSync(jsonPath)) return { skipped: true };

  const parsed = JSON.parse(readFileSync(jsonPath, "utf-8"));
  // "cards" ต้องเป็น array จริง — ต่างจาก `?? []` เดิมที่ทำให้ extract ที่ผิดรูป (เช่น field หาย/พิมพ์ผิด) กลาย
  // เป็น "ทีมนี้มีการ์ด 0 ใบ ยืนยันแล้ว" เงียบๆ ซึ่งถ้าทีมนั้นไม่มี PNG ด้วย (หรือ PNG ทุกใบชนกับข้อผิดพลาดเดิม)
  // จะดู "ครบ" ทั้งที่จริงคือไฟล์เสีย ไม่ใช่ทีมว่างจริง — ต้อง fail closed แยกสองเคสนี้ออกจากกัน
  if (!Array.isArray(parsed.cards)) {
    return {
      skipped: false,
      rows: [],
      warnings: [`${team}: extract json ไม่มี field "cards" เป็น array ที่ถูกต้อง`],
      complete: false,
    };
  }
  const extractedRows: Extracted[] = parsed.cards;
  const byFile = new Map(extractedRows.map((r) => [r.file, r]));
  const club = clubFromFolder(team);

  const teamDir = join(cardsDir, team);
  if (!existsSync(teamDir)) {
    return {
      skipped: false,
      rows: [],
      warnings: [`${team}: มี extract json แต่ไม่พบโฟลเดอร์รูปทีม`],
      complete: false,
    };
  }

  const files = readdirSync(teamDir).filter((f) => f.toLowerCase().endsWith(".png"));
  const fileSet = new Set(files);

  const rows: CardImportRow[] = [];
  const warnings: string[] = [];
  let complete = true;

  // เช็คสองทิศทาง: extract มีแถวไหนที่ไม่มีไฟล์ PNG จริงรองรับ (รูปหาย/ลบทิ้งแต่ extract ไม่ได้อัปเดต) ก็ถือว่า
  // source ไม่ครบเหมือนกัน ไม่งั้น card เดิมของนักเตะคนนั้นจะถูกมองว่า "ถอดจริง" ทั้งที่แค่รูปหายจาก deploy
  for (const row of extractedRows) {
    if (!fileSet.has(row.file)) {
      warnings.push(`${team}/${row.file}: มีข้อมูลใน extract แต่ไม่พบไฟล์รูป`);
      complete = false;
    }
  }

  for (const file of files) {
    const data = byFile.get(file);
    if (!data) {
      warnings.push(`${team}/${file}: ไม่มีข้อมูลใน extract`);
      complete = false;
      continue;
    }
    const name = file.replace(/\.png$/i, "");
    const ovr = Number(data.ovr);
    let position = String(data.position || "").toUpperCase();
    if (!validPos.has(position)) {
      // fallback ตำแหน่งไม่รู้จัก → CM ยังคงสร้าง row ได้ปกติ ไม่ใช่การข้ามการ์ด จึงไม่กระทบ complete
      warnings.push(`${team}/${file}: ตำแหน่ง "${position}" ไม่รู้จัก → CM`);
      position = "CM";
    }
    if (!Number.isFinite(ovr) || ovr < 40 || ovr > 99) {
      warnings.push(`${team}/${file}: OVR ผิดปกติ (${data.ovr}) → ข้าม`);
      complete = false;
      continue;
    }

    rows.push({
      name,
      club,
      category: CATEGORY,
      tier: deriveTier(ovr),
      nation: data.nation?.trim() || "Unknown",
      position,
      ovr,
      altPositions: data.altPositions && data.altPositions.length ? data.altPositions.join(",") : null,
      foot: data.foot ?? null,
      skillMoves: data.skillMoves ?? null,
      weakFoot: data.weakFoot ?? null,
      indexRating: data.indexRating ?? null,
      imageUrl: `/card/${CATEGORY}/${team}/${file}`,
    });
  }

  return { skipped: false, rows, warnings, complete };
}

async function main() {
  const teams = discoverTeams(CARDS_DIR, EXTRACT_DIR);

  const rows: CardImportRow[] = [];
  const warnings: string[] = [];
  const skippedTeams: string[] = [];
  // source ครบ = ทุกทีมมี extract json และทุกไฟล์รูปแมตช์ข้อมูล extract ที่ valid ครบ — ถ้าไม่ครบ ห้ามรัน
  // stale-removal เพราะแยกไม่ออกว่าการ์ดที่หายไปจาก `rows` คือ "ถูกถอดจริง" หรือแค่ "อ่าน source รอบนี้ไม่ครบ"
  let sourceComplete = true;

  for (const team of teams) {
    const result = collectTeamRows(CARDS_DIR, EXTRACT_DIR, team);
    if (result.skipped) {
      skippedTeams.push(team);
      sourceComplete = false;
      continue;
    }
    rows.push(...result.rows);
    warnings.push(...result.warnings);
    if (!result.complete) sourceComplete = false;
  }

  const dupes = findDuplicateIdentities(rows);
  if (dupes.length > 0) {
    throw new Error(
      `ยกเลิก import: พบ identity ซ้ำ (name+club+category) ในข้อมูล source เดียวกัน:\n${dupes.join("\n")}`,
    );
  }

  if (!sourceComplete) {
    console.log(
      `\n⚠ ข้ามขั้นตอนลบการ์ดที่หายจาก source (stale-removal) เพราะอ่าน source รอบนี้ไม่ครบ ` +
        `(มีทีม/แถวที่ขาดข้อมูล) — จะ upsert เฉพาะการ์ดที่มีข้อมูลสมบูรณ์เท่านั้น แก้ source ให้ครบก่อน reimport ` +
        `ถ้าต้องการให้ลบการ์ดที่ถอดออกจริง`,
    );
  }

  const result = await prisma.$transaction(
    (tx) => importCardCatalog(tx, rows, sourceComplete ? [CATEGORY] : []),
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.log(`\n=== Import เสร็จ ===`);
  console.log(`การ์ดที่ import: ${result.imported} (ถอดออก ${result.removed})`);
  if (skippedTeams.length)
    console.log(`ทีมที่ยังไม่มี extract json (${skippedTeams.length}): ${skippedTeams.join(", ")}`);
  if (warnings.length) {
    console.log(`\nคำเตือน (${warnings.length}):`);
    warnings.slice(0, 30).forEach((w) => console.log("  - " + w));
    if (warnings.length > 30) console.log(`  ... อีก ${warnings.length - 30} รายการ`);
  }
  await prisma.$disconnect();
}

// รัน main() เฉพาะตอนสั่ง `tsx prisma/import-cards.ts` ตรงๆ ไม่ใช่ตอนถูก import (เช่นจาก test ที่ import
// collectTeamRows) กันไม่ให้การ import ไฟล์นี้ไปเทส trigger การเขียน DB จริงโดยไม่ตั้งใจ
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
}
