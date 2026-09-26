-- Link a website enquiry to the client created from it.
ALTER TABLE "inquiries" ADD COLUMN "converted_client_id" TEXT;

CREATE INDEX "inquiries_converted_client_id_idx" ON "inquiries"("converted_client_id");

ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_converted_client_id_fkey"
  FOREIGN KEY ("converted_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
