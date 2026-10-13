CREATE TYPE "EngineerReportPeriod" AS ENUM ('DAILY', 'WEEKLY');
CREATE TYPE "EngineerReportStatus" AS ENUM ('SUBMITTED', 'CLARIFICATION_REQUESTED', 'REVIEWED');

CREATE TABLE "engineer_progress_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "period" "EngineerReportPeriod" NOT NULL,
    "period_start" DATE NOT NULL,
    "completed_work" TEXT NOT NULL,
    "in_progress_work" TEXT,
    "blockers" TEXT,
    "next_planned_work" TEXT,
    "milestone_progress" TEXT,
    "priorities" TEXT,
    "hours_worked_minutes" INTEGER,
    "status" "EngineerReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "review_note" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "engineer_progress_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "engineer_progress_reports_project_id_author_id_period_period_start_key" ON "engineer_progress_reports"("project_id", "author_id", "period", "period_start");
CREATE INDEX "engineer_progress_reports_project_id_period_start_idx" ON "engineer_progress_reports"("project_id", "period_start");
ALTER TABLE "engineer_progress_reports" ADD CONSTRAINT "engineer_progress_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engineer_progress_reports" ADD CONSTRAINT "engineer_progress_reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "engineer_progress_reports" ADD CONSTRAINT "engineer_progress_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
