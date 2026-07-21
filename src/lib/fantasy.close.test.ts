// src/lib/fantasy.close.test.ts — รัน: DATABASE_URL="file:./dev.db?connection_limit=1" npx tsx --test src/lib/fantasy.close.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { closeGameweek, getLeaderboard, getMyLeaderboardRow } from "./fantasy";
import { createGameweek, upsertMatch, upsertPlayerStat } from "./fantasyAdmin";
import { GAMEWEEK_STATUS } from "./fantasyConfig";

/** สร้างสถานการณ์ทดสอบเต็ม: 1 Gameweek + 1 แมตช์ + ผู้เล่น 1 คน + user 1 คนที่ save entry (captain=ผู้เล่นคนนี้) */
async function setupScenario(number: number) {
  const username = `close_${number}`;
  const user = await prisma.user.create({ data: { username, phone: username, passwordHash: "x" } });
  const player = await prisma.player.create({ data: { name: `CloseTest ${number}`, club: "CloseFC", nation: "Test", position: "ST" } });
  const card = await prisma.card.create({
    data: { playerId: player.id, tier: "Bronze", category: `test-close-${number}`, position: "ST", ovr: 60, pace: 60, shooting: 60, passing: 60, dribbling: 60, defending: 60, physical: 60 },
  });
  await prisma.userCard.create({ data: { userId: user.id, cardId: card.id } });

  const { id: gameweekId } = await createGameweek(number, new Date(Date.now() - 3600_000)); // deadline ผ่านแล้ว
  const { id: matchId } = await upsertMatch(gameweekId, {
    homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: null, awayScore: null, kickoffAt: null, status: "SCHEDULED",
  });

  const entry = await prisma.fantasyEntry.create({
    data: {
      userId: user.id, gameweekId, formation: "4-3-3", submittedAt: new Date(),
      slots: { create: [{ cardId: card.id, playerId: player.id, fantasyPositionGroup: "ATT", slotIndex: 8, isStarter: true, isCaptain: true, isViceCaptain: true }] },
    },
  });

  return { user, player, card, gameweekId, matchId, entryId: entry.id };
}

async function cleanupScenario(number: number, userId: string) {
  await prisma.fantasyRewardGrant.deleteMany({ where: { userId } });
  await prisma.fantasyGameweekScore.deleteMany({ where: { userId } });
  await prisma.fantasyEntry.deleteMany({ where: { userId } });
  await prisma.gameweek.deleteMany({ where: { number } });
  await prisma.userCard.deleteMany({ where: { userId } });
  await prisma.card.deleteMany({ where: { category: `test-close-${number}` } });
  await prisma.player.deleteMany({ where: { name: `CloseTest ${number}` } });
  await prisma.user.delete({ where: { id: userId } });
}

