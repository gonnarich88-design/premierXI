// src/lib/fantasyAdmin.test.ts — รัน: DATABASE_URL="file:./dev.db?connection_limit=1" npx tsx --test src/lib/fantasyAdmin.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { createGameweek, upsertMatch, listGameweeksForAdmin, getGameweekAdminDetail } from "./fantasyAdmin";
import { GAMEWEEK_STATUS } from "./fantasyConfig";

async function makeGameweek(number: number, deadlineOffsetMs = 3600_000) {
  const { id } = await createGameweek(number, new Date(Date.now() + deadlineOffsetMs));
  return id;
}

test("createGameweek: derives monthKey from deadline (UTC) and rejects duplicate number", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  try {
    const deadline = new Date("2026-08-01T00:00:00.000Z");
    const { id } = await createGameweek(number, deadline);
    const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id } });
    assert.equal(gw.monthKey, "2026-08");
    assert.equal(gw.status, GAMEWEEK_STATUS.UPCOMING);

    await assert.rejects(() => createGameweek(number, deadline), /มีอยู่แล้ว/);
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
  }
});

test("upsertMatch: rejects home == away club", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const gwId = await makeGameweek(number);
  try {
    await assert.rejects(
      () => upsertMatch(gwId, { homeClub: "Arsenal", awayClub: "Arsenal", homeScore: null, awayScore: null, kickoffAt: null, status: "SCHEDULED" }),
      /ไม่ใช่ทีมเดียวกัน/,
    );
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
  }
});

test("upsertMatch: rejects negative or non-integer score", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const gwId = await makeGameweek(number);
  try {
    await assert.rejects(() =>
      upsertMatch(gwId, { homeClub: "Arsenal", awayClub: "Chelsea", homeScore: -1, awayScore: 0, kickoffAt: null, status: "PLAYED" }),
    );
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
  }
});

test("upsertMatch: POSTPONED/CANCELLED must not carry a score (no 0-0 substitute)", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const gwId = await makeGameweek(number);
  try {
    await assert.rejects(() =>
      upsertMatch(gwId, { homeClub: "Arsenal", awayClub: "Chelsea", homeScore: 0, awayScore: 0, kickoffAt: null, status: "POSTPONED" }),
      /เลื่อน\/ยกเลิก/,
    );
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
  }
});

test("upsertMatch: create then update by id, blocked once Gameweek is SCORING/SCORED", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const gwId = await makeGameweek(number);
  try {
    const { id: matchId } = await upsertMatch(gwId, {
      homeClub: "Arsenal", awayClub: "Chelsea", homeScore: null, awayScore: null, kickoffAt: null, status: "SCHEDULED",
    });
    await upsertMatch(gwId, {
      id: matchId, homeClub: "Arsenal", awayClub: "Chelsea", homeScore: 2, awayScore: 1, kickoffAt: null, status: "PLAYED",
    });
    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    assert.equal(match.homeScore, 2);
    assert.equal(match.awayScore, 1);

    await prisma.gameweek.update({ where: { id: gwId }, data: { status: GAMEWEEK_STATUS.SCORING } });
    await assert.rejects(
      () => upsertMatch(gwId, { id: matchId, homeClub: "Arsenal", awayClub: "Chelsea", homeScore: 3, awayScore: 1, kickoffAt: null, status: "PLAYED" }),
      /ปิดคิดคะแนนแล้ว/,
    );
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
  }
});

test("listGameweeksForAdmin / getGameweekAdminDetail: reflect match count and nested stats", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const gwId = await makeGameweek(number);
  try {
    await upsertMatch(gwId, { homeClub: "Arsenal", awayClub: "Chelsea", homeScore: null, awayScore: null, kickoffAt: null, status: "SCHEDULED" });
    const list = await listGameweeksForAdmin();
    const row = list.find((g) => g.id === gwId);
    assert.ok(row);
    assert.equal(row!.matchCount, 1);

    const detail = await getGameweekAdminDetail(gwId);
    assert.equal(detail!.matches.length, 1);
    assert.equal(detail!.matches[0].stats.length, 0);
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
