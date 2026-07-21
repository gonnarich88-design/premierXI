/**
 * Import การ์ดพิเศษ (Evolution / Royal Prime) จากรูปใน public/card/<category>/*.png
 * ใช้ข้อมูลที่ดึงจากรูป (vision) ในไฟล์ data/extracted/<category>.json
 *
 * ต่างจาก import-cards.ts (normal, แยกโฟลเดอร์ทีม) ตรงที่:
 * - ไม่มีโฟลเดอร์ทีมย่อย รูปอยู่ตรงกับ category เลย
 * - extracted json มี club/nation ต่อการ์ดโดยตรง (ไม่ derive จากชื่อโฟลเดอร์)
 *
 * Upsert ตาม stable identity (ดู prisma/card-import.ts) เหมือน import-cards.ts — reimport ซ้ำได้ตลอดอายุเกม
 * (ต่างจาก import-cards.ts ที่เป็น full pre-launch reset) จึง "ห้าม" ลบ UserCard/FantasyEntrySlot ของผู้ใช้จริง
 * ทิ้งเงียบๆ ถ้าการ์ดถูกถอดจาก source แต่ยังมีคนถือ/ใช้ในทีม Fantasy อยู่ ให้ reject ทั้ง import แทน
 * ทั้ง 2 category import พร้อมกันใน transaction เดียว (ไม่ commit ทีละ category กันเหลือครึ่งชุดถ้า category ที่สองล้ม)
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
import { fileURLToPath } from "url";
import { POSITIONS } from "../src/lib/constants";
import { importCardCatalog, findDuplicateIdentities, type CardImportRow } from "./card-import";

const prisma = new PrismaClient();
const EXTRACT_DIR = join(process.cwd(), "data", "extracted");
const CARDS_ROOT = join(process.cwd(), "public", "card");

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

/** อ่านและ validate การ์ดของ category เดียว (pure — ไม่แตะ DB) รับ cardsRoot/extractDir เป็น parameter เพื่อ
 * unit test ได้โดยไม่ต้องพึ่ง public/card จริง — source ครบ = เจอทั้ง folder รูปและ extract json และทุกไฟล์รูป
 * แมตช์ข้อมูล extract ที่ valid ครบ — `complete: false` = ห้ามรัน stale-removal ของ category นี้รอบนี้ เพราะแยกไม่
 * ออกว่าการ์ดที่หายไปจาก `rows` คือ "ถูกถอดจริง" หรือแค่ "อ่านไม่ครบรอบนี้" */
export function collectRows(
  cardsRoot: string,
  extractDir: string,
  category: string,
  tier: string,
): { rows: CardImportRow[]; warnings: string[]; complete: boolean } {
  const cardsDir = join(cardsRoot, category);
  const jsonPath = join(extractDir, `${category}.json`);

  if (!existsSync(cardsDir) || !existsSync(jsonPath)) {
    console.log(`ข้าม ${category}: ไม่พบโฟลเดอร์รูปหรือ extract json`);
    return { rows: [], warnings: [], complete: false };
  }

  const parsed = JSON.parse(readFileSync(jsonPath, "utf-8"));
  // "cards" ต้องเป็น array จริง — ต่างจาก `?? []` เดิมที่ทำให้ extract ที่ผิดรูป (เช่น field หาย/พิมพ์ผิด) กลาย
  // เป็น "category นี้มีการ์ด 0 ใบ ยืนยันแล้ว" เงียบๆ ซึ่งถ้า category นั้นไม่มี PNG ด้วยจะดู "ครบ" ทั้งที่จริงคือ
  // ไฟล์เสีย ไม่ใช่ category ว่างจริง — ต้อง fail closed แยกสองเคสนี้ออกจากกัน
  if (!Array.isArray(parsed.cards)) {
    return {
      rows: [],
      warnings: [`${category}: extract json ไม่มี field "cards" เป็น array ที่ถูกต้อง`],
      complete: false,
    };
  }
  const extractedRows: Extracted[] = parsed.cards;
  const byFile = new Map(extractedRows.map((r) => [r.file, r]));
  const files = readdirSync(cardsDir).filter((f) => f.toLowerCase().endsWith(".png"));
  const fileSet = new Set(files);

  const rows: CardImportRow[] = [];
  const warnings: string[] = [];
  let complete = true;

  // เช็คสองทิศทาง: extract มีแถวไหนที่ไม่มีไฟล์ PNG จริงรองรับ (รูปหาย/ลบทิ้งแต่ extract ไม่ได้อัปเดต) ก็ถือว่า
  // source ไม่ครบเหมือนกัน ไม่งั้น card เดิมของนักเตะคนนั้นจะถูกมองว่า "ถอดจริง" ทั้งที่แค่รูปหายจาก deploy
  for (const row of extractedRows) {
    if (!fileSet.has(row.file)) {
      warnings.push(`${category}/${row.file}: มีข้อมูลใน extract แต่ไม่พบไฟล์รูป`);
      complete = false;
    }
  }

  for (const file of files) {
    const data = byFile.get(file);
    if (!data) {
      warnings.push(`${category}/${file}: ไม่มีข้อมูลใน extract`);
      complete = false;
      continue;
    }
    const name = file.replace(/\.png$/i, "");
    const ovr = Number(data.ovr);
    let position = String(data.position || "").toUpperCase();
    if (!validPos.has(position)) {
      // fallback ตำแหน่งไม่รู้จัก → CM ยังคงสร้าง row ได้ปกติ ไม่ใช่การข้ามการ์ด จึงไม่กระทบ complete
      warnings.push(`${category}/${file}: ตำแหน่ง "${position}" ไม่รู้จัก → CM`);
      position = "CM";
    }
    if (!Number.isFinite(ovr) || ovr < 40 || ovr > 99) {
      warnings.push(`${category}/${file}: OVR ผิดปกติ (${data.ovr}) → ข้าม`);
      complete = false;
      continue;
    }
    const club = data.club?.trim();
    if (!club) {
      warnings.push(`${category}/${file}: ไม่มีสโมสร → ข้าม`);
      complete = false;
      continue;
    }

    rows.push({
      name,
      club,
      category,
      tier,
      nation: data.nation?.trim() || "Unknown",
      position,
      ovr,
      altPositions: data.altPositions && data.altPositions.length ? data.altPositions.join(",") : null,
      foot: data.foot ?? null,
      skillMoves: data.skillMoves ?? null,
      weakFoot: data.weakFoot ?? null,
      indexRating: data.indexRating ?? null,
      imageUrl: `/card/${category}/${file}`,
    });
  }

  return { rows, warnings, complete };
}

