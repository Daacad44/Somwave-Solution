-- CreateEnum
CREATE TYPE "FinanceAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'DIRECT_COST', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinancePeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceTransactionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "finance_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceAccountType" NOT NULL,
    "currency" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allow_posting" BOOLEAN NOT NULL DEFAULT true,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_periods" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "FinancePeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_journals" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "occurred_on" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "reverses_journal_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_finalized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "finance_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_journal_lines" (
    "id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "project_id" TEXT,
    "client_id" TEXT,

    CONSTRAINT "finance_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transactions" (
    "id" TEXT NOT NULL,
    "type" "FinanceTransactionType" NOT NULL,
    "status" "FinanceTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_on" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT,
    "external_ref" TEXT,
    "project_id" TEXT,
    "client_id" TEXT,
    "counterparty" TEXT,
    "cash_account_id" TEXT NOT NULL,
    "offset_account_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "review_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "posted_journal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounts_code_key" ON "finance_accounts"("code");

-- CreateIndex
CREATE INDEX "finance_accounts_type_is_active_idx" ON "finance_accounts"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "finance_periods_year_month_key" ON "finance_periods"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "finance_journals_reference_key" ON "finance_journals"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "finance_journals_reverses_journal_id_key" ON "finance_journals"("reverses_journal_id");

-- CreateIndex
CREATE INDEX "finance_journals_occurred_on_currency_idx" ON "finance_journals"("occurred_on", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "finance_journals_source_type_source_id_key" ON "finance_journals"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "finance_journal_lines_account_id_idx" ON "finance_journal_lines"("account_id");

-- CreateIndex
CREATE INDEX "finance_journal_lines_project_id_idx" ON "finance_journal_lines"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "finance_transactions_posted_journal_id_key" ON "finance_transactions"("posted_journal_id");

CREATE UNIQUE INDEX "finance_transactions_type_external_ref_key" ON "finance_transactions"("type", "external_ref");

-- CreateIndex
CREATE INDEX "finance_transactions_status_occurred_on_idx" ON "finance_transactions"("status", "occurred_on");

-- CreateIndex
CREATE INDEX "finance_transactions_project_id_idx" ON "finance_transactions"("project_id");

-- CreateIndex
CREATE INDEX "finance_transactions_client_id_idx" ON "finance_transactions"("client_id");

-- AddForeignKey
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "finance_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_journals" ADD CONSTRAINT "finance_journals_reverses_journal_id_fkey" FOREIGN KEY ("reverses_journal_id") REFERENCES "finance_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_journal_lines" ADD CONSTRAINT "finance_journal_lines_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "finance_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_journal_lines" ADD CONSTRAINT "finance_journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "finance_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_offset_account_id_fkey" FOREIGN KEY ("offset_account_id") REFERENCES "finance_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_posted_journal_id_fkey" FOREIGN KEY ("posted_journal_id") REFERENCES "finance_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database protections apply even when a caller bypasses the API.
ALTER TABLE "finance_periods" ADD CONSTRAINT "finance_period_month_check" CHECK ("month" BETWEEN 1 AND 12);
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transaction_amount_check" CHECK ("amount" > 0);
ALTER TABLE "finance_journal_lines" ADD CONSTRAINT "finance_line_sides_check"
  CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0));
ALTER TABLE "finance_journals" ADD CONSTRAINT "finance_source_pair_check"
  CHECK (("source_type" IS NULL) = ("source_id" IS NULL));
ALTER TABLE "finance_journals" ADD CONSTRAINT "finance_no_self_reversal_check"
  CHECK ("reverses_journal_id" IS NULL OR "reverses_journal_id" <> "id");

