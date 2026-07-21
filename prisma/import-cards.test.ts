// prisma/import-cards.test.ts — รัน: npx tsx --test prisma/import-cards.test.ts
// ทดสอบ collectTeamRows (pure fs logic ของ import-cards.ts) ด้วย fixture ชั่วคราว ไม่แตะ public/card จริง
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { collectTeamRows, discoverTeams } from "./import-cards";

function setupFixture(team: string, files: string[], extractCards: Record<string, unknown>[]) {
  const root = mkdtempSync(join(tmpdir(), "import-cards-test-"));
  const cardsDir = join(root, "cards");
  const extractDir = join(root, "extracted");
  mkdirSync(join(cardsDir, team), { recursive: true });
  mkdirSync(extractDir, { recursive: true });
  for (const f of files) writeFileSync(join(cardsDir, team, f), "fake-png");
  writeFileSync(join(extractDir, `${team}.json`), JSON.stringify({ team, cards: extractCards }));
  return { root, cardsDir, extractDir };
}

test("collectTeamRows: team with no extract json is skipped", () => {
  const root = mkdtempSync(join(tmpdir(), "import-cards-test-"));
  const cardsDir = join(root, "cards");
  const extractDir = join(root, "extracted");
  mkdirSync(join(cardsDir, "ghost"), { recursive: true });
  mkdirSync(extractDir, { recursive: true });
  try {
    const result = collectTeamRows(cardsDir, extractDir, "ghost");
    assert.equal(result.skipped, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectTeamRows: fully matching source is complete and produces a row", () => {
  const { root, cardsDir, extractDir } = setupFixture(
    "fulham",
    ["Andersen.png"],
    [{ file: "Andersen.png", ovr: 79, position: "GK", nation: "Denmark" }],
  );
  try {
    const result = collectTeamRows(cardsDir, extractDir, "fulham");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.complete, true);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].name, "Andersen");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectTeamRows: extract references a PNG that does not exist on disk → incomplete, no row produced", () => {
  const { root, cardsDir, extractDir } = setupFixture(
    "fulham",
    [], // ไม่มีไฟล์ PNG จริงเลย แม้ extract จะพูดถึง Andersen.png
    [{ file: "Andersen.png", ovr: 79, position: "GK", nation: "Denmark" }],
  );
  try {
    const result = collectTeamRows(cardsDir, extractDir, "fulham");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.complete, false, "missing PNG for an extract row must mark the team incomplete");
    assert.equal(result.rows.length, 0, "must not silently produce a row without a real image");
    assert.ok(result.warnings.some((w) => w.includes("ไม่พบไฟล์รูป")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectTeamRows: extract exists but the whole team image folder is missing → incomplete, no throw", () => {
  const root = mkdtempSync(join(tmpdir(), "import-cards-test-"));
  const cardsDir = join(root, "cards"); // สร้าง cardsDir เอง แต่ "ไม่" สร้างโฟลเดอร์ทีมข้างใน
  const extractDir = join(root, "extracted");
  mkdirSync(cardsDir, { recursive: true });
  mkdirSync(extractDir, { recursive: true });
  writeFileSync(
    join(extractDir, "fulham.json"),
    JSON.stringify({ team: "fulham", cards: [{ file: "Andersen.png", ovr: 79, position: "GK" }] }),
  );
  try {
    const result = collectTeamRows(cardsDir, extractDir, "fulham");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.complete, false, "missing team directory must mark the team incomplete, not throw");
    assert.equal(result.rows.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectTeamRows: valid JSON missing the \"cards\" field with an empty team folder must NOT be treated as a confirmed-empty complete team", () => {
  const root = mkdtempSync(join(tmpdir(), "import-cards-test-"));
  const cardsDir = join(root, "cards");
  const extractDir = join(root, "extracted");
  mkdirSync(join(cardsDir, "fulham"), { recursive: true }); // โฟลเดอร์ทีมมีอยู่ แต่ไม่มีไฟล์ PNG ข้างใน
  mkdirSync(extractDir, { recursive: true });
  writeFileSync(join(extractDir, "fulham.json"), JSON.stringify({ team: "fulham" })); // ไม่มี field "cards" เลย
  try {
    const result = collectTeamRows(cardsDir, extractDir, "fulham");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(
      result.complete,
      false,
      "malformed extract shape (missing cards array) with an empty folder must not look 'confirmed empty'",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discoverTeams: unions team directories with extract-json teams whose directory is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "import-cards-test-"));
  const cardsDir = join(root, "cards");
  const extractDir = join(root, "extracted");
  mkdirSync(join(cardsDir, "hasdironly"), { recursive: true });
  mkdirSync(extractDir, { recursive: true });
  writeFileSync(join(extractDir, "hasdironly.json"), JSON.stringify({ team: "hasdironly", cards: [] }));
  writeFileSync(join(extractDir, "jsononly"), "not-a-team-file"); // ไม่ใช่ .json ต้องไม่ถูกนับ
  writeFileSync(join(extractDir, "jsononly.json"), JSON.stringify({ team: "jsononly", cards: [] }));
  writeFileSync(join(extractDir, "evolution.json"), JSON.stringify({ category: "evolution", cards: [] })); // ไม่มี "team" field ต้องไม่ถูกนับเป็นทีม
  try {
    const teams = discoverTeams(cardsDir, extractDir);
    assert.ok(teams.includes("hasdironly"));
    assert.ok(teams.includes("jsononly"), "team whose image folder is missing must still be discovered from extract json");
    assert.ok(!teams.includes("evolution"), "special-card category files (no 'team' field) must not be treated as teams");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discoverTeams: malformed <team>.json with no matching image folder must abort loudly, not silently drop the team", () => {
  const root = mkdtempSync(join(tmpdir(), "import-cards-test-"));
  const cardsDir = join(root, "cards"); // ไม่มีโฟลเดอร์ "broken" อยู่เลย
  const extractDir = join(root, "extracted");
  mkdirSync(cardsDir, { recursive: true });
  mkdirSync(extractDir, { recursive: true });
  writeFileSync(join(extractDir, "broken.json"), "{ this is not valid json");
  try {
    // ถ้า parse failure ถูกกลืนเงียบๆ (return false) ทีม "broken" จะไม่ถูก discover เลยทั้ง 2 ทาง (ไม่มีโฟลเดอร์
    // รูปด้วย) sourceComplete จะเข้าใจผิดว่าครบ แล้ว stale-removal จะลบการ์ดเดิมของทีมนี้ทิ้งแบบไม่มีใครรู้ตัว
    assert.throws(() => discoverTeams(cardsDir, extractDir));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectTeamRows: PNG with no matching extract entry → incomplete", () => {
  const { root, cardsDir, extractDir } = setupFixture("fulham", ["Extra.png"], []);
  try {
    const result = collectTeamRows(cardsDir, extractDir, "fulham");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.complete, false);
    assert.equal(result.rows.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectTeamRows: unknown position falls back to CM without marking the team incomplete", () => {
  const { root, cardsDir, extractDir } = setupFixture(
    "fulham",
    ["Weird.png"],
    [{ file: "Weird.png", ovr: 70, position: "ZZ", nation: "Nowhere" }],
  );
  try {
    const result = collectTeamRows(cardsDir, extractDir, "fulham");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.complete, true, "unknown position is a soft fallback, not a completeness failure");
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].position, "CM");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectTeamRows: invalid OVR is skipped and marks the team incomplete", () => {
  const { root, cardsDir, extractDir } = setupFixture(
    "fulham",
    ["Bad.png"],
    [{ file: "Bad.png", ovr: 999, position: "GK", nation: "Test" }],
  );
  try {
    const result = collectTeamRows(cardsDir, extractDir, "fulham");
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.complete, false);
    assert.equal(result.rows.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
