ALTER TABLE "audit_logs"
  ADD COLUMN "correlation_id" TEXT,
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB;

CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");
