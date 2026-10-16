-- Only sessions created after a successful 2FA challenge carry finance access.
-- Existing refresh sessions remain usable elsewhere but cannot acquire finance
-- access through refresh alone.
ALTER TABLE "refresh_tokens" ADD COLUMN "mfa_verified_at" TIMESTAMP(3);
