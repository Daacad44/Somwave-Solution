ALTER TABLE "password_reset_tokens" ADD COLUMN "code_hash" TEXT, ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "verified_at" TIMESTAMP(3);
CREATE TABLE "user_invitations" (
 "id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "name" TEXT NOT NULL, "role_ids" TEXT[] NOT NULL,
 "token_hash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "expires_at" TIMESTAMP(3) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 "invited_by_id" TEXT NOT NULL, "accepted_at" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "user_invitations_email_key" ON "user_invitations"("email");
CREATE UNIQUE INDEX "user_invitations_token_hash_key" ON "user_invitations"("token_hash");

ALTER TABLE "users" ADD COLUMN "sessions_revoked_at" TIMESTAMP(3);
