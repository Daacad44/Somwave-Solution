-- I8.0: audit context columns and the transactional domain-event outbox.
-- Additive only; no existing row is changed.

-- CreateEnum
CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "domain_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "project_id" TEXT,
    "payload" JSONB NOT NULL,
    "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "published_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_event_handlings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "handler" TEXT NOT NULL,
    "handled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_event_handlings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_events_published_at_created_at_idx" ON "domain_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "domain_events_status_created_at_idx" ON "domain_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "domain_events_type_aggregate_id_idx" ON "domain_events"("type", "aggregate_id");

-- CreateIndex
CREATE INDEX "domain_events_project_id_idx" ON "domain_events"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "domain_event_handlings_event_id_handler_key" ON "domain_event_handlings"("event_id", "handler");

-- AddForeignKey
ALTER TABLE "domain_event_handlings" ADD CONSTRAINT "domain_event_handlings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "domain_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

