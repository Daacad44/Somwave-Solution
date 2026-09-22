-- AlterTable
ALTER TABLE "payments" ADD COLUMN "gateway_ref" TEXT,
ADD COLUMN "payer_phone" TEXT;

CREATE INDEX "payments_gateway_ref_idx" ON "payments"("gateway_ref");
