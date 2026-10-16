ALTER TABLE "project_inquiries"
  ADD COLUMN "attachment_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "project_inquiry_attachments" (
  "id" TEXT NOT NULL,
  "inquiry_id" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_inquiry_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_inquiry_attachments_storage_key_key"
  ON "project_inquiry_attachments"("storage_key");
CREATE UNIQUE INDEX "project_inquiry_attachments_inquiry_id_content_hash_key"
  ON "project_inquiry_attachments"("inquiry_id", "content_hash");
CREATE INDEX "project_inquiry_attachments_inquiry_id_created_at_idx"
  ON "project_inquiry_attachments"("inquiry_id", "created_at");

ALTER TABLE "project_inquiry_attachments"
  ADD CONSTRAINT "project_inquiry_attachments_inquiry_id_fkey"
  FOREIGN KEY ("inquiry_id") REFERENCES "project_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
