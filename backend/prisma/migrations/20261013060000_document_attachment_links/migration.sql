CREATE TABLE "document_attachment_links" (
    "document_id" TEXT NOT NULL,
    "file_document_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_attachment_links_pkey" PRIMARY KEY ("document_id","file_document_id")
);

CREATE INDEX "document_attachment_links_file_document_id_idx"
ON "document_attachment_links"("file_document_id");

ALTER TABLE "document_attachment_links" ADD CONSTRAINT "document_attachment_links_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "project_documentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_attachment_links" ADD CONSTRAINT "document_attachment_links_file_document_id_fkey"
FOREIGN KEY ("file_document_id") REFERENCES "project_documentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
