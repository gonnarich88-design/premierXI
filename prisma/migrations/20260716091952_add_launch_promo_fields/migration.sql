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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);
INSERT INTO "new_User" ("createdAt", "evoShards", "exp", "gold", "id", "isAdmin", "lastClaimDate", "lastLoginAt", "lastReadNewsAt", "level", "loginStreak", "packTicket", "passwordHash", "phone", "pityCounter", "primeShards", "shards", "silver", "starterClaimed", "username") SELECT "createdAt", "evoShards", "exp", "gold", "id", "isAdmin", "lastClaimDate", "lastLoginAt", "lastReadNewsAt", "level", "loginStreak", "packTicket", "passwordHash", "phone", "pityCounter", "primeShards", "shards", "silver", "starterClaimed", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
