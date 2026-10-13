CREATE TABLE "engineer_task_timers" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stopped_at" TIMESTAMP(3),
    "entry_id" TEXT,
    CONSTRAINT "engineer_task_timers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "engineer_task_timers_user_id_started_at_idx" ON "engineer_task_timers"("user_id", "started_at");
CREATE UNIQUE INDEX "engineer_task_timers_one_active_per_user_idx" ON "engineer_task_timers"("user_id") WHERE "stopped_at" IS NULL;
ALTER TABLE "engineer_task_timers" ADD CONSTRAINT "engineer_task_timers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engineer_task_timers" ADD CONSTRAINT "engineer_task_timers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "task_time_entry_revisions" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "previous_minutes" INTEGER NOT NULL,
    "previous_date" DATE NOT NULL,
    "previous_note" TEXT,
    "minutes" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_time_entry_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_time_entry_revisions_entry_id_created_at_idx" ON "task_time_entry_revisions"("entry_id", "created_at");
ALTER TABLE "task_time_entry_revisions" ADD CONSTRAINT "task_time_entry_revisions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "task_time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_time_entry_revisions" ADD CONSTRAINT "task_time_entry_revisions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
