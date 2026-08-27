-- Takedown detection. Additive and nullable, so this deploys on its own.
ALTER TABLE "Exhibition"
  ADD COLUMN "missedRuns"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "withdrawnAt" TIMESTAMP(3);

-- Listing queries filter on this constantly.
CREATE INDEX "Exhibition_withdrawnAt_idx" ON "Exhibition"("withdrawnAt");
