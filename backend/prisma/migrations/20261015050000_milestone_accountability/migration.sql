ALTER TABLE "milestones" ADD COLUMN "owner_id" TEXT;
ALTER TABLE "milestones" ADD COLUMN "verified_by_id" TEXT;
ALTER TABLE "milestones" ADD COLUMN "verified_at" TIMESTAMP(3);
CREATE INDEX "milestones_owner_id_idx" ON "milestones"("owner_id");
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
