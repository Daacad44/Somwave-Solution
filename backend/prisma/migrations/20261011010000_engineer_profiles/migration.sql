-- CreateEnum
CREATE TYPE "EngineerAvailabilityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "engineer_profiles" (
    "user_id" TEXT NOT NULL,
    "headline" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" "EngineerAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "weekly_capacity_hours" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engineer_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "engineer_availability" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engineer_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assignment_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_assignment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engineer_availability_user_id_start_at_end_at_idx" ON "engineer_availability"("user_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "project_assignment_events_project_id_occurred_at_idx" ON "project_assignment_events"("project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "project_assignment_events_user_id_occurred_at_idx" ON "project_assignment_events"("user_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "engineer_profiles" ADD CONSTRAINT "engineer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engineer_availability" ADD CONSTRAINT "engineer_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
