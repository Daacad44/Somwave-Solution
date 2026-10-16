-- An account's identity and classification determine historical statements.
-- Once any journal line references it, changing those fields would rewrite
-- past reports even though journal lines themselves remain immutable.
CREATE FUNCTION finance_account_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE has_lines boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM "finance_journal_lines" WHERE "account_id" = OLD."id"
  ) INTO has_lines;
  IF NOT has_lines THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Accounts used by posted journals cannot be deleted';
  END IF;
  IF NEW."code" IS DISTINCT FROM OLD."code"
     OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."parent_id" IS DISTINCT FROM OLD."parent_id" THEN
    RAISE EXCEPTION 'Historical account classification is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_account_history_immutable
  BEFORE UPDATE OR DELETE ON "finance_accounts"
  FOR EACH ROW EXECUTE FUNCTION finance_account_history_guard();
