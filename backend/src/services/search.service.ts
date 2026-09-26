import { PERMISSIONS, ROLES, type SearchHit } from '@somwave/shared';
import { prisma } from '../lib/prisma';

export interface SearchActor {
  permissions: readonly string[];
  roles: readonly string[];
  clientId: string | null;
}

function allowed(actor: SearchActor, key: string): boolean {
  return actor.permissions.includes(key);
}

function isClient(actor: SearchActor): boolean {
  return actor.roles.includes(ROLES.CLIENT);
}

/** CLIENT rows are limited to their company. Missing clientId yields no owned hits. */
function ownedScope(actor: SearchActor): { clientId: string } | Record<string, never> | null {
  if (!isClient(actor)) return {};
  return actor.clientId ? { clientId: actor.clientId } : null;
}

const TAKE = 5;

export async function searchRecords(query: string, actor: SearchActor): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const contains = { contains: q, mode: 'insensitive' as const };
  const jobs: Array<Promise<SearchHit[]>> = [];
  const staff = !isClient(actor);

  if (staff && allowed(actor, PERMISSIONS.PROJECTS_READ)) {
    jobs.push(
      prisma.project
        .findMany({
          where: { deletedAt: null, name: contains },
          orderBy: { updatedAt: 'desc' },
          take: TAKE,
          select: { id: true, name: true, status: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'project' as const,
            title: row.name,
            subtitle: row.status,
            href: `/projects/${row.id}`,
          })),
        ),
    );
  } else if (isClient(actor) && allowed(actor, PERMISSIONS.PORTAL_READ) && actor.clientId) {
    jobs.push(
      prisma.project
        .findMany({
          where: { deletedAt: null, clientId: actor.clientId, name: contains },
          orderBy: { updatedAt: 'desc' },
          take: TAKE,
          select: { id: true, name: true, status: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'project' as const,
            title: row.name,
            subtitle: row.status,
            href: `/portal/projects/${row.id}`,
          })),
        ),
    );
  }

  if (staff && allowed(actor, PERMISSIONS.TASKS_READ)) {
    jobs.push(
      prisma.task
        .findMany({
          where: { deletedAt: null, title: contains },
          orderBy: { updatedAt: 'desc' },
          take: TAKE,
          select: { id: true, title: true, project: { select: { id: true, name: true } } },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'task' as const,
            title: row.title,
            subtitle: row.project.name,
            href: `/projects/${row.project.id}`,
          })),
        ),
    );
  }

  if (staff && allowed(actor, PERMISSIONS.CLIENTS_READ)) {
    jobs.push(
      prisma.client
        .findMany({
          where: {
            deletedAt: null,
            OR: [{ companyName: contains }, { email: contains }],
          },
          orderBy: { updatedAt: 'desc' },
          take: TAKE,
          select: { id: true, companyName: true, email: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'client' as const,
            title: row.companyName,
            subtitle: row.email,
            href: `/clients/${row.id}`,
          })),
        ),
    );
  }

  if (staff && allowed(actor, PERMISSIONS.LEADS_READ)) {
    jobs.push(
      prisma.inquiry
        .findMany({
          where: { OR: [{ name: contains }, { email: contains }] },
          orderBy: { createdAt: 'desc' },
          take: TAKE,
          select: { id: true, name: true, email: true, status: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'lead' as const,
            title: row.name,
            subtitle: row.email,
            href: '/leads',
          })),
        ),
    );
  }

  const ticketScope = ownedScope(actor);
  if (allowed(actor, PERMISSIONS.TICKETS_READ) && ticketScope !== null) {
    jobs.push(
      prisma.supportTicket
        .findMany({
          where: {
            deletedAt: null,
            ...ticketScope,
            OR: [{ subject: contains }, { code: contains }],
          },
          orderBy: { updatedAt: 'desc' },
          take: TAKE,
          select: { id: true, code: true, subject: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'ticket' as const,
            title: row.subject,
            subtitle: row.code,
            href: `/tickets/${row.id}`,
          })),
        ),
    );
  }

  const invoiceScope = ownedScope(actor);
  if (allowed(actor, PERMISSIONS.INVOICES_READ) && invoiceScope !== null) {
    jobs.push(
      prisma.invoice
        .findMany({
          where: { deletedAt: null, ...invoiceScope, number: contains },
          orderBy: { updatedAt: 'desc' },
          take: TAKE,
          select: { id: true, number: true, status: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'invoice' as const,
            title: row.number,
            subtitle: row.status,
            href: `/invoices/${row.id}`,
          })),
        ),
    );
  }

  if (staff && allowed(actor, PERMISSIONS.USERS_READ)) {
    jobs.push(
      prisma.user
        .findMany({
          where: { deletedAt: null, OR: [{ name: contains }, { email: contains }] },
          orderBy: { name: 'asc' },
          take: TAKE,
          select: { id: true, name: true, email: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'user' as const,
            title: row.name,
            subtitle: row.email,
            href: '/users',
          })),
        ),
    );
  }

  if (staff && allowed(actor, PERMISSIONS.CONTENT_READ)) {
    jobs.push(
      prisma.service
        .findMany({
          where: { title: contains },
          orderBy: { updatedAt: 'desc' },
          take: TAKE,
          select: { id: true, title: true, slug: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'service' as const,
            title: row.title,
            subtitle: row.slug,
            href: '/cms/services',
          })),
        ),
    );
    jobs.push(
      prisma.post
        .findMany({
          where: { title: contains },
          orderBy: { updatedAt: 'desc' },
          take: TAKE,
          select: { id: true, title: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'article' as const,
            title: row.title,
            subtitle: null,
            href: '/cms/posts',
          })),
        ),
    );
  }

  const documentScope = ownedScope(actor);
  if (allowed(actor, PERMISSIONS.DOCUMENTS_READ) && documentScope !== null) {
    jobs.push(
      prisma.clientDocument
        .findMany({
          where: { deletedAt: null, ...documentScope, title: contains },
          orderBy: { createdAt: 'desc' },
          take: TAKE,
          select: { id: true, title: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            type: 'document' as const,
            title: row.title,
            subtitle: null,
            href: '/documents',
          })),
        ),
    );
  }

  const groups = await Promise.all(jobs);
  return groups.flat();
}
