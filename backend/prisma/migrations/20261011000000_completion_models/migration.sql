-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('EPIC', 'TASK', 'SUBTASK');

-- AlterTable
ALTER TABLE "bug_reports" ADD COLUMN     "resolution_due_at" TIMESTAMP(3),
ADD COLUMN     "responded_at" TIMESTAMP(3),
ADD COLUMN     "response_due_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "system_updates" ADD COLUMN     "production_approved_at" TIMESTAMP(3),
ADD COLUMN     "production_approved_by_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "blocked_reason" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "kind" "TaskKind" NOT NULL DEFAULT 'TASK',
ADD COLUMN     "phase_id" TEXT,
ADD COLUMN     "progress_percent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qa_verified_at" TIMESTAMP(3),
ADD COLUMN     "qa_verified_by_id" TEXT;

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_phases" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentation_comments" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documentation_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklist_items" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_progress_reports" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "progress_percent" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_progress_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_transitions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "from_status" "TaskStatus" NOT NULL,
    "to_status" "TaskStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_dedupe_key_key" ON "notification_deliveries"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_event_key_key" ON "notification_preferences"("user_id", "event_key");

-- CreateIndex
CREATE INDEX "project_phases_project_id_order_idx" ON "project_phases"("project_id", "order");

-- CreateIndex
CREATE INDEX "documentation_comments_document_id_created_at_idx" ON "documentation_comments"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "task_checklist_items_task_id_order_idx" ON "task_checklist_items"("task_id", "order");

-- CreateIndex
CREATE INDEX "task_progress_reports_task_id_created_at_idx" ON "task_progress_reports"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_transitions_task_id_created_at_idx" ON "task_transitions"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "tasks_phase_id_idx" ON "tasks"("phase_id");

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_qa_verified_by_id_fkey" FOREIGN KEY ("qa_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_comments" ADD CONSTRAINT "documentation_comments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_documentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_comments" ADD CONSTRAINT "documentation_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_reports" ADD CONSTRAINT "task_progress_reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_reports" ADD CONSTRAINT "task_progress_reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transitions" ADD CONSTRAINT "task_transitions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transitions" ADD CONSTRAINT "task_transitions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_updates" ADD CONSTRAINT "system_updates_production_approved_by_id_fkey" FOREIGN KEY ("production_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
