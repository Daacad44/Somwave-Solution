CREATE TABLE "milestone_dependencies" (
  "id" TEXT NOT NULL,
  "milestone_id" TEXT NOT NULL,
  "depends_on_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "milestone_dependencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "milestone_dependencies_milestone_id_depends_on_id_key" ON "milestone_dependencies"("milestone_id", "depends_on_id");
CREATE INDEX "milestone_dependencies_depends_on_id_idx" ON "milestone_dependencies"("depends_on_id");
ALTER TABLE "milestone_dependencies" ADD CONSTRAINT "milestone_dependencies_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "milestone_dependencies" ADD CONSTRAINT "milestone_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
