CREATE TYPE "ProjectExpenseKind" AS ENUM ('PLANNED', 'ACTUAL');

CREATE TABLE "project_expenses" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "kind" "ProjectExpenseKind" NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "expense_date" TIMESTAMP(3),
  "actor_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "project_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_expenses_project_id_deleted_at_kind_idx" ON "project_expenses"("project_id", "deleted_at", "kind");
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_budget_revisions" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "previous_budget" DECIMAL(12,2),
  "new_budget" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_budget_revisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_budget_revisions_project_id_created_at_idx" ON "project_budget_revisions"("project_id", "created_at");
ALTER TABLE "project_budget_revisions" ADD CONSTRAINT "project_budget_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
