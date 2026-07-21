// prisma/import-special-cards.test.ts — รัน: npx tsx --test prisma/import-special-cards.test.ts
// ทดสอบ collectRows (pure fs logic ของ import-special-cards.ts) ด้วย fixture ชั่วคราว ไม่แตะ public/card จริง
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { collectRows } from "./import-special-cards";

function setupFixture(category: string, files: string[], extractCards: Record<string, unknown>[]) {
  const root = mkdtempSync(join(tmpdir(), "import-special-test-"));
  const cardsRoot = join(root, "cards");
  const extractDir = join(root, "extracted");
  mkdirSync(join(cardsRoot, category), { recursive: true });
  mkdirSync(extractDir, { recursive: true });
  for (const f of files) writeFileSync(join(cardsRoot, category, f), "fake-png");
  writeFileSync(join(extractDir, `${category}.json`), JSON.stringify({ category, cards: extractCards }));
  return { root, cardsRoot, extractDir };
}

test("collectRows: missing category folder/json is skipped and incomplete", () => {
  const root = mkdtempSync(join(tmpdir(), "import-special-test-"));
  const cardsRoot = join(root, "cards");
  const extractDir = join(root, "extracted");
  mkdirSync(cardsRoot, { recursive: true });
  mkdirSync(extractDir, { recursive: true });
  try {
    const result = collectRows(cardsRoot, extractDir, "ghost", "Hero");
    assert.equal(result.complete, false);
    assert.equal(result.rows.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectRows: fully matching source is complete and produces a row", () => {
  const { root, cardsRoot, extractDir } = setupFixture(
    "evolution",
    ["Haaland.png"],
    [{ file: "Haaland.png", ovr: 92, position: "ST", nation: "Norway", club: "Manchester City" }],
  );
  try {
    const result = collectRows(cardsRoot, extractDir, "evolution", "Hero");
    assert.equal(result.complete, true);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].name, "Haaland");
    assert.equal(result.rows[0].tier, "Hero");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectRows: extract references a PNG that does not exist on disk → incomplete, no row produced", () => {
  const { root, cardsRoot, extractDir } = setupFixture(
    "evolution",
    [],
    [{ file: "Haaland.png", ovr: 92, position: "ST", nation: "Norway", club: "Manchester City" }],
  );
  try {
    const result = collectRows(cardsRoot, extractDir, "evolution", "Hero");
    assert.equal(result.complete, false, "missing PNG for an extract row must mark the category incomplete");
    assert.equal(result.rows.length, 0);
    assert.ok(result.warnings.some((w) => w.includes("ไม่พบไฟล์รูป")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectRows: valid JSON missing the \"cards\" field with an empty category folder must NOT be treated as a confirmed-empty complete category", () => {
  const root = mkdtempSync(join(tmpdir(), "import-special-test-"));
  const cardsRoot = join(root, "cards");
  const extractDir = join(root, "extracted");
  mkdirSync(join(cardsRoot, "evolution"), { recursive: true }); // โฟลเดอร์ category มีอยู่ แต่ไม่มีไฟล์ PNG ข้างใน
  mkdirSync(extractDir, { recursive: true });
  writeFileSync(join(extractDir, "evolution.json"), JSON.stringify({ category: "evolution" })); // ไม่มี field "cards"
  try {
    const result = collectRows(cardsRoot, extractDir, "evolution", "Hero");
    assert.equal(
      result.complete,
      false,
      "malformed extract shape (missing cards array) with an empty folder must not look 'confirmed empty'",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectRows: PNG with no matching extract entry → incomplete", () => {
  const { root, cardsRoot, extractDir } = setupFixture("evolution", ["Extra.png"], []);
  try {
    const result = collectRows(cardsRoot, extractDir, "evolution", "Hero");
    assert.equal(result.complete, false);
    assert.equal(result.rows.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectRows: missing club is skipped and marks the category incomplete", () => {
  const { root, cardsRoot, extractDir } = setupFixture(
    "evolution",
    ["NoClub.png"],
    [{ file: "NoClub.png", ovr: 80, position: "ST", nation: "Test", club: "" }],
  );
  try {
    const result = collectRows(cardsRoot, extractDir, "evolution", "Hero");
    assert.equal(result.complete, false);
    assert.equal(result.rows.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectRows: unknown position falls back to CM without marking incomplete", () => {
  const { root, cardsRoot, extractDir } = setupFixture(
    "evolution",
    ["Weird.png"],
    [{ file: "Weird.png", ovr: 80, position: "ZZ", nation: "Test", club: "Test FC" }],
  );
  try {
    const result = collectRows(cardsRoot, extractDir, "evolution", "Hero");
    assert.equal(result.complete, true);
    assert.equal(result.rows[0].position, "CM");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
