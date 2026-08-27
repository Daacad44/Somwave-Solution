// Idempotent seed (SYSTEM_PROMPT §7): the fixed roles, the permission vocabulary,
// SUPER_ADMIN granted every permission, and (when SEED_ADMIN_PASSWORD is set) a
// super-admin user. Run with `npm run db:seed`.
import { PrismaClient } from '@prisma/client';
import { ROLES, PERMISSIONS } from '@somwave/shared';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Permissions.
  for (const key of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  const permissions = await prisma.permission.findMany();

  // Roles.
  for (const name of Object.values(ROLES)) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    });
  }

  // SUPER_ADMIN holds every permission.
  await prisma.role.update({
    where: { name: ROLES.SUPER_ADMIN },
    data: { permissions: { set: permissions.map((permission) => ({ id: permission.id })) } },
  });

  // Super-admin user — only when a password is provided; never a hardcoded one.
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@somwave.com';
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.warn('[seed] SEED_ADMIN_PASSWORD not set — skipped super-admin user creation.');
    return;
  }

  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.SUPER_ADMIN } });
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Super Admin', passwordHash: await hashPassword(password) },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } },
    update: {},
    create: { userId: user.id, roleId: superAdmin.id },
  });
  console.log(`[seed] Super-admin ready: ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
