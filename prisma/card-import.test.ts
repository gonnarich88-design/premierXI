// prisma/card-import.test.ts — รัน: npm run test:card-import
// ทดสอบตรงกับฐาน dev.db จริง (โปรเจกต์นี้ไม่มี test DB แยก) — ทุก test ใช้ category สุ่มเฉพาะตัวเองเสมอ (ไม่ใช้
// "normal"/"evolution" จริง) กัน importCardCatalog's stale-removal scope ไปแตะ catalog จริงที่มีอยู่ในฐานโดยไม่ตั้งใจ
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { importCardCatalog, findDuplicateIdentities, type CardImportRow } from "./card-import";

let seq = 0;
function uniqueCategory(label: string): string {
  seq += 1;
  return `test-${label}-${Date.now()}-${seq}`;
}

function makeRow(overrides: Partial<CardImportRow> & { name: string; club: string; category: string }): CardImportRow {
  return {
    tier: "Bronze",
    nation: "Test",
    position: "GK",
    ovr: 60,
    altPositions: null,
    foot: null,
    skillMoves: null,
    weakFoot: null,
    indexRating: null,
    imageUrl: "/card/test/x.png",
    ...overrides,
  };
}

async function cleanup(names: string[]) {
  const players = await prisma.player.findMany({ where: { name: { in: names } }, select: { id: true } });
  const playerIds = players.map((p) => p.id);
  await prisma.userCard.deleteMany({ where: { card: { playerId: { in: playerIds } } } });
  await prisma.fantasyEntrySlot.deleteMany({ where: { playerId: { in: playerIds } } });
  await prisma.card.deleteMany({ where: { playerId: { in: playerIds } } });
  await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
}

test("findDuplicateIdentities catches duplicate name+club+category within a batch", () => {
  const category = uniqueCategory("dup");
  const rows = [
    makeRow({ name: "Dup Player", club: "Test FC", category }),
    makeRow({ name: "Dup Player", club: "Test FC", category }),
    makeRow({ name: "Unique Player", club: "Test FC", category }),
  ];
  const dupes = findDuplicateIdentities(rows);
  assert.equal(dupes.length, 1);
  assert.match(dupes[0], /Dup Player/);
});

test("reimport with unchanged source keeps the same Player/Card ids", async () => {
  const category = uniqueCategory("stable");
  const name = `Reimport Stable ${Date.now()}`;
  try {
    const row = makeRow({ name, club: "Stable FC", category });
    const first = await prisma.$transaction((tx) => importCardCatalog(tx, [row], [category]));
    assert.equal(first.imported, 1);
    assert.equal(first.removed, 0);

    const cardBefore = await prisma.card.findFirstOrThrow({ where: { player: { name } } });

    const second = await prisma.$transaction((tx) => importCardCatalog(tx, [row], [category]));
    assert.equal(second.imported, 1);
    assert.equal(second.removed, 0);

    const cardAfter = await prisma.card.findFirstOrThrow({ where: { player: { name } } });
    assert.equal(cardAfter.id, cardBefore.id);
    assert.equal(cardAfter.playerId, cardBefore.playerId);
  } finally {
    await cleanup([name]);
  }
});

test("reimport with changed OVR keeps Card id but updates stats/tier", async () => {
  const category = uniqueCategory("ovr");
  const name = `Reimport Ovr ${Date.now()}`;
  try {
    const rowLow = makeRow({ name, club: "Ovr FC", category, position: "ST", ovr: 60, tier: "Bronze" });
    await prisma.$transaction((tx) => importCardCatalog(tx, [rowLow], [category]));
    const cardBefore = await prisma.card.findFirstOrThrow({ where: { player: { name } } });
    assert.equal(cardBefore.ovr, 60);
    assert.equal(cardBefore.tier, "Bronze");

    const rowHigh = makeRow({ name, club: "Ovr FC", category, position: "ST", ovr: 85, tier: "Gold" });
    await prisma.$transaction((tx) => importCardCatalog(tx, [rowHigh], [category]));
    const cardAfter = await prisma.card.findFirstOrThrow({ where: { player: { name } } });

    assert.equal(cardAfter.id, cardBefore.id);
    assert.equal(cardAfter.ovr, 85);
    assert.equal(cardAfter.tier, "Gold");
    assert.notEqual(cardAfter.pace, cardBefore.pace);
  } finally {
    await cleanup([name]);
  }
});

test("removing a card with no UserCard/FantasyEntrySlot reference is allowed", async () => {
  const category = uniqueCategory("removable");
  const name = `Removable ${Date.now()}`;
  try {
    const row = makeRow({ name, club: "Removable FC", category });
    await prisma.$transaction((tx) => importCardCatalog(tx, [row], [category]));
    const before = await prisma.card.count({ where: { player: { name } } });
    assert.equal(before, 1);

    const result = await prisma.$transaction((tx) => importCardCatalog(tx, [], [category]));
    assert.equal(result.removed, 1);

    const after = await prisma.card.count({ where: { player: { name } } });
    assert.equal(after, 0);
  } finally {
    await cleanup([name]);
  }
});

