// src/lib/fantasyAdmin.test.ts — รัน: DATABASE_URL="file:./dev.db?connection_limit=1" npx tsx --test src/lib/fantasyAdmin.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { createGameweek, upsertMatch, listGameweeksForAdmin, getGameweekAdminDetail, upsertPlayerStat } from "./fantasyAdmin";
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

async function makePlayerAndMatch(number: number) {
  const gwId = await makeGameweek(number);
  const { id: matchId } = await upsertMatch(gwId, {
    homeClub: "TestHome", awayClub: "TestAway", homeScore: null, awayScore: null, kickoffAt: null, status: "SCHEDULED",
  });
  const player = await prisma.player.create({
    data: { name: `StatTest ${number}`, club: "TestHome", nation: "Test", position: "ST" },
  });
  return { gwId, matchId, playerId: player.id };
}

test("upsertPlayerStat: rejects player whose club doesn't match the chosen clubSide", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const { gwId, matchId, playerId } = await makePlayerAndMatch(number);
  try {
    await assert.rejects(
      () => upsertPlayerStat(matchId, playerId, "AWAY", { minutes: 90, goals: 0, assists: 0, yellow: 0, red: 0, ownGoals: 0 }),
      /ไม่ได้อยู่สโมสร/,
    );
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
    await prisma.player.deleteMany({ where: { id: playerId } });
  }
});

test("upsertPlayerStat: rejects minutes over 120 and negative fields", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const { gwId, matchId, playerId } = await makePlayerAndMatch(number);
  try {
    await assert.rejects(() =>
      upsertPlayerStat(matchId, playerId, "HOME", { minutes: 121, goals: 0, assists: 0, yellow: 0, red: 0, ownGoals: 0 }),
    );
    await assert.rejects(() =>
      upsertPlayerStat(matchId, playerId, "HOME", { minutes: 90, goals: -1, assists: 0, yellow: 0, red: 0, ownGoals: 0 }),
    );
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
    await prisma.player.deleteMany({ where: { id: playerId } });
  }
});

test("upsertPlayerStat: happy path upserts and is idempotent per (matchId, playerId)", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const { gwId, matchId, playerId } = await makePlayerAndMatch(number);
  try {
    await upsertPlayerStat(matchId, playerId, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });
    await upsertPlayerStat(matchId, playerId, "HOME", { minutes: 90, goals: 2, assists: 1, yellow: 1, red: 0, ownGoals: 0 });
    const row = await prisma.playerMatchStat.findUniqueOrThrow({ where: { matchId_playerId: { matchId, playerId } } });
    assert.equal(row.goals, 2);
    assert.equal(row.assists, 1);
    const count = await prisma.playerMatchStat.count({ where: { matchId, playerId } });
    assert.equal(count, 1, "upsert ต้องไม่สร้างแถวซ้ำ");
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
    await prisma.player.deleteMany({ where: { id: playerId } });
  }
});

test("upsertPlayerStat: blocked once Gameweek enters SCORING", async () => {
  const number = 900000 + Math.floor(Math.random() * 90000);
  const { gwId, matchId, playerId } = await makePlayerAndMatch(number);
  try {
    await prisma.gameweek.update({ where: { id: gwId }, data: { status: GAMEWEEK_STATUS.SCORING } });
    await assert.rejects(
      () => upsertPlayerStat(matchId, playerId, "HOME", { minutes: 90, goals: 0, assists: 0, yellow: 0, red: 0, ownGoals: 0 }),
      /ปิดคิดคะแนนแล้ว/,
    );
  } finally {
    await prisma.gameweek.deleteMany({ where: { number } });
    await prisma.player.deleteMany({ where: { id: playerId } });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
