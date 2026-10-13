ALTER TYPE "ProjectInvitationStatus" ADD VALUE 'EXPIRED';

ALTER TABLE "project_invitations"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "start_date" TIMESTAMP(3),
  ADD COLUMN "expected_end_date" TIMESTAMP(3),
  ADD COLUMN "estimated_hours" DECIMAL(8,2),
  ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "manager_notes" TEXT,
  ADD COLUMN "expires_at" TIMESTAMP(3);

ALTER TABLE "project_members"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "start_date" TIMESTAMP(3),
  ADD COLUMN "expected_end_date" TIMESTAMP(3),
  ADD COLUMN "estimated_hours" DECIMAL(8,2),
  ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "manager_notes" TEXT;

-- Existing memberships remain historical active memberships; they are never
-- rewritten as newly accepted invitations. New invitations carry an expiry.
CREATE TABLE "project_handovers" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "from_user_id" TEXT NOT NULL,
  "to_user_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "checklist" JSONB NOT NULL,
  "transferred_task_count" INTEGER NOT NULL DEFAULT 0,
  "transferred_bug_count" INTEGER NOT NULL DEFAULT 0,
  "transferred_maintenance_count" INTEGER NOT NULL DEFAULT 0,
  "transferred_document_count" INTEGER NOT NULL DEFAULT 0,
  "transferred_release_count" INTEGER NOT NULL DEFAULT 0,
  "source_removed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_handovers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_handovers_project_id_created_at_idx" ON "project_handovers"("project_id", "created_at");
CREATE INDEX "project_handovers_from_user_id_created_at_idx" ON "project_handovers"("from_user_id", "created_at");
CREATE INDEX "project_handovers_to_user_id_created_at_idx" ON "project_handovers"("to_user_id", "created_at");
