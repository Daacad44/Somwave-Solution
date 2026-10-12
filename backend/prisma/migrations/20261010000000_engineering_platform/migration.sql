-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FEATURE', 'BUG_FIX', 'IMPROVEMENT', 'RESEARCH', 'DESIGN', 'TESTING', 'DOCUMENTATION', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('MANAGER', 'LEAD_ENGINEER', 'ENGINEER', 'QA_ENGINEER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DocumentationFormat" AS ENUM ('MARKDOWN', 'RICH_TEXT', 'FILE');

-- CreateEnum
CREATE TYPE "DocumentationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SystemUpdateCategory" AS ENUM ('NEW_FEATURE', 'SECURITY_PATCH', 'BUG_FIX', 'PERFORMANCE_OPTIMIZATION', 'UI_UX_UPDATE', 'DATABASE_MIGRATION', 'DEPENDENCY_UPGRADE', 'INFRASTRUCTURE_CHANGE');

-- CreateEnum
CREATE TYPE "SystemUpdateStatus" AS ENUM ('REQUESTED', 'APPROVED', 'ASSIGNED', 'IN_DEVELOPMENT', 'CODE_REVIEW', 'TESTING', 'STAGING', 'PRODUCTION_APPROVAL', 'DEPLOYED', 'VERIFIED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'DEPLOYED', 'VERIFIED', 'ROLLED_BACK', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('REPORTED', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'CODE_REVIEW', 'TESTING', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'SCHEDULED', 'SECURITY_PATCH', 'HEALTH_CHECK', 'INCIDENT');

-- CreateEnum
CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GitHubConnectionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "GitHubLinkKind" AS ENUM ('ISSUE', 'BRANCH', 'COMMIT', 'PULL_REQUEST', 'CHECK_RUN', 'RELEASE');

-- CreateEnum
CREATE TYPE "GitHubWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'BACKLOG';
ALTER TYPE "TaskStatus" ADD VALUE 'BLOCKED';
ALTER TYPE "TaskStatus" ADD VALUE 'TESTING';
ALTER TYPE "TaskStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "acceptance_criteria" TEXT,
ADD COLUMN     "approval_status" "TaskApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "code" TEXT,
ADD COLUMN     "estimated_hours" DECIMAL(8,2),
ADD COLUMN     "milestone_id" TEXT,
ADD COLUMN     "parent_task_id" TEXT,
ADD COLUMN     "reporter_id" TEXT,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "review_required" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT,
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "type" "TaskType" NOT NULL DEFAULT 'FEATURE';

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'ENGINEER',
    "responsibilities" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documentation" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "folder" TEXT,
    "format" "DocumentationFormat" NOT NULL DEFAULT 'MARKDOWN',
    "content" TEXT,
    "storage_key" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "status" "DocumentationStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "owner_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_documentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentation_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "storage_key" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "status" "DocumentationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_task_links" (
    "document_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,

    CONSTRAINT "document_task_links_pkey" PRIMARY KEY ("document_id","task_id")
);

-- CreateTable
CREATE TABLE "document_milestone_links" (
    "document_id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,

    CONSTRAINT "document_milestone_links_pkey" PRIMARY KEY ("document_id","milestone_id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "task_id" TEXT NOT NULL,
    "depends_on_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("task_id","depends_on_id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_time_entries" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reviews" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "status" "TaskApprovalStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_systems" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "client_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "technology_stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "production_url" TEXT,
    "staging_url" TEXT,
    "github_repository_id" TEXT,
    "hosting_provider" TEXT,
    "current_version" TEXT,
    "assigned_engineer_id" TEXT,
    "maintenance_status" "MaintenanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_update_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "managed_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_updates" (
    "id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "SystemUpdateCategory" NOT NULL,
    "status" "SystemUpdateStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_update_tasks" (
    "update_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,

    CONSTRAINT "system_update_tasks_pkey" PRIMARY KEY ("update_id","task_id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "notes" TEXT,
    "change_history" TEXT,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'PLANNED',
    "owner_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "deployed_at" TIMESTAMP(3),
    "rollback_plan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_tasks" (
    "release_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,

    CONSTRAINT "release_tasks_pkey" PRIMARY KEY ("release_id","task_id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "deployed_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "system_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "BugStatus" NOT NULL DEFAULT 'REPORTED',
    "environment" TEXT,
    "reproduction_steps" TEXT,
    "expected_result" TEXT,
    "actual_result" TEXT,
    "error_logs" TEXT,
    "attachment_key" TEXT,
    "root_cause" TEXT,
    "assignee_id" TEXT,
    "github_issue_url" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MaintenanceType" NOT NULL,
    "status" "MaintenanceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "assignee_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "recurrence_rule" TEXT,
    "response_due_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "root_cause" TEXT,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_installations" (
    "id" TEXT NOT NULL,
    "installation_id" TEXT NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_type" TEXT,
    "status" "GitHubConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "connected_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_repositories" (
    "id" TEXT NOT NULL,
    "installation_id" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "default_branch" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT true,
    "project_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_task_links" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "kind" "GitHubLinkKind" NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "number" INTEGER,
    "state" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_task_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_webhook_events" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "action" TEXT,
    "status" "GitHubWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "repository_id" TEXT,
    "payload" JSONB,
    "error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "github_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_members_user_id_removed_at_idx" ON "project_members"("user_id", "removed_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_documentation_project_id_status_idx" ON "project_documentation"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_documentation_project_id_category_idx" ON "project_documentation"("project_id", "category");

-- CreateIndex
CREATE INDEX "project_documentation_owner_id_idx" ON "project_documentation"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_versions_document_id_version_key" ON "documentation_versions"("document_id", "version");

-- CreateIndex
CREATE INDEX "document_task_links_task_id_idx" ON "document_task_links"("task_id");

-- CreateIndex
CREATE INDEX "document_milestone_links_milestone_id_idx" ON "document_milestone_links"("milestone_id");

-- CreateIndex
CREATE INDEX "task_dependencies_depends_on_id_idx" ON "task_dependencies"("depends_on_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_attachments_storage_key_key" ON "task_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "task_attachments_task_id_idx" ON "task_attachments"("task_id");

-- CreateIndex
CREATE INDEX "task_time_entries_task_id_date_idx" ON "task_time_entries"("task_id", "date");

-- CreateIndex
CREATE INDEX "task_time_entries_user_id_date_idx" ON "task_time_entries"("user_id", "date");

-- CreateIndex
CREATE INDEX "task_reviews_task_id_created_at_idx" ON "task_reviews"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "managed_systems_project_id_maintenance_status_idx" ON "managed_systems"("project_id", "maintenance_status");

-- CreateIndex
CREATE INDEX "managed_systems_client_id_idx" ON "managed_systems"("client_id");

-- CreateIndex
CREATE INDEX "managed_systems_assigned_engineer_id_idx" ON "managed_systems"("assigned_engineer_id");

-- CreateIndex
CREATE INDEX "system_updates_system_id_status_idx" ON "system_updates"("system_id", "status");

-- CreateIndex
CREATE INDEX "system_updates_project_id_created_at_idx" ON "system_updates"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "system_update_tasks_task_id_idx" ON "system_update_tasks"("task_id");

-- CreateIndex
CREATE INDEX "releases_project_id_status_idx" ON "releases"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "releases_system_id_version_key" ON "releases"("system_id", "version");

-- CreateIndex
CREATE INDEX "release_tasks_task_id_idx" ON "release_tasks"("task_id");

-- CreateIndex
CREATE INDEX "deployments_release_id_created_at_idx" ON "deployments"("release_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bug_reports_code_key" ON "bug_reports"("code");

-- CreateIndex
CREATE INDEX "bug_reports_project_id_status_idx" ON "bug_reports"("project_id", "status");

-- CreateIndex
CREATE INDEX "bug_reports_system_id_severity_idx" ON "bug_reports"("system_id", "severity");

-- CreateIndex
CREATE INDEX "bug_reports_assignee_id_idx" ON "bug_reports"("assignee_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_project_id_status_idx" ON "maintenance_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_requests_system_id_scheduled_at_idx" ON "maintenance_requests"("system_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "maintenance_requests_assignee_id_idx" ON "maintenance_requests"("assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_installations_installation_id_key" ON "github_installations"("installation_id");

-- CreateIndex
CREATE INDEX "github_installations_account_login_status_idx" ON "github_installations"("account_login", "status");

-- CreateIndex
CREATE UNIQUE INDEX "github_repositories_github_id_key" ON "github_repositories"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_repositories_full_name_key" ON "github_repositories"("full_name");

-- CreateIndex
CREATE INDEX "github_repositories_project_id_is_active_idx" ON "github_repositories"("project_id", "is_active");

-- CreateIndex
CREATE INDEX "github_task_links_task_id_kind_idx" ON "github_task_links"("task_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "github_task_links_repository_id_kind_external_id_key" ON "github_task_links"("repository_id", "kind", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_webhook_events_delivery_id_key" ON "github_webhook_events"("delivery_id");

-- CreateIndex
CREATE INDEX "github_webhook_events_status_received_at_idx" ON "github_webhook_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_code_key" ON "tasks"("code");

-- CreateIndex
CREATE INDEX "tasks_milestone_id_idx" ON "tasks"("milestone_id");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "tasks_reporter_id_idx" ON "tasks"("reporter_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documentation" ADD CONSTRAINT "project_documentation_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documentation" ADD CONSTRAINT "project_documentation_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documentation" ADD CONSTRAINT "project_documentation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documentation" ADD CONSTRAINT "project_documentation_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documentation" ADD CONSTRAINT "project_documentation_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_documentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_task_links" ADD CONSTRAINT "document_task_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_documentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_task_links" ADD CONSTRAINT "document_task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_milestone_links" ADD CONSTRAINT "document_milestone_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_documentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_milestone_links" ADD CONSTRAINT "document_milestone_links_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviews" ADD CONSTRAINT "task_reviews_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviews" ADD CONSTRAINT "task_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviews" ADD CONSTRAINT "task_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_systems" ADD CONSTRAINT "managed_systems_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_systems" ADD CONSTRAINT "managed_systems_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_systems" ADD CONSTRAINT "managed_systems_github_repository_id_fkey" FOREIGN KEY ("github_repository_id") REFERENCES "github_repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_systems" ADD CONSTRAINT "managed_systems_assigned_engineer_id_fkey" FOREIGN KEY ("assigned_engineer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_updates" ADD CONSTRAINT "system_updates_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "managed_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_updates" ADD CONSTRAINT "system_updates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_update_tasks" ADD CONSTRAINT "system_update_tasks_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "system_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_update_tasks" ADD CONSTRAINT "system_update_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "managed_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "managed_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "managed_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_connected_by_id_fkey" FOREIGN KEY ("connected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "github_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_task_links" ADD CONSTRAINT "github_task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_task_links" ADD CONSTRAINT "github_task_links_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_webhook_events" ADD CONSTRAINT "github_webhook_events_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
