-- Accounting periods follow the Africa/Mogadishu business calendar (UTC+03:00,
-- no DST). occurred_on is stored in UTC, so a date entered as the 1st of a month
-- (00:00 +03:00) is 21:00 UTC on the previous day and was matched to the
-- previous, possibly closed, period. Shift by three hours before extracting.
-- Function body only; existing journals and periods are unchanged.
CREATE OR REPLACE FUNCTION finance_open_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "finance_periods"
    WHERE "year" = EXTRACT(YEAR FROM NEW."occurred_on" + INTERVAL '3 hours')
      AND "month" = EXTRACT(MONTH FROM NEW."occurred_on" + INTERVAL '3 hours')
      AND "status" = 'CLOSED'
  ) THEN
    RAISE EXCEPTION 'Accounting period is closed';
  END IF;
  RETURN NEW;
END;
$$;
