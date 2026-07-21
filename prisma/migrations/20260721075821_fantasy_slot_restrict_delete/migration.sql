-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FantasyEntrySlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fantasyPositionGroup" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "isStarter" BOOLEAN NOT NULL,
    "benchPriority" INTEGER,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "isViceCaptain" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FantasyEntrySlot_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FantasyEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FantasyEntrySlot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FantasyEntrySlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FantasyEntrySlot" ("benchPriority", "cardId", "entryId", "fantasyPositionGroup", "id", "isCaptain", "isStarter", "isViceCaptain", "playerId", "slotIndex") SELECT "benchPriority", "cardId", "entryId", "fantasyPositionGroup", "id", "isCaptain", "isStarter", "isViceCaptain", "playerId", "slotIndex" FROM "FantasyEntrySlot";
DROP TABLE "FantasyEntrySlot";
ALTER TABLE "new_FantasyEntrySlot" RENAME TO "FantasyEntrySlot";
CREATE INDEX "FantasyEntrySlot_playerId_idx" ON "FantasyEntrySlot"("playerId");
CREATE UNIQUE INDEX "FantasyEntrySlot_entryId_slotIndex_key" ON "FantasyEntrySlot"("entryId", "slotIndex");
CREATE UNIQUE INDEX "FantasyEntrySlot_entryId_cardId_key" ON "FantasyEntrySlot"("entryId", "cardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
