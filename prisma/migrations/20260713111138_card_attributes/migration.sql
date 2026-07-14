-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'normal',
    "position" TEXT NOT NULL,
    "ovr" INTEGER NOT NULL,
    "pace" INTEGER NOT NULL,
    "shooting" INTEGER NOT NULL,
    "passing" INTEGER NOT NULL,
    "dribbling" INTEGER NOT NULL,
    "defending" INTEGER NOT NULL,
    "physical" INTEGER NOT NULL,
    "altPositions" TEXT,
    "foot" TEXT,
    "skillMoves" INTEGER,
    "weakFoot" INTEGER,
    "indexRating" REAL,
    "imageUrl" TEXT,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Card_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Card" ("createdAt", "defending", "dribbling", "id", "imageUrl", "isStarter", "ovr", "pace", "passing", "physical", "playerId", "position", "shooting", "tier") SELECT "createdAt", "defending", "dribbling", "id", "imageUrl", "isStarter", "ovr", "pace", "passing", "physical", "playerId", "position", "shooting", "tier" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE INDEX "Card_tier_idx" ON "Card"("tier");
CREATE INDEX "Card_category_idx" ON "Card"("category");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
