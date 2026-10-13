CREATE TYPE "EngineerAccountStatus" AS ENUM ('INVITED', 'PENDING_VERIFICATION', 'PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "EngineerInvitationStatus" AS ENUM ('INVITED', 'VERIFIED', 'ACTIVATED', 'CANCELLED');

ALTER TABLE "engineer_profiles"
  ADD COLUMN "status" "EngineerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "job_title" TEXT,
  ADD COLUMN "specialization" TEXT,
  ADD COLUMN "experience_level" TEXT,
  ADD COLUMN "employment_type" TEXT;

CREATE TABLE "engineer_account_invitations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "invited_by_id" TEXT NOT NULL,
  "was_existing_user" BOOLEAN NOT NULL DEFAULT false,
  "token_hash" TEXT NOT NULL,
  "activation_token_hash" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "activation_expires_at" TIMESTAMP(3),
  "verified_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "last_sent_at" TIMESTAMP(3),
  "send_count" INTEGER NOT NULL DEFAULT 0,
  "delivery_status" TEXT NOT NULL DEFAULT 'PENDING',
  "status" "EngineerInvitationStatus" NOT NULL DEFAULT 'INVITED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "engineer_account_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "engineer_account_invitations_user_id_key" ON "engineer_account_invitations"("user_id");
CREATE UNIQUE INDEX "engineer_account_invitations_token_hash_key" ON "engineer_account_invitations"("token_hash");
CREATE UNIQUE INDEX "engineer_account_invitations_activation_token_hash_key" ON "engineer_account_invitations"("activation_token_hash");
CREATE INDEX "engineer_account_invitations_expires_at_idx" ON "engineer_account_invitations"("expires_at");
ALTER TABLE "engineer_account_invitations" ADD CONSTRAINT "engineer_account_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
