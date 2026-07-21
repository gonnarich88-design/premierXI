// prisma/card-import.ts
// Shared upsert logic ระหว่าง import-cards.ts (normal) และ import-special-cards.ts (evolution/royalprime)
// เขียนแยกไว้ที่เดียวกันไฟล์ importer สองตัวแก้ logic atomicity/guard ไม่ตรงกันในอนาคต
import { Prisma } from "@prisma/client";
import { generateStats } from "../src/lib/cardgen";

export type CardImportRow = {
  name: string;
  club: string;
  category: string;
  tier: string;
  nation: string;
  position: string;
  ovr: number;
  altPositions: string | null;
  foot: string | null;
  skillMoves: number | null;
  weakFoot: number | null;
  indexRating: number | null;
  imageUrl: string;
};

/** เช็ค identity ซ้ำภายใน batch เดียวกัน (name+club+category) — ซ้ำแปลว่า source ข้อมูลมี 2 แถวชี้การ์ดใบเดียวกัน
 * ห้ามปล่อยผ่านเพราะ upsert จะเอาแถวหลังทับแถวแรกเงียบๆ โดยไม่มีใครรู้ว่าข้อมูลแถวแรกหายไปไหน */
export function findDuplicateIdentities(rows: CardImportRow[]): string[] {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.name} / ${r.club} / ${r.category}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} (${n} แถว)`);
}

export type CardImportResult = { imported: number; removed: number };

/**
 * Upsert player+card ตาม stable identity (Player: name+club, Card: playerId+category) แล้วลบเฉพาะการ์ดใน
 * `scopeCategories` ที่หายไปจาก `rows` (ไม่แตะ category อื่นที่ไม่อยู่ใน scope) — reject ทั้ง import ถ้าการ์ดที่
 * จะถูกถอดยังมี UserCard (ผู้ใช้ถือ) หรือ FantasyEntrySlot (ใช้ในทีม Fantasy) อ้างอิงอยู่ ไม่ลบทิ้งเงียบๆ
 *
 * ต้องเรียกใน prisma.$transaction เดียวกับ caller เสมอ (ไม่ commit ทีละแถว) เพื่อให้ rollback ได้เต็มถ้าล้มกลางทาง
 */
export async function importCardCatalog(
  tx: Prisma.TransactionClient,
  rows: CardImportRow[],
  scopeCategories: string[],
): Promise<CardImportResult> {
  const desiredCardIds: string[] = [];

  for (const row of rows) {
    const player = await tx.player.upsert({
      where: { name_club: { name: row.name, club: row.club } },
      create: { name: row.name, club: row.club, nation: row.nation, position: row.position },
      update: { nation: row.nation, position: row.position },
      select: { id: true },
    });

    const stats = generateStats(row.ovr, row.position);
    const card = await tx.card.upsert({
      where: { playerId_category: { playerId: player.id, category: row.category } },
      create: {
        playerId: player.id,
        category: row.category,
        tier: row.tier,
        position: row.position,
        ovr: row.ovr,
        ...stats,
        altPositions: row.altPositions,
        foot: row.foot,
        skillMoves: row.skillMoves,
        weakFoot: row.weakFoot,
        indexRating: row.indexRating,
        imageUrl: row.imageUrl,
      },
      update: {
        tier: row.tier,
        position: row.position,
        ovr: row.ovr,
        ...stats,
        altPositions: row.altPositions,
        foot: row.foot,
        skillMoves: row.skillMoves,
        weakFoot: row.weakFoot,
        indexRating: row.indexRating,
        imageUrl: row.imageUrl,
      },
      select: { id: true },
    });

    desiredCardIds.push(card.id);
  }

  // การ์ดใน scope นี้ที่ไม่อยู่ใน desired list แล้ว = ถูกถอดออกจาก source (ไฟล์รูป/extract ไม่มีแล้ว)
  const staleCards = await tx.card.findMany({
    where: { category: { in: scopeCategories }, id: { notIn: desiredCardIds } },
    select: {
      id: true,
      category: true,
      player: { select: { name: true, club: true } },
      _count: { select: { owners: true, fantasySlots: true } },
    },
  });

  const blocked = staleCards.filter((c) => c._count.owners > 0 || c._count.fantasySlots > 0);
  if (blocked.length > 0) {
    const lines = blocked.map(
      (c) =>
        `- ${c.player.name} / ${c.player.club} / ${c.category}: UserCard=${c._count.owners}, FantasyEntrySlot=${c._count.fantasySlots}`,
    );
    throw new Error(
      `ยกเลิก import: มีการ์ด ${blocked.length} ใบที่ถูกถอดจาก source แต่ยังถูกอ้างอิงอยู่ (ไม่มีข้อมูลใดถูกเปลี่ยนแปลง)\n` +
        lines.join("\n"),
    );
  }

  const removableIds = staleCards.map((c) => c.id);
  if (removableIds.length > 0) {
    await tx.card.deleteMany({ where: { id: { in: removableIds } } });
  }

  return { imported: desiredCardIds.length, removed: removableIds.length };
}
