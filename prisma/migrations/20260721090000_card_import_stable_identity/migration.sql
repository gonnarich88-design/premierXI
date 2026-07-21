-- CreateIndex
CREATE UNIQUE INDEX "Card_playerId_category_key" ON "Card"("playerId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_club_key" ON "Player"("name", "club");
