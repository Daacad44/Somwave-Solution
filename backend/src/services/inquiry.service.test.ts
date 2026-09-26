import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => {
  const db = {
    inquiry: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    client: { findFirst: vi.fn(), create: vi.fn() },
  };
  return {
    prisma: {
      ...db,
      $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
    },
  };
});
vi.mock('../lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../lib/notify', () => ({ notifyUsersWithPermission: vi.fn() }));
vi.mock('../lib/mailer', () => ({ notifyAddress: vi.fn(), sendMail: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn() }));

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { writeAudit } from '../lib/audit';
import {
  convertInquiryToClient,
  createInquiry,
  listInquiries,
  updateInquiryStatus,
} from './inquiry.service';

const input = { name: 'Cali', email: 'cali@example.com', message: 'Fariin dheer oo ansax ah.' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createInquiry', () => {
  it('creates the enquiry and records the idempotency key on a first request', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(prisma.inquiry.create).mockResolvedValue({ id: 'inq_1' } as never);

    const result = await createInquiry(input, 'key-1');

    expect(result).toEqual({ id: 'inq_1' });
    expect(prisma.inquiry.create).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledWith('idem:inquiry:key-1', 'inq_1', 'EX', 60 * 60 * 24);
  });

  it('ignores a honeypot submission without writing a row', async () => {
    const result = await createInquiry({ ...input, website: 'https://spam.example' }, 'bot-1');
    expect(result).toEqual({ id: 'ignored' });
    expect(prisma.inquiry.create).not.toHaveBeenCalled();
  });

  it('returns the existing enquiry for a repeated key without creating again', async () => {
    vi.mocked(redis.get).mockResolvedValue('inq_1');

    const result = await createInquiry(input, 'key-1');

    expect(result).toEqual({ id: 'inq_1' });
    expect(prisma.inquiry.create).not.toHaveBeenCalled();
  });
});

describe('listInquiries', () => {
  it('returns ISO dates for the admin inbox', async () => {
    vi.mocked(prisma.inquiry.findMany).mockResolvedValue([
      {
        id: 'inq_1',
        name: 'Cali',
        email: 'cali@example.com',
        phone: null,
        message: 'Fariin',
        status: 'NEW',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ] as never);

    const result = await listInquiries();

    expect(result[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result[0]?.status).toBe('NEW');
  });
});

describe('convertInquiryToClient', () => {
  const inquiry = {
    id: 'inq_1',
    name: 'Cali',
    email: 'cali@example.com',
    phone: null,
    message: 'Fariin',
    status: 'NEW' as const,
    convertedClientId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const client = {
    id: 'cl_1',
    companyName: 'Cali',
    email: 'cali@example.com',
    phone: null,
    status: 'ACTIVE' as const,
    createdAt: new Date('2026-01-02T00:00:00Z'),
  };

  it('creates a client and archives the enquiry', async () => {
    vi.mocked(prisma.inquiry.findUnique).mockResolvedValue(inquiry as never);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.client.create).mockResolvedValue(client as never);
    vi.mocked(prisma.inquiry.update).mockResolvedValue({
      ...inquiry,
      status: 'ARCHIVED',
      convertedClientId: 'cl_1',
    } as never);

    const result = await convertInquiryToClient('inq_1', 'user_1');

    expect(result.created).toBe(true);
    expect(result.client.id).toBe('cl_1');
    expect(result.inquiry.status).toBe('ARCHIVED');
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'lead.convert', subjectId: 'inq_1' }),
    );
  });

  it('returns the existing client without creating another', async () => {
    vi.mocked(prisma.inquiry.findUnique).mockResolvedValue({
      ...inquiry,
      status: 'ARCHIVED',
      convertedClientId: 'cl_1',
    } as never);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(client as never);

    const result = await convertInquiryToClient('inq_1', 'user_1');

    expect(result.created).toBe(false);
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when the enquiry is missing', async () => {
    vi.mocked(prisma.inquiry.findUnique).mockResolvedValue(null as never);
    await expect(convertInquiryToClient('missing', 'user_1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('updateInquiryStatus', () => {
  it('throws NOT_FOUND when the enquiry is missing', async () => {
    vi.mocked(prisma.inquiry.findUnique).mockResolvedValue(null as never);
    await expect(updateInquiryStatus('missing', 'READ')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
