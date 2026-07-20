-- CreateTable
CREATE TABLE "Gameweek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "deadline" DATETIME NOT NULL,
    "monthKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "scoringStartedAt" DATETIME,
    "scoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameweekId" TEXT NOT NULL,
    "homeClub" TEXT NOT NULL,
    "awayClub" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "kickoffAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "providerFixtureId" TEXT,
    CONSTRAINT "Match_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerMatchStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clubSide" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellow" INTEGER NOT NULL DEFAULT 0,
    "red" INTEGER NOT NULL DEFAULT 0,
    "ownGoals" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlayerMatchStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerMatchStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FantasyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FantasyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FantasyEntry_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FantasyEntrySlot" (
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
    CONSTRAINT "FantasyEntrySlot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FantasyEntrySlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FantasyGameweekScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "rank" INTEGER,
    "rewardTier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FantasyGameweekScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FantasyGameweekScore_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FantasyRewardGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "amount" INTEGER,
    "packId" TEXT,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FantasyRewardGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FantasySettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Gameweek_number_key" ON "Gameweek"("number");

-- CreateIndex
CREATE INDEX "Gameweek_status_idx" ON "Gameweek"("status");

-- CreateIndex
CREATE INDEX "Gameweek_monthKey_idx" ON "Gameweek"("monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "Match_providerFixtureId_key" ON "Match"("providerFixtureId");

-- CreateIndex
CREATE INDEX "Match_gameweekId_idx" ON "Match"("gameweekId");

-- CreateIndex
CREATE INDEX "PlayerMatchStat_playerId_idx" ON "PlayerMatchStat"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchStat_matchId_playerId_key" ON "PlayerMatchStat"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "FantasyEntry_gameweekId_idx" ON "FantasyEntry"("gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyEntry_userId_gameweekId_key" ON "FantasyEntry"("userId", "gameweekId");

-- CreateIndex
CREATE INDEX "FantasyEntrySlot_playerId_idx" ON "FantasyEntrySlot"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyEntrySlot_entryId_slotIndex_key" ON "FantasyEntrySlot"("entryId", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyEntrySlot_entryId_cardId_key" ON "FantasyEntrySlot"("entryId", "cardId");

-- CreateIndex
CREATE INDEX "FantasyGameweekScore_gameweekId_points_idx" ON "FantasyGameweekScore"("gameweekId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyGameweekScore_userId_gameweekId_key" ON "FantasyGameweekScore"("userId", "gameweekId");

-- CreateIndex
CREATE INDEX "FantasyRewardGrant_periodType_periodKey_idx" ON "FantasyRewardGrant"("periodType", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyRewardGrant_userId_periodType_periodKey_rewardType_key" ON "FantasyRewardGrant"("userId", "periodType", "periodKey", "rewardType");

-- CreateIndex
CREATE UNIQUE INDEX "FantasySettlement_periodType_periodKey_key" ON "FantasySettlement"("periodType", "periodKey");
