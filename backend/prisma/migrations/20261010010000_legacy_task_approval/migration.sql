-- Tasks created before engineering proposals did not have a review state.
-- Their reporter_id is null, while engineering proposals always record one.
-- Preserve those tasks as actionable work for their assigned engineers.
UPDATE "tasks"
SET "approval_status" = 'APPROVED',
    "review_required" = false
WHERE "reporter_id" IS NULL
  AND "approval_status" = 'DRAFT'
  AND "review_required" = true;
