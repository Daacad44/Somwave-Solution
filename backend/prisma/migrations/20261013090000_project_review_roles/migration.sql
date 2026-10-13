-- Existing project roles retain their meaning. These are opt-in assignments
-- requiring the same invitation and acceptance workflow as engineer roles.
ALTER TYPE "ProjectMemberRole" ADD VALUE 'REVIEWER';
ALTER TYPE "ProjectMemberRole" ADD VALUE 'CONTRIBUTOR';
