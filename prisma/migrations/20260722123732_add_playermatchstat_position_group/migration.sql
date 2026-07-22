/*
  Warnings:

  - Added the required column `positionGroup` to the `PlayerMatchStat` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlayerMatchStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clubSide" TEXT NOT NULL,
    "positionGroup" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellow" INTEGER NOT NULL DEFAULT 0,
    "red" INTEGER NOT NULL DEFAULT 0,
    "ownGoals" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlayerMatchStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerMatchStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Backfill positionGroup จาก Player.position ปัจจุบัน ณ เวลารัน migration นี้ (ตารางว่างตอนเขียน migration นี้จริง
-- แต่คำนวณผ่าน join กันพังถ้ามีข้อมูลเก่าอยู่แล้วในสภาพแวดล้อมอื่น) mapping ต้องตรงกับ POSITION_GROUP ใน
-- src/lib/constants.ts เป๊ะ — หลังจากนี้ freeze ตอนกรอกใน upsertPlayerStat เท่านั้น ห้าม derive สดอีก
-- ตำแหน่งที่ไม่รู้จัก (ไม่ตรง WHEN ไหนเลย) หรือแถวกำพร้าที่ไม่มี Player ตรงกันเลย (เผื่อ FK เคยถูกปิดมาก่อน — migration
-- นี้เองก็ปิด foreign_keys ระหว่างคัดลอกเหมือนกัน) ต้อง fail ทั้ง migration ทันที ห้าม default เงียบๆ ไปเป็นค่าใดค่าหนึ่ง
-- และห้ามให้ INNER JOIN ทิ้งแถวกำพร้าแบบเงียบๆ ไปเฉยๆ — ใช้ LEFT JOIN แล้วปล่อยให้ NULL (ไม่ว่าจาก position ไม่รู้จัก
-- หรือไม่มี Player เลย) ชน NOT NULL constraint ของ positionGroup ทำให้ INSERT ล้มเห็นชัดแทนข้อมูลหาย/เพี้ยนเงียบๆ
INSERT INTO "new_PlayerMatchStat" ("assists", "clubSide", "goals", "id", "matchId", "minutes", "ownGoals", "playerId", "positionGroup", "red", "yellow")
SELECT
  s."assists", s."clubSide", s."goals", s."id", s."matchId", s."minutes", s."ownGoals", s."playerId",
  CASE p."position"
    WHEN 'GK' THEN 'GK'
    WHEN 'LB' THEN 'DEF' WHEN 'LWB' THEN 'DEF' WHEN 'CB' THEN 'DEF' WHEN 'RB' THEN 'DEF' WHEN 'RWB' THEN 'DEF'
    WHEN 'CDM' THEN 'MID' WHEN 'CM' THEN 'MID' WHEN 'CAM' THEN 'MID' WHEN 'LM' THEN 'MID' WHEN 'RM' THEN 'MID'
    WHEN 'LW' THEN 'ATT' WHEN 'RW' THEN 'ATT' WHEN 'ST' THEN 'ATT' WHEN 'CF' THEN 'ATT'
  END,
  s."red", s."yellow"
FROM "PlayerMatchStat" s
LEFT JOIN "Player" p ON p."id" = s."playerId";
DROP TABLE "PlayerMatchStat";
ALTER TABLE "new_PlayerMatchStat" RENAME TO "PlayerMatchStat";
CREATE INDEX "PlayerMatchStat_playerId_idx" ON "PlayerMatchStat"("playerId");
CREATE UNIQUE INDEX "PlayerMatchStat_matchId_playerId_key" ON "PlayerMatchStat"("matchId", "playerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