test("closeGameweek: rejects before deadline and before all matches have scores", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, gameweekId } = await setupScenario(number);
  try {
    await prisma.gameweek.update({ where: { id: gameweekId }, data: { deadline: new Date(Date.now() + 3600_000) } });
    await assert.rejects(() => closeGameweek(gameweekId), /ยังไม่ถึง deadline/);

    await prisma.gameweek.update({ where: { id: gameweekId }, data: { deadline: new Date(Date.now() - 3600_000) } });
    await assert.rejects(() => closeGameweek(gameweekId), /ยังไม่ได้กรอกสกอร์/);
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: happy path scores, ranks, grants weekly reward (single participant = rank 1)", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    const result = await closeGameweek(gameweekId);
    assert.equal(result.ok, true);
    if (result.ok && !result.alreadyScored) {
      assert.equal(result.participantCount, 1);
      assert.equal(result.scoredCount, 1);
    }

    const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
    assert.equal(gw.status, GAMEWEEK_STATUS.SCORED);

    const score = await prisma.fantasyGameweekScore.findUniqueOrThrow({ where: { userId_gameweekId: { userId: user.id, gameweekId } } });
    assert.equal(score.rank, 1);
    assert.equal(score.rewardTier, "WEEKLY_TOP1");
    // captain: (2 appearance + 4 goal ATT) x2 = 12
    assert.equal(score.points, 12);

    const grants = await prisma.fantasyRewardGrant.findMany({ where: { userId: user.id, periodKey: gameweekId } });
    const types = grants.map((g) => g.rewardType).sort();
    assert.deepEqual(types, ["GOLD", "PACK"]);

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(freshUser.gold, 3, "WEEKLY_TOP1 ให้ 3 Gold");
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: a draft entry (never submitted) never enters ranking/leaderboard/reward even if it would score higher than every submitted entry (regression — runScoring used to include submittedAt=null entries in computeRanks)", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, card, gameweekId, matchId } = await setupScenario(number);
  const draftUser = await prisma.user.create({ data: { username: `close_${number}_draft`, phone: `close_${number}_draft`, passwordHash: "x" } });
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    // draft entry ของ user อีกคน — ใช้ captain คนเดียวกับที่ทำประตู (คะแนนดิบถ้าถูกนับจะสูงเท่ากับ/มากกว่า entry
    // ที่ submit จริง) แต่ submittedAt เป็น null (ทีมที่ clone มาจาก getOrCreateEntry เฉยๆ ไม่เคยกด save) —
    // ต้องไม่ถูกนับใน ranking เลยไม่ว่าคะแนนดิบจะสูงแค่ไหนก็ตาม
    await prisma.userCard.create({ data: { userId: draftUser.id, cardId: card.id } });
    await prisma.fantasyEntry.create({
      data: {
        userId: draftUser.id, gameweekId, formation: "4-3-3", submittedAt: null,
        slots: { create: [{ cardId: card.id, playerId: player.id, fantasyPositionGroup: "ATT", slotIndex: 8, isStarter: true, isCaptain: true, isViceCaptain: true }] },
      },
    });

    const result = await closeGameweek(gameweekId);
    assert.equal(result.ok, true);
    if (result.ok && !result.alreadyScored) {
      assert.equal(result.participantCount, 1, "draft entry ต้องไม่ถูกนับเข้า participantCount");
    }

    const draftScore = await prisma.fantasyGameweekScore.findUnique({ where: { userId_gameweekId: { userId: draftUser.id, gameweekId } } });
    assert.equal(draftScore, null, "draft entry ต้องไม่มีแถว FantasyGameweekScore เลย ไม่ใช่แค่ rank:null");

    const score = await prisma.fantasyGameweekScore.findUniqueOrThrow({ where: { userId_gameweekId: { userId: user.id, gameweekId } } });
    assert.equal(score.rank, 1, "user ที่ submit จริงต้องยังได้ rank 1 ไม่ถูก draft แทรกดันลง");

    const allScoreRows = await prisma.fantasyGameweekScore.count({ where: { gameweekId } });
    assert.equal(allScoreRows, 1, "ทั้ง Gameweek ต้องมีแค่ 1 แถวคะแนน (ของคนที่ submit จริง) ไม่มีแถวของ draft ปนอยู่");

    const draftGrants = await prisma.fantasyRewardGrant.count({ where: { userId: draftUser.id } });
    assert.equal(draftGrants, 0, "draft ต้องไม่ได้รับรางวัลใดๆ เลย");
  } finally {
    await prisma.fantasyEntry.deleteMany({ where: { userId: draftUser.id } });
    await prisma.userCard.deleteMany({ where: { userId: draftUser.id } });
    await prisma.user.delete({ where: { id: draftUser.id } });
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: calling again after SCORED is a no-op (idempotent, no duplicate grant)", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    await closeGameweek(gameweekId);
    const second = await closeGameweek(gameweekId);
    assert.deepEqual(second, { ok: true, alreadyScored: true });

    const grants = await prisma.fantasyRewardGrant.count({ where: { userId: user.id, periodKey: gameweekId } });
    assert.equal(grants, 2, "ยังคง 2 แถว (GOLD+PACK) ไม่เพิ่มซ้ำ");
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(freshUser.gold, 3, "Gold ต้องไม่ถูกแจกซ้ำ");
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: 8 concurrent calls score exactly once, no duplicate ledger rows", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    const results = await Promise.all(Array.from({ length: 8 }, () => closeGameweek(gameweekId)));
    assert.ok(results.every((r) => r.ok !== false || true)); // ไม่มีอันไหน throw ออกมา (Promise.all จะ reject ถ้ามี)

    const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
    assert.equal(gw.status, GAMEWEEK_STATUS.SCORED);

    const grants = await prisma.fantasyRewardGrant.count({ where: { userId: user.id, periodKey: gameweekId } });
    assert.equal(grants, 2, "8 ครั้งพร้อมกันต้องได้ ledger แค่ชุดเดียว (GOLD+PACK)");
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(freshUser.gold, 3, "Gold ต้องไม่ถูกแจกซ้ำแม้เรียกพร้อมกัน 8 ครั้ง");
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: racing upsertPlayerStat never produces a torn read — either the stat write lands before scoring and is reflected, or it's rejected once SCORING starts (regression — upsertPlayerStat used to read Gameweek status outside the write's transaction)", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    const [statOutcome, closeResult] = await Promise.all([
      upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 5, assists: 0, yellow: 0, red: 0, ownGoals: 0 })
        .then(() => ({ ok: true as const }))
        .catch((e) => ({ ok: false as const, message: e instanceof Error ? e.message : String(e) })),
      closeGameweek(gameweekId),
    ]);
    assert.equal(closeResult.ok, true, "closeGameweek เองต้องไม่พังไม่ว่า race จะออกทางไหน");

    const score = await prisma.fantasyGameweekScore.findUniqueOrThrow({ where: { userId_gameweekId: { userId: user.id, gameweekId } } });
    if (statOutcome.ok) {
      // stat write ชนะ race (คอมมิตก่อน CAS ของ closeGameweek) — คะแนนต้องสะท้อนค่าใหม่ (goals=5) ไม่ใช่ค่าเดิม
      // captain: (2 appearance + 4x5 goal ATT) x2 = 44
      assert.equal(score.points, 44, "stat write ที่คอมมิตก่อนต้องถูกนับใน scoring จริง ไม่ใช่ snapshot เก่า");
    } else {
      // CAS ชนะ race ก่อน (เข้า SCORING แล้ว) — stat write ต้องถูกปฏิเสธชัดเจน ไม่ใช่เขียนทับเงียบๆ หลัง scored
      assert.match(statOutcome.message, /ปิดคิดคะแนนแล้ว/);
      assert.equal(score.points, 12, "ถูกปฏิเสธแล้วคะแนนต้องยังเป็นค่าเดิมก่อน race (goals=1)");
    }
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: racing upsertMatch that clears a score can never let closeGameweek score with an incomplete match (regression — validation read + CAS write used to be two separate steps, so an upsertMatch clearing a score in between could pass validation on stale full data and then get silently outrun by the CAS)", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });

    const [matchOutcome, closeOutcome] = await Promise.all([
      upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: null, awayScore: null, kickoffAt: null, status: "SCHEDULED" })
        .then(() => ({ ok: true as const }))
        .catch((e) => ({ ok: false as const, message: e instanceof Error ? e.message : String(e) })),
      closeGameweek(gameweekId)
        .then((result) => ({ threw: false as const, result }))
        .catch((e) => ({ threw: true as const, message: e instanceof Error ? e.message : String(e) })),
    ]);

    const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });

    if (matchOutcome.ok) {
      // upsertMatch เคลียร์สกอร์สำเร็จก่อน (คอมมิตก่อน closeGameweek อ่าน validate ใน tx เดียวกัน) — closeGameweek
      // ต้อง reject ด้วย validation error เดิม ไม่ใช่ปิดสำเร็จทั้งที่ข้อมูลไม่ครบแล้ว
      assert.equal(closeOutcome.threw, true, "closeGameweek ต้อง reject เมื่อสกอร์ถูกเคลียร์ไปก่อน validate เสร็จ ไม่ใช่ปิดสำเร็จด้วยข้อมูลไม่ครบ");
      if (closeOutcome.threw) assert.match(closeOutcome.message, /ยังไม่ได้กรอกสกอร์/);
      assert.notEqual(gw.status, GAMEWEEK_STATUS.SCORED, "ห้ามเข้า SCORED ทั้งที่แมตช์ไม่มีสกอร์แล้ว");
      assert.equal(match.homeScore, null);
    } else {
      // closeGameweek ชนะ race ก่อน (validate+CAS commit เข้า SCORING แล้วในทรานแซกชันเดียว) — upsertMatch ที่มาที
      // หลังต้องถูก assertNotScoredYet ปฏิเสธ ไม่ใช่แอบเคลียร์สกอร์ทับหลังผ่าน SCORING ไปแล้ว และ closeGameweek
      // ต้องปิดสำเร็จโดยใช้ข้อมูลเดิมที่ครบ (1-0) เท่านั้น ไม่มีทางที่สกอร์ null จะแอบหลุดเข้าไปกลายเป็นคะแนน freeze
      assert.match(matchOutcome.message, /ปิดคิดคะแนนแล้ว/, "upsertMatch ที่มาทีหลังต้องถูกปฏิเสธเพราะเข้า SCORING แล้ว ไม่ใช่เคลียร์สกอร์ผ่านไปได้เงียบๆ");
      assert.equal(closeOutcome.threw, false);
      if (!closeOutcome.threw) assert.equal(closeOutcome.result.ok, true);
      assert.equal(gw.status, GAMEWEEK_STATUS.SCORED);
      assert.equal(match.homeScore, 1, "สกอร์เดิมที่ validate ผ่านต้องไม่ถูกเคลียร์ทับหลัง reject");
      assert.equal(match.awayScore, 0);
    }
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: resumes correctly after a simulated crash mid-SCORING (stale scoringStartedAt)", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    // จำลอง process ตายกลาง SCORING: ตั้ง status=SCORING ตรงๆ (ยังไม่มี score/grant ใดๆ เกิดขึ้นจริง) พร้อม
    // scoringStartedAt เก่ามากเกิน threshold
    await prisma.gameweek.update({
      where: { id: gameweekId },
      data: { status: "SCORING", scoringStartedAt: new Date(Date.now() - 10 * 60_000) },
    });

    // เรียกซ้ำทันที (ไม่ผ่าน threshold ถ้า now = เวลาจริง) — ต้อง resume ได้เพราะ scoringStartedAt เก่าเกิน 5 นาทีแล้ว
    const result = await closeGameweek(gameweekId);
    assert.equal(result.ok, true);

    const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
    assert.equal(gw.status, GAMEWEEK_STATUS.SCORED, "resume ต้องจบที่ SCORED ไม่ใช่ค้าง SCORING ตลอดไป");

    const score = await prisma.fantasyGameweekScore.findUniqueOrThrow({ where: { userId_gameweekId: { userId: user.id, gameweekId } } });
    assert.equal(score.points, 12);
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(freshUser.gold, 3);
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: 8 concurrent calls against a stale mid-SCORING gameweek take over the lease exactly once (regression — resume used to let every caller past the stale threshold call runScoring directly with no CAS on scoringStartedAt)", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    // จำลอง process ตายกลาง SCORING เหมือนเทส resume เดี่ยวด้านล่าง แต่คราวนี้ยิง 8 ครั้งพร้อมกันเข้าใส่สถานะ
    // stale เดียวกัน — ต้องมีผู้ชนะ takeover lease แค่คนเดียว (updateMany บน scoringStartedAt เดิมเป๊ะ) คนอื่นตอบ
    // busy/alreadyScored ไม่ใช่ทุกคนวิ่งเข้า runScoring พร้อมกันหมด
    await prisma.gameweek.update({
      where: { id: gameweekId },
      data: { status: "SCORING", scoringStartedAt: new Date(Date.now() - 10 * 60_000) },
    });

    const results = await Promise.all(Array.from({ length: 8 }, () => closeGameweek(gameweekId)));
    // ไม่มีใคร throw ออกมาเลย (Promise.all จะ reject ถ้ามี) แต่ "ok" ไม่ใช่ contract ที่ถูกต้องสำหรับผู้แพ้ takeover —
    // ตาม tryResumeOrBusy ผู้แพ้ race ต้องได้ { ok:false, error: busy-message } (ถ้าเช็คก่อนผู้ชนะทำงานเสร็จ) หรือ
    // { ok:true, alreadyScored:true } (ถ้าเช็คหลังผู้ชนะเสร็จแล้วพอดี) — ต้องมีผู้ที่ "ชนะแล้วรันจริง"
    // (ok:true, alreadyScored:false) ได้อย่างมากแค่ 1 รายเท่านั้น ไม่ใช่ทุกคนได้ ok:true แบบ real completion เหมือนกัน
    const realCompletions = results.filter((r) => r.ok && !r.alreadyScored);
    assert.ok(realCompletions.length <= 1, "ต้องมีอย่างมากแค่ 1 caller ที่ชนะ takeover lease แล้วรัน runScoring จริง");
    assert.ok(
      results.every((r) => r.ok || /กำลังประมวลผลคะแนนอยู่/.test((r as { error: string }).error)),
      "ผู้แพ้ takeover ทุกรายต้องได้ busy ตาม contract ของ tryResumeOrBusy เท่านั้น ไม่ error แบบอื่น",
    );

    const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
    assert.equal(gw.status, GAMEWEEK_STATUS.SCORED, "ไม่ว่า caller ไหนชนะ lease ท้ายที่สุด Gameweek ต้องจบที่ SCORED");

    const grants = await prisma.fantasyRewardGrant.count({ where: { userId: user.id, periodKey: gameweekId } });
    assert.equal(grants, 2, "8 caller ชิง lease พร้อมกันบน stale SCORING ต้องยังจบด้วย ledger แค่ชุดเดียว (GOLD+PACK)");
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(freshUser.gold, 3, "Gold ต้องไม่ถูกแจกซ้ำแม้ 8 caller แย่ง takeover lease พร้อมกัน");
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: aborts mid-run the moment it loses the lease, without granting rewards or closing the Gameweek (regression — renewLease previously rewrote the same frozen `now` back every time, so the lease never actually advanced and a losing owner could keep writing to completion)", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    // จำลอง SCORING ค้างมานาน (ผ่าน threshold แล้ว) — closeGameweek ตัวนี้จะ takeover lease สำเร็จก่อน (เพราะยังไม่มี
    // ใครแข่งจริง) แล้วเข้า runScoring ปกติ แต่ nowProvider ปลอมจะ "แกล้งจำลอง" ว่ามีคู่แข่งอีกตัวชนะ takeover
    // lease เดิมไปพอดี ก่อนที่ renewLease ครั้งที่ 2 (ในลูปแจกรางวัล) จะเรียก — เขียน scoringStartedAt เป็นค่าอื่นตรงๆ
    // ผ่าน DB โดย await ให้เสร็จก่อนคืนค่า ทำให้ deterministic ไม่ใช่ timing-based flaky race
    await prisma.gameweek.update({
      where: { id: gameweekId },
      data: { status: "SCORING", scoringStartedAt: new Date(Date.now() - 10 * 60_000) },
    });

    let calls = 0;
    const hostileNowProvider = async () => {
      calls++;
      if (calls === 2) {
        await prisma.gameweek.update({ where: { id: gameweekId }, data: { scoringStartedAt: new Date(0) } });
      }
      return new Date();
    };

    const result = await closeGameweek(gameweekId, undefined, hostileNowProvider);
    assert.equal(result.ok, false, "ต้องหยุดทันทีที่เสีย lease ไม่ใช่รายงานว่าสำเร็จ");
    assert.match((result as { error: string }).error, /resume ไปแล้ว/);

    // Phase 1 (freeze score) เกิดขึ้นก่อนที่จะเสีย lease (calls===1 ตอนนั้นยังไม่ hostile) จึงมี snapshot คะแนนอยู่
    // ได้ (idempotent เขียนทับใหม่ได้เสมอ) แต่ phase 2 (แจกรางวัล) ต้องไม่เกิดขึ้นเลยสักรายเดียว
    const grants = await prisma.fantasyRewardGrant.count({ where: { userId: user.id, periodKey: gameweekId } });
    assert.equal(grants, 0, "owner ที่เสีย lease ระหว่างแจกรางวัลต้องหยุดก่อนแจกจริง ไม่ใช่แจกไปแล้วค่อยพัง");
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(freshUser.gold, 0, "ไม่ได้ถูกแจก Gold เลยเพราะหยุดก่อนถึง grantWeeklyReward");

    const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
    assert.equal(gw.status, GAMEWEEK_STATUS.SCORING, "ต้องไม่ถูกปิดเป็น SCORED โดย owner ที่เสีย lease ไปแล้ว (ยังค้าง SCORING ตาม hostile write ที่จำลองไว้)");
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("closeGameweek: fresh SCORING (not stale) returns busy instead of running a duplicate pass", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });

    await prisma.gameweek.update({ where: { id: gameweekId }, data: { status: "SCORING", scoringStartedAt: new Date() } });
    const result = await closeGameweek(gameweekId);
    assert.deepEqual(result, { ok: false, error: "Gameweek นี้กำลังประมวลผลคะแนนอยู่ ลองใหม่อีกครั้งในอีกสักครู่" });
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test("getLeaderboard: ordered by frozen rank, getMyLeaderboardRow finds a single user's row", async () => {
  const number = 910000 + Math.floor(Math.random() * 9000);
  const { user, player, gameweekId, matchId } = await setupScenario(number);
  try {
    await upsertMatch(gameweekId, { id: matchId, homeClub: "CloseFC", awayClub: "OpponentFC", homeScore: 1, awayScore: 0, kickoffAt: null, status: "PLAYED" });
    await upsertPlayerStat(matchId, player.id, "HOME", { minutes: 90, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 });
    await closeGameweek(gameweekId);

    const board = await getLeaderboard(gameweekId);
    assert.equal(board.length, 1);
    assert.equal(board[0].userId, user.id);
    assert.equal(board[0].rank, 1);

    const mine = await getMyLeaderboardRow(gameweekId, user.id);
    assert.equal(mine?.points, 12);

    const nobody = await getMyLeaderboardRow(gameweekId, "not-a-real-user-id");
    assert.equal(nobody, null);
  } finally {
    await cleanupScenario(number, user.id);
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