test("empty scopeCategories never removes anything, even with empty rows (importer must exclude incomplete-source categories from scope, not just from rows)", async () => {
  const category = uniqueCategory("noscope");
  const name = `NoScope ${Date.now()}`;
  try {
    const row = makeRow({ name, club: "NoScope FC", category });
    await prisma.$transaction((tx) => importCardCatalog(tx, [row], [category]));
    const before = await prisma.card.count({ where: { player: { name } } });
    assert.equal(before, 1);

    // จำลอง importer ที่พบว่า source ของ category นี้อ่านไม่ครบ (missing json/dir หรือแถวข้อมูลเสีย) จึงส่ง
    // scopeCategories ว่างเข้ามาแทน — card เดิมต้องไม่ถูกแตะเลย ต่างจากกรณีตั้งใจถอด (ทดสอบด้านบน) ที่ scope ยังคงอยู่
    const result = await prisma.$transaction((tx) => importCardCatalog(tx, [], []));
    assert.equal(result.removed, 0);

    const after = await prisma.card.count({ where: { player: { name } } });
    assert.equal(after, 1, "card must survive when its category is excluded from scope");
  } finally {
    await cleanup([name]);
  }
});

test("removing a card that a user owns is rejected and nothing changes", async () => {
  const category = uniqueCategory("owned");
  const name = `Owned ${Date.now()}`;
  const username = `owned_${Date.now()}`;
  let userId: string | undefined;
  try {
    const row = makeRow({ name, club: "Owned FC", category });
    await prisma.$transaction((tx) => importCardCatalog(tx, [row], [category]));
    const card = await prisma.card.findFirstOrThrow({ where: { player: { name } } });

    const user = await prisma.user.create({ data: { username, phone: username, passwordHash: "x" } });
    userId = user.id;
    await prisma.userCard.create({ data: { userId: user.id, cardId: card.id } });

    await assert.rejects(() => prisma.$transaction((tx) => importCardCatalog(tx, [], [category])));

    const stillThere = await prisma.card.findUnique({ where: { id: card.id } });
    assert.ok(stillThere, "card must still exist after a rejected import");
    const ownershipStillThere = await prisma.userCard.count({ where: { userId: user.id, cardId: card.id } });
    assert.equal(ownershipStillThere, 1);
  } finally {
    if (userId) await prisma.userCard.deleteMany({ where: { userId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await cleanup([name]);
  }
});

test("removing a card referenced by a Fantasy entry slot is rejected", async () => {
  const category = uniqueCategory("fantasy");
  const name = `FantasyRef ${Date.now()}`;
  const username = `fref_${Date.now()}`;
  let userId: string | undefined;
  let gameweekId: string | undefined;
  try {
    const row = makeRow({ name, club: "Fantasy FC", category });
    await prisma.$transaction((tx) => importCardCatalog(tx, [row], [category]));
    const card = await prisma.card.findFirstOrThrow({ where: { player: { name } } });

    const user = await prisma.user.create({ data: { username, phone: username, passwordHash: "x" } });
    userId = user.id;
    const gameweek = await prisma.gameweek.create({
      data: {
        number: 999900 + Math.floor(Math.random() * 90),
        deadline: new Date(Date.now() + 60_000),
        monthKey: "2026-07",
      },
    });
    gameweekId = gameweek.id;
    const entry = await prisma.fantasyEntry.create({
      data: { userId: user.id, gameweekId: gameweek.id, formation: "4-3-3" },
    });
    await prisma.fantasyEntrySlot.create({
      data: {
        entryId: entry.id,
        cardId: card.id,
        playerId: card.playerId,
        fantasyPositionGroup: "GK",
        slotIndex: 0,
        isStarter: true,
      },
    });

    await assert.rejects(() => prisma.$transaction((tx) => importCardCatalog(tx, [], [category])));

    const stillThere = await prisma.card.findUnique({ where: { id: card.id } });
    assert.ok(stillThere, "card must still exist after a rejected import");
  } finally {
    if (userId) await prisma.fantasyEntry.deleteMany({ where: { userId } });
    if (gameweekId) await prisma.gameweek.deleteMany({ where: { id: gameweekId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await cleanup([name]);
  }
});

test("same name+club across different categories reuses the same Player but distinct Cards", async () => {
  const categoryA = uniqueCategory("crossA");
  const categoryB = uniqueCategory("crossB");
  const name = `CrossCategory ${Date.now()}`;
  try {
    const rowA = makeRow({ name, club: "Cross FC", category: categoryA });
    const rowB = makeRow({ name, club: "Cross FC", category: categoryB, tier: "Hero" });

    await prisma.$transaction((tx) => importCardCatalog(tx, [rowA], [categoryA]));
    await prisma.$transaction((tx) => importCardCatalog(tx, [rowB], [categoryB]));

    const players = await prisma.player.findMany({ where: { name } });
    assert.equal(players.length, 1, "should reuse the same Player row across categories");

    const cards = await prisma.card.findMany({ where: { player: { name } } });
    assert.equal(cards.length, 2, "each category should get its own Card row");
    assert.notEqual(cards[0].id, cards[1].id);
  } finally {
    await cleanup([name]);
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
