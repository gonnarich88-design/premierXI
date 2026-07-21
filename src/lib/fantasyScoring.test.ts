// src/lib/fantasyScoring.test.ts — รัน: npx tsx --test src/lib/fantasyScoring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePlayer, type MatchStatLine } from "./fantasyScoring";

function stat(overrides: Partial<MatchStatLine> = {}): MatchStatLine {
  return { playerId: "p1", minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, ownGoals: 0, goalsConceded: 0, ...overrides };
}

test("scorePlayer: appearance boundaries (0 / 1-59 / 60+)", () => {
  assert.equal(scorePlayer(stat({ minutes: 0 }), "MID"), 0);
  assert.equal(scorePlayer(stat({ minutes: 1 }), "MID"), 1);
  assert.equal(scorePlayer(stat({ minutes: 59 }), "MID"), 1);
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 1 }), "MID"), 2);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 1 }), "MID"), 2);
});

test("scorePlayer: goal points differ by position group", () => {
  assert.equal(scorePlayer(stat({ minutes: 90, goals: 1, goalsConceded: 1 }), "GK"), 2 + 10);
  assert.equal(scorePlayer(stat({ minutes: 90, goals: 1, goalsConceded: 1 }), "DEF"), 2 + 6);
  assert.equal(scorePlayer(stat({ minutes: 90, goals: 1, goalsConceded: 1 }), "MID"), 2 + 5);
  assert.equal(scorePlayer(stat({ minutes: 90, goals: 1, goalsConceded: 1 }), "ATT"), 2 + 4);
});

test("scorePlayer: assist is 3 for every position", () => {
  for (const group of ["GK", "DEF", "MID", "ATT"] as const) {
    assert.equal(scorePlayer(stat({ minutes: 90, assists: 1, goalsConceded: 1 }), group), 2 + 3);
  }
});

test("scorePlayer: clean sheet requires >=60 minutes", () => {
  assert.equal(scorePlayer(stat({ minutes: 59, goalsConceded: 0 }), "DEF"), 1, "59 min ไม่ได้คลีนชีตแม้เสีย 0 ประตู");
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 0 }), "DEF"), 2 + 4, "60 min + เสีย 0 ได้คลีนชีต");
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 0 }), "GK"), 2 + 4);
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 0 }), "MID"), 2 + 1);
  assert.equal(scorePlayer(stat({ minutes: 60, goalsConceded: 0 }), "ATT"), 2 + 0);
});

test("scorePlayer: goals conceded penalty rounds down every 2, only GK/DEF", () => {
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 1 }), "GK"), 2 - 0);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 2 }), "GK"), 2 - 1);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 3 }), "GK"), 2 - 1);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 4 }), "DEF"), 2 - 2);
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 4 }), "MID"), 2, "MID/ATT ไม่โดนหักเสียประตู");
  assert.equal(scorePlayer(stat({ minutes: 90, goalsConceded: 4 }), "ATT"), 2);
});

test("scorePlayer: cards and own goals", () => {
  assert.equal(scorePlayer(stat({ minutes: 90, yellow: 1, goalsConceded: 1 }), "MID"), 2 - 1);
  assert.equal(scorePlayer(stat({ minutes: 90, red: 1, goalsConceded: 1 }), "MID"), 2 - 3);
  assert.equal(scorePlayer(stat({ minutes: 90, ownGoals: 1, goalsConceded: 1 }), "MID"), 2 - 2);
});