CREATE FUNCTION finance_journal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Posted journals are immutable';
  END IF;
  IF OLD."is_finalized" OR NEW."is_finalized" IS NOT TRUE
     OR NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."reference" IS DISTINCT FROM OLD."reference"
     OR NEW."occurred_on" IS DISTINCT FROM OLD."occurred_on"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."memo" IS DISTINCT FROM OLD."memo"
     OR NEW."source_type" IS DISTINCT FROM OLD."source_type"
     OR NEW."source_id" IS DISTINCT FROM OLD."source_id"
     OR NEW."reverses_journal_id" IS DISTINCT FROM OLD."reverses_journal_id"
     OR NEW."created_by_id" IS DISTINCT FROM OLD."created_by_id"
     OR NEW."posted_at" IS DISTINCT FROM OLD."posted_at" THEN
    RAISE EXCEPTION 'Posted journals are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_journal_immutable BEFORE UPDATE OR DELETE ON "finance_journals"
  FOR EACH ROW EXECUTE FUNCTION finance_journal_guard();

CREATE FUNCTION finance_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Posted journal lines are immutable';
  END IF;
  IF (SELECT "is_finalized" FROM "finance_journals" WHERE "id" = NEW."journal_id" FOR UPDATE) THEN
    RAISE EXCEPTION 'Cannot append to a posted journal';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_line_immutable BEFORE INSERT OR UPDATE OR DELETE ON "finance_journal_lines"
  FOR EACH ROW EXECUTE FUNCTION finance_line_guard();

CREATE FUNCTION finance_journal_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  journal_key text;
  debit_total numeric;
  credit_total numeric;
  line_count integer;
  finalized boolean;
BEGIN
  IF TG_TABLE_NAME = 'finance_journals' THEN
    journal_key := NEW."id";
  ELSE
    journal_key := NEW."journal_id";
  END IF;
  SELECT "is_finalized" INTO finalized FROM "finance_journals" WHERE "id" = journal_key;
  IF finalized THEN
    SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0), COUNT(*)
      INTO debit_total, credit_total, line_count
      FROM "finance_journal_lines" WHERE "journal_id" = journal_key;
    IF line_count < 2 OR debit_total <> credit_total OR debit_total <= 0 THEN
      RAISE EXCEPTION 'Finance journal must have at least two balanced lines';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER finance_journal_balanced_on_journal
  AFTER INSERT OR UPDATE ON "finance_journals"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_journal_balanced();
CREATE CONSTRAINT TRIGGER finance_journal_balanced_on_line
  AFTER INSERT ON "finance_journal_lines"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_journal_balanced();

CREATE FUNCTION finance_open_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "finance_periods"
    WHERE "year" = EXTRACT(YEAR FROM NEW."occurred_on")
      AND "month" = EXTRACT(MONTH FROM NEW."occurred_on")
      AND "status" = 'CLOSED'
  ) THEN
    RAISE EXCEPTION 'Accounting period is closed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_open_period_before_post BEFORE INSERT ON "finance_journals"
  FOR EACH ROW EXECUTE FUNCTION finance_open_period_guard();

-- Production migrations run without the development seed. Add only the new
-- permissions and finance roles; preserve every existing role assignment.
WITH required("key") AS (
  VALUES ('finance.read'), ('finance.create'), ('finance.approve'),
         ('finance.post'), ('finance.manage')
)
INSERT INTO "permissions" ("id", "key", "created_at", "updated_at")
SELECT md5('somwave-permission:' || "key"), "key", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM required ON CONFLICT ("key") DO NOTHING;

INSERT INTO "roles" ("id", "name", "description", "is_system", "created_at", "updated_at")
VALUES
  ('system_role_finance_manager', 'FINANCE_MANAGER', 'Finance approvals and account management', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('system_role_accountant', 'ACCOUNTANT', 'Accounting records and ledger posting', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_RolePermissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE
  (r."name" = 'ADMIN' AND p."key" LIKE 'finance.%')
  OR (r."name" = 'FINANCE_MANAGER' AND p."key" IN
    ('finance.read', 'finance.create', 'finance.approve', 'finance.manage'))
  OR (r."name" = 'ACCOUNTANT' AND p."key" IN
    ('finance.read', 'finance.create', 'finance.post'))
ON CONFLICT ("A", "B") DO NOTHING;

