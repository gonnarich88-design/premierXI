// src/lib/notifications.test.ts — รัน: DATABASE_URL="file:./dev.db?connection_limit=1" npx tsx --test src/lib/notifications.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { createNotificationOnce } from "./notifications";

async function makeUser(tag: string) {
  const username = `noti_${tag}`;
  return prisma.user.create({ data: { username, phone: username, passwordHash: "x" } });
}

test("createNotificationOnce: calling twice with the same idempotencyKey creates only one row", async () => {
  const user = await makeUser(`once_${Date.now()}_${Math.floor(Math.random() * 9000)}`);
  const key = `test:once:${user.id}`;
  try {
    await prisma.$transaction((tx) =>
      createNotificationOnce({ userId: user.id, type: "FANTASY_SCORE", title: "A", body: "first", idempotencyKey: key }, tx),
    );
    await prisma.$transaction((tx) =>
      createNotificationOnce({ userId: user.id, type: "FANTASY_SCORE", title: "A", body: "second", idempotencyKey: key }, tx),
    );

    const rows = await prisma.notification.findMany({ where: { idempotencyKey: key } });
    assert.equal(rows.length, 1, "ต้องมีแค่ 1 แถวไม่ว่าจะเรียกกี่ครั้งด้วย key เดิม");
    assert.equal(rows[0].body, "first", "retry ต้องไม่เขียนทับ body เดิม (update: {})");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("createNotificationOnce: retry does not reset read/createdAt of the existing row", async () => {
  const user = await makeUser(`retry_${Date.now()}_${Math.floor(Math.random() * 9000)}`);
  const key = `test:retry:${user.id}`;
  try {
    await prisma.$transaction((tx) =>
      createNotificationOnce({ userId: user.id, type: "FANTASY_SCORE", title: "A", idempotencyKey: key }, tx),
    );
    const original = await prisma.notification.findUniqueOrThrow({ where: { idempotencyKey: key } });
    await prisma.notification.update({ where: { id: original.id }, data: { read: true } });

    await prisma.$transaction((tx) =>
      createNotificationOnce({ userId: user.id, type: "FANTASY_SCORE", title: "A", idempotencyKey: key }, tx),
    );
    const after = await prisma.notification.findUniqueOrThrow({ where: { idempotencyKey: key } });
    assert.equal(after.id, original.id);
    assert.equal(after.read, true, "retry ต้องไม่ reset read กลับเป็น false");
    assert.deepEqual(after.createdAt, original.createdAt, "retry ต้องไม่เปลี่ยน createdAt");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("createNotificationOnce: different keys each create their own row", async () => {
  const user = await makeUser(`multi_${Date.now()}_${Math.floor(Math.random() * 9000)}`);
  try {
    await prisma.$transaction((tx) =>
      createNotificationOnce({ userId: user.id, type: "FANTASY_SCORE", title: "A", idempotencyKey: `test:multi:${user.id}:1` }, tx),
    );
    await prisma.$transaction((tx) =>
      createNotificationOnce({ userId: user.id, type: "FANTASY_SCORE", title: "A", idempotencyKey: `test:multi:${user.id}:2` }, tx),
    );

    const count = await prisma.notification.count({ where: { userId: user.id } });
    assert.equal(count, 2, "key ต่างกันต้องสร้างได้ครบทุกแถว");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("createNotificationOnce: concurrent calls with the same key never produce duplicate rows", async () => {
  const user = await makeUser(`race_${Date.now()}_${Math.floor(Math.random() * 9000)}`);
  const key = `test:race:${user.id}`;
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        prisma.$transaction((tx) => createNotificationOnce({ userId: user.id, type: "FANTASY_SCORE", title: "A", idempotencyKey: key }, tx)),
      ),
    );
    assert.ok(results.every((r) => r.status === "fulfilled"), "upsert ต้องไม่ throw แม้แข่งกันพร้อมกัน");

    const count = await prisma.notification.count({ where: { idempotencyKey: key } });
    assert.equal(count, 1, "8 ครั้งพร้อมกันด้วย key เดิมต้องได้แค่ 1 แถว");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
