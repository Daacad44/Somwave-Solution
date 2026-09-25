import { prisma } from './prisma';

export async function notifyUsersWithPermission(
  permissionKey: string,
  title: string,
  body: string,
): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roles: { some: { role: { permissions: { some: { key: permissionKey } } } } },
    },
    select: { id: true },
  });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((user) => ({ userId: user.id, title, body })),
  });
}
