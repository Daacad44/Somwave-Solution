ALTER TABLE "portfolio_items"
  ADD COLUMN "technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "gallery_images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "completion_date" TIMESTAMP(3),
  ADD COLUMN "project_status" TEXT,
  ADD COLUMN "live_demo_url" TEXT,
  ADD COLUMN "case_study_url" TEXT,
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seo_title" TEXT,
  ADD COLUMN "seo_description" TEXT;

UPDATE "portfolio_items" SET "featured" = true WHERE "is_published" = true;
ALTER TABLE "portfolio_items" ALTER COLUMN "is_published" SET DEFAULT false;

CREATE TYPE "ProjectInquiryStatus" AS ENUM (
  'PENDING_VERIFICATION', 'EMAIL_VERIFIED', 'ACCOUNT_CREATED', 'UNDER_REVIEW',
  'PROPOSAL_SENT', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED'
);

CREATE TABLE "project_inquiries" (
  "id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "company_name" TEXT,
  "project_type" TEXT NOT NULL,
  "portfolio_item_id" TEXT,
  "description" TEXT NOT NULL,
  "desired_features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "estimated_budget" TEXT,
  "expected_timeline" TEXT,
  "status" "ProjectInquiryStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "verification_code_hash" TEXT,
  "verification_expires_at" TIMESTAMP(3),
  "verification_attempts" INTEGER NOT NULL DEFAULT 0,
  "verification_sends" INTEGER NOT NULL DEFAULT 0,
  "verification_sent_at" TIMESTAMP(3),
  "email_verified_at" TIMESTAMP(3),
  "user_id" TEXT,
  "client_id" TEXT,
  "project_id" TEXT,
  "proposal_summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_inquiries_idempotency_key_key" ON "project_inquiries"("idempotency_key");
CREATE UNIQUE INDEX "project_inquiries_project_id_key" ON "project_inquiries"("project_id");
CREATE INDEX "project_inquiries_email_created_at_idx" ON "project_inquiries"("email", "created_at");
CREATE INDEX "project_inquiries_client_id_created_at_idx" ON "project_inquiries"("client_id", "created_at");
CREATE INDEX "project_inquiries_status_created_at_idx" ON "project_inquiries"("status", "created_at");

ALTER TABLE "project_inquiries" ADD CONSTRAINT "project_inquiries_portfolio_item_id_fkey"
  FOREIGN KEY ("portfolio_item_id") REFERENCES "portfolio_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_inquiries" ADD CONSTRAINT "project_inquiries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_inquiries" ADD CONSTRAINT "project_inquiries_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_inquiries" ADD CONSTRAINT "project_inquiries_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
