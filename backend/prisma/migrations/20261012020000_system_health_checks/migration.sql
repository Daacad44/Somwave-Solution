CREATE TABLE "system_health_checks" (
    "id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "http_status" INTEGER,
    "response_ms" INTEGER,
    "error" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_health_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "system_health_checks_system_id_checked_at_idx" ON "system_health_checks"("system_id", "checked_at");

ALTER TABLE "system_health_checks" ADD CONSTRAINT "system_health_checks_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "managed_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
