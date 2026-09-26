// Website enquiries (SYSTEM_PROMPT §5). Creating an enquiry sends a message, so
// the handler is idempotent per Idempotency-Key (§10): the same key returns the
// same enquiry rather than creating a duplicate. Keys are held in Redis (best
// effort — if Redis is down the create still succeeds).
import type {
  CreateInquiryInput,
  AdminInquiry,
  AdminClient,
  InquiryStatus,
  ConvertLeadResult,
} from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../lib/http';
import { notifyAddress, sendMail } from '../lib/mailer';
import { ENQUIRY_NOTIFY_V1 } from '../mail/templates';
import { notifyUsersWithPermission } from '../lib/notify';
import { writeAudit } from '../lib/audit';
import { PERMISSIONS } from '@somwave/shared';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24h

function toAdminInquiry(row: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: InquiryStatus;
  convertedClientId: string | null;
  createdAt: Date;
}): AdminInquiry {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status,
    convertedClientId: row.convertedClientId ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAdminClient(row: {
  id: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  status: AdminClient['status'];
  createdAt: Date;
}): AdminClient {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function createInquiry(
  input: CreateInquiryInput,
  idempotencyKey: string,
): Promise<{ id: string }> {
  if (input.website && input.website.length > 0) {
    return { id: 'ignored' };
  }
  const cacheKey = `idem:inquiry:${idempotencyKey}`;

  const existingId = await safeGet(cacheKey);
  if (existingId) return { id: existingId };

  const inquiry = await prisma.inquiry.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone && input.phone.length > 0 ? input.phone : null,
      message: input.message,
    },
    select: { id: true },
  });

  await safeSet(cacheKey, inquiry.id);
  await notifyUsersWithPermission(
    PERMISSIONS.LEADS_READ,
    'Lead cusub',
    `${input.name} wuxuu soo diray foomka xiriirka.`,
  );
  const notifyTo = notifyAddress();
  if (notifyTo) {
    await sendMail({
      to: notifyTo,
      template: ENQUIRY_NOTIFY_V1,
      vars: { name: input.name, email: input.email, message: input.message },
    });
  }
  return inquiry;
}

export async function listInquiries(): Promise<AdminInquiry[]> {
  const rows = await prisma.inquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(toAdminInquiry);
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
): Promise<AdminInquiry> {
  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) throw new AppError('NOT_FOUND', 404, 'Codsigan lama helin');
  const row = await prisma.inquiry.update({ where: { id }, data: { status } });
  return toAdminInquiry(row);
}

/** Turn a website enquiry into a client company. Repeating the call returns the same client. */
export async function convertInquiryToClient(
  id: string,
  actorId: string | null,
): Promise<ConvertLeadResult> {
  const result = await prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findUnique({ where: { id } });
    if (!inquiry) throw new AppError('NOT_FOUND', 404, 'Codsigan lama helin');

    if (inquiry.convertedClientId) {
      const linked = await tx.client.findFirst({
        where: { id: inquiry.convertedClientId, deletedAt: null },
      });
      if (linked) {
        return {
          inquiry: toAdminInquiry(inquiry),
          client: toAdminClient(linked),
          created: false,
          changed: false,
        };
      }
    }

    const existing = await tx.client.findFirst({
      where: { email: inquiry.email, deletedAt: null },
    });
    const client =
      existing ??
      (await tx.client.create({
        data: {
          companyName: inquiry.name.slice(0, 200),
          email: inquiry.email,
          phone: inquiry.phone,
          status: 'ACTIVE',
        },
      }));
    const updated = await tx.inquiry.update({
      where: { id },
      data: { convertedClientId: client.id, status: 'ARCHIVED' },
    });
    return {
      inquiry: toAdminInquiry(updated),
      client: toAdminClient(client),
      created: existing === null,
      changed: true,
    };
  });

  if (result.changed) {
    await writeAudit({
      actorId,
      action: 'lead.convert',
      subjectType: 'Inquiry',
      subjectId: id,
    });
  }
  return { inquiry: result.inquiry, client: result.client, created: result.created };
}

async function safeGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await redis.set(key, value, 'EX', IDEMPOTENCY_TTL_SECONDS);
  } catch {
    // Best-effort idempotency; ignore write failures.
  }
}
