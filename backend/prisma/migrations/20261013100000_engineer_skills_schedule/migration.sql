CREATE TYPE "EngineerSkillCategory" AS ENUM ('FRONTEND', 'BACKEND', 'MOBILE', 'DEVOPS', 'DESIGN', 'QA', 'DATABASE', 'SECURITY', 'ARCHITECTURE', 'OTHER');
CREATE TYPE "EngineerSkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

ALTER TABLE "engineer_profiles" ADD COLUMN "secondary_specializations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "engineer_skills" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "EngineerSkillCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "level" "EngineerSkillLevel" NOT NULL,
    "experience_years" DECIMAL(4,1) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "engineer_skills_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "engineer_skills_experience_years_check" CHECK ("experience_years" >= 0 AND "experience_years" <= 99.9)
);

CREATE UNIQUE INDEX "engineer_skills_user_id_name_key" ON "engineer_skills"("user_id", "name");
CREATE INDEX "engineer_skills_category_level_idx" ON "engineer_skills"("category", "level");
ALTER TABLE "engineer_skills" ADD CONSTRAINT "engineer_skills_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "engineer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "engineer_weekly_schedule" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "engineer_weekly_schedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "engineer_weekly_schedule_day_check" CHECK ("weekday" BETWEEN 1 AND 7),
    CONSTRAINT "engineer_weekly_schedule_minutes_check" CHECK ("start_minute" >= 0 AND "start_minute" < "end_minute" AND "end_minute" <= 1440)
);

CREATE UNIQUE INDEX "engineer_weekly_schedule_user_id_weekday_start_minute_key" ON "engineer_weekly_schedule"("user_id", "weekday", "start_minute");
CREATE INDEX "engineer_weekly_schedule_user_id_weekday_idx" ON "engineer_weekly_schedule"("user_id", "weekday");
ALTER TABLE "engineer_weekly_schedule" ADD CONSTRAINT "engineer_weekly_schedule_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "engineer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
