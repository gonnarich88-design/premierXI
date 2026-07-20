-- CreateTable
CREATE TABLE "AchievementProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" DATETIME,
    CONSTRAINT "AchievementProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "silver" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "packTicket" INTEGER NOT NULL DEFAULT 0,
    "shards" INTEGER NOT NULL DEFAULT 0,
    "evoShards" INTEGER NOT NULL DEFAULT 0,
    "primeShards" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_User" ("createdAt", "evoMilestoneClaimed", "evoShards", "exp", "gold", "hasDeposited", "id", "isAdmin", "lastClaimDate", "lastLoginAt", "lastReadNewsAt", "level", "loginStreak", "packTicket", "passwordHash", "phone", "pityCounter", "primeMilestoneClaimed", "primeShards", "pvpMatchesDate", "pvpMatchesToday", "pvpRP", "pvpSeasonKey", "pvpWinStreak", "shards", "silver", "starterClaimed", "totalLogins", "username") SELECT "createdAt", "evoMilestoneClaimed", "evoShards", "exp", "gold", "hasDeposited", "id", "isAdmin", "lastClaimDate", "lastLoginAt", "lastReadNewsAt", "level", "loginStreak", "packTicket", "passwordHash", "phone", "pityCounter", "primeMilestoneClaimed", "primeShards", "pvpMatchesDate", "pvpMatchesToday", "pvpRP", "pvpSeasonKey", "pvpWinStreak", "shards", "silver", "starterClaimed", "totalLogins", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AchievementProgress_userId_idx" ON "AchievementProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementProgress_userId_achievementKey_key" ON "AchievementProgress"("userId", "achievementKey");
