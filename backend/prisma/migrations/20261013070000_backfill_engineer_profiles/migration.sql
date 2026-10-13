-- Include pre-existing engineer identities in the account directory without
-- changing their roles, credentials, or project memberships.
INSERT INTO "engineer_profiles" ("user_id", "updated_at")
SELECT DISTINCT ur."user_id", CURRENT_TIMESTAMP
FROM "user_roles" ur
JOIN "roles" r ON r."id" = ur."role_id"
WHERE r."name" IN ('ENGINEER', 'LEAD_ENGINEER', 'QA_ENGINEER')
ON CONFLICT ("user_id") DO NOTHING;

UPDATE "engineer_profiles" ep SET "status" = 'DEACTIVATED'
FROM "users" u WHERE ep."user_id" = u."id" AND u."is_active" = false;
