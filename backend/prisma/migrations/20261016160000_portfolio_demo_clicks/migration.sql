ALTER TABLE "portfolio_items"
  ADD COLUMN "demo_clicks" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "project_inquiries"
  ADD COLUMN "activation_token_hash" TEXT,
  ADD COLUMN "activation_expires_at" TIMESTAMP(3);
