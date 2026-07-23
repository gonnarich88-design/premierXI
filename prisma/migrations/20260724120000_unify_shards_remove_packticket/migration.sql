-- Unify shards/evoShards/primeShards into a single `shards` pool, drop packTicket (unused legacy field).
-- Backfill is embedded in the single INSERT ... SELECT below (reads old columns from "User",
-- writes once into "new_User") so re-running this migration from scratch never double-adds values.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "teamName" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "silver" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "shards" INTEGER NOT NULL DEFAULT 0,
    "pityCounter" INTEGER NOT NULL DEFAULT 0,
    "loginStreak" INTEGER NOT NULL DEFAULT 0,
    "lastClaimDate" DATETIME,
    "totalLogins" INTEGER NOT NULL DEFAULT 0,
    "starterClaimed" BOOLEAN NOT NULL DEFAULT false,
    "evoMilestoneClaimed" BOOLEAN NOT NULL DEFAULT false,
    "primeMilestoneClaimed" BOOLEAN NOT NULL DEFAULT false,
    "hasDeposited" BOOLEAN NOT NULL DEFAULT false,
    "lastReadNewsAt" DATETIME,
    "pvpRP" INTEGER NOT NULL DEFAULT 0,
    "pvpSeasonKey" TEXT,
    "pvpWinStreak" INTEGER NOT NULL DEFAULT 0,
    "pvpMatchesToday" INTEGER NOT NULL DEFAULT 0,
    "pvpMatchesDate" DATETIME,
    "totalPacksOpened" INTEGER NOT NULL DEFAULT 0,
    "pvpTotalWins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);
INSERT INTO "new_User" ("id", "username", "teamName", "phone", "passwordHash", "isAdmin", "level", "exp", "silver", "gold", "shards", "pityCounter", "loginStreak", "lastClaimDate", "totalLogins", "starterClaimed", "evoMilestoneClaimed", "primeMilestoneClaimed", "hasDeposited", "lastReadNewsAt", "pvpRP", "pvpSeasonKey", "pvpWinStreak", "pvpMatchesToday", "pvpMatchesDate", "totalPacksOpened", "pvpTotalWins", "createdAt", "lastLoginAt")
SELECT "id", "username", "teamName", "phone", "passwordHash", "isAdmin", "level", "exp", "silver", "gold",
    "shards" + "evoShards" + "primeShards",
    "pityCounter", "loginStreak", "lastClaimDate", "totalLogins", "starterClaimed", "evoMilestoneClaimed", "primeMilestoneClaimed", "hasDeposited", "lastReadNewsAt", "pvpRP", "pvpSeasonKey", "pvpWinStreak", "pvpMatchesToday", "pvpMatchesDate", "totalPacksOpened", "pvpTotalWins", "createdAt", "lastLoginAt"
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
