-- Production may have run migrations without the development seed. Make the
-- canonical engineer role available before activation, without touching users,
-- existing role memberships, or administrator permissions.
INSERT INTO "roles" ("id", "name", "description", "is_system", "created_at", "updated_at")
VALUES ('system_role_engineer', 'ENGINEER', 'Engineering team member', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "is_system" = true,
  "description" = COALESCE("roles"."description", EXCLUDED."description");

WITH required("key") AS (
  VALUES
    ('projects.read'), ('tasks.read'), ('tasks.create'), ('tasks.update'),
    ('milestones.read'), ('engineering.read'), ('engineering.tasks.create'),
    ('project-documentation.read'), ('notifications.read')
)
INSERT INTO "permissions" ("id", "key", "created_at", "updated_at")
SELECT md5('somwave-permission:' || "key"), "key", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM required
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "_RolePermissions" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p CROSS JOIN "roles" r
WHERE r."name" = 'ENGINEER'
  AND p."key" IN (
    'projects.read', 'tasks.read', 'tasks.create', 'tasks.update',
    'milestones.read', 'engineering.read', 'engineering.tasks.create',
    'project-documentation.read', 'notifications.read'
  )
ON CONFLICT ("A", "B") DO NOTHING;
