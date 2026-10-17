-- ImageKit media metadata. Additive only: existing rows keep their storage key
-- and remain readable through the legacy provider; provider stays NULL for them.
ALTER TABLE "media_assets" ADD COLUMN "provider" TEXT,
ADD COLUMN "provider_file_id" TEXT,
ADD COLUMN "url" TEXT,
ADD COLUMN "width" INTEGER,
ADD COLUMN "height" INTEGER,
ADD COLUMN "folder" TEXT,
ADD COLUMN "legacy_storage_key" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "media_assets_provider_file_id_key" ON "media_assets"("provider_file_id");

CREATE INDEX "media_assets_provider_idx" ON "media_assets"("provider");
