-- Resend accepts a message before mailbox delivery. Retain its message ID for
-- troubleshooting and future webhook reconciliation without changing old rows.
ALTER TABLE "engineer_account_invitations" ADD COLUMN "provider_message_id" TEXT;
ALTER TABLE "notification_deliveries" ADD COLUMN "provider_message_id" TEXT;
