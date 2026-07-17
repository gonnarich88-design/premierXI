-- CreateTable
CREATE TABLE "MissionProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "missionKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MissionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MissionProgress_userId_periodKey_idx" ON "MissionProgress"("userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "MissionProgress_userId_missionKey_periodKey_key" ON "MissionProgress"("userId", "missionKey", "periodKey");
