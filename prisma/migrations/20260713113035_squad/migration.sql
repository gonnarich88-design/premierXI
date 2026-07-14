-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "formation" TEXT NOT NULL DEFAULT '4-3-3',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Squad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SquadSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "squadId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "cardId" TEXT,
    CONSTRAINT "SquadSlot_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SquadSlot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Squad_userId_key" ON "Squad"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadSlot_squadId_index_key" ON "SquadSlot"("squadId", "index");
