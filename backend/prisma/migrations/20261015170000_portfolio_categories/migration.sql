CREATE TYPE "PortfolioCategory" AS ENUM ('WEBSITE', 'MOBILE_APP', 'CUSTOM_SOFTWARE');
ALTER TABLE "portfolio_items" ADD COLUMN "category" "PortfolioCategory";

UPDATE "portfolio_items" SET "category" = 'CUSTOM_SOFTWARE' WHERE "slug" = 'nidaamka-maamulka-iskuulka' AND "category" IS NULL;
UPDATE "portfolio_items" SET "category" = 'MOBILE_APP' WHERE "slug" = 'app-dhaqaale-mobil' AND "category" IS NULL;