async function main() {
  const allRows: CardImportRow[] = [];
  const allWarnings: string[] = [];
  const perCategoryCount: Record<string, number> = {};
  const scopeCategories: string[] = [];
  const incompleteCategories: string[] = [];

  for (const { category, tier } of CATEGORIES) {
    const { rows, warnings, complete } = collectRows(CARDS_ROOT, EXTRACT_DIR, category, tier);
    perCategoryCount[category] = rows.length;
    allRows.push(...rows);
    allWarnings.push(...warnings);
    if (complete) scopeCategories.push(category);
    else incompleteCategories.push(category);
  }

  const dupes = findDuplicateIdentities(allRows);
  if (dupes.length > 0) {
    throw new Error(
      `ยกเลิก import: พบ identity ซ้ำ (name+club+category) ในข้อมูล source เดียวกัน:\n${dupes.join("\n")}`,
    );
  }

  if (incompleteCategories.length > 0) {
    console.log(
      `\n⚠ ข้ามขั้นตอนลบการ์ดที่หายจาก source (stale-removal) สำหรับ category: ${incompleteCategories.join(", ")} ` +
        `เพราะอ่าน source รอบนี้ไม่ครบ — จะ upsert เฉพาะการ์ดที่มีข้อมูลสมบูรณ์เท่านั้น แก้ source ให้ครบก่อน reimport ` +
        `ถ้าต้องการให้ลบการ์ดที่ถอดออกจริง`,
    );
  }

  const result = await prisma.$transaction(
    (tx) => importCardCatalog(tx, allRows, scopeCategories),
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.log(`\n=== Import การ์ดพิเศษเสร็จ ===`);
  for (const { category, tier } of CATEGORIES) {
    console.log(`${category}: ${perCategoryCount[category] ?? 0} การ์ด (tier ${tier})`);
  }
  console.log(`รวมทั้งหมด: ${result.imported} การ์ด (ถอดออก ${result.removed})`);
  if (allWarnings.length) {
    console.log(`\nคำเตือน (${allWarnings.length}):`);
    allWarnings.forEach((w) => console.log("  - " + w));
  }
  await prisma.$disconnect();
}

// รัน main() เฉพาะตอนสั่ง `tsx prisma/import-special-cards.ts` ตรงๆ ไม่ใช่ตอนถูก import (เช่นจาก test ที่ import
// collectRows) กันไม่ให้การ import ไฟล์นี้ไปเทส trigger การเขียน DB จริงโดยไม่ตั้งใจ
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
}
