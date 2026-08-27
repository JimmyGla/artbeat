-- Crash reports and product events.
--
-- No foreign key to "User" on purpose: installId is a random per-install UUID,
-- not an account id. Linking the two would make these rows personal data and
-- would silently leave DELETE /users/me incomplete.
CREATE TABLE "TelemetryEvent" (
  "id"         TEXT NOT NULL,
  "kind"       TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "installId"  TEXT NOT NULL,
  "platform"   TEXT NOT NULL,
  "appVersion" TEXT NOT NULL,
  "message"    TEXT,
  "stack"      TEXT,
  "props"      JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelemetryEvent_kind_createdAt_idx" ON "TelemetryEvent"("kind", "createdAt");
CREATE INDEX "TelemetryEvent_name_createdAt_idx" ON "TelemetryEvent"("name", "createdAt");

-- Only the two kinds the client can produce. Anything else is a bug or an
-- attempt to write arbitrary rows through a public, unauthenticated endpoint.
ALTER TABLE "TelemetryEvent"
  ADD CONSTRAINT "TelemetryEvent_kind_check" CHECK ("kind" IN ('error', 'event'));
