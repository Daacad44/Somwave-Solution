CREATE TYPE "DocumentPlanStatus" AS ENUM ('PROPOSED', 'ACTIVATED', 'REJECTED');

CREATE TABLE "document_plan_proposals" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "source_version" INTEGER NOT NULL,
    "plan" JSONB NOT NULL,
    "status" "DocumentPlanStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposed_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_plan_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_plan_proposals_document_id_status_created_at_idx"
ON "document_plan_proposals"("document_id", "status", "created_at");

ALTER TABLE "document_plan_proposals" ADD CONSTRAINT "document_plan_proposals_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "project_documentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
