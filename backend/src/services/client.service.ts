import type { AdminClient, CreateClientInput, UpdateClientInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

function toAdmin(row: {
  id: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  status: AdminClient['status'];
  createdAt: Date;
}): AdminClient {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listClients(): Promise<AdminClient[]> {
  const rows = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toAdmin);
}

export async function createClient(input: CreateClientInput): Promise<AdminClient> {
  const row = await prisma.client.create({
    data: {
      companyName: input.companyName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      status: input.status,
    },
  });
  return toAdmin(row);
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<AdminClient> {
  const existing = await prisma.client.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Macmiilkan lama helin');
  const row = await prisma.client.update({
    where: { id },
    data: {
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  return toAdmin(row);
}
