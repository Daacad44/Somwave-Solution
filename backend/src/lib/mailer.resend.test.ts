import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  env: {
    RESEND_API_KEY: undefined as string | undefined,
    EMAIL_FROM: undefined as string | undefined,
    APP_PUBLIC_URL: undefined as string | undefined,
    EMAIL_NOTIFY_TO: undefined as string | undefined,
  },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
vi.mock('./env', () => ({ env: mocks.env }));
vi.mock('./logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import { emailReadiness, sendMail } from './mailer';

const invoice = {
  to: 'client@example.com',
  template: 'invoice-sent.v1' as const,
  vars: { number: 'INV-1', total: '10.00', dueDate: '2026-12-15' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.RESEND_API_KEY = undefined;
  mocks.env.EMAIL_FROM = undefined;
  mocks.env.APP_PUBLIC_URL = undefined;
  mocks.env.EMAIL_NOTIFY_TO = undefined;
});

describe('Resend transactional mailer', () => {
  it('reports each missing registration setting without exposing any secret', () => {
    expect(emailReadiness(true)).toEqual({
      provider: 'resend',
      configured: false,
      missing: ['RESEND_API_KEY', 'EMAIL_FROM', 'APP_PUBLIC_URL'],
    });
    mocks.env.RESEND_API_KEY = 'test-secret-key';
    expect(emailReadiness(true).missing).toEqual(['EMAIL_FROM', 'APP_PUBLIC_URL']);
    mocks.env.EMAIL_FROM = 'Somwave Solution <noreply@botandev.com>';
    expect(emailReadiness(true).missing).toEqual(['APP_PUBLIC_URL']);
    mocks.env.APP_PUBLIC_URL = 'https://app.somwave.botandev.com';
    expect(emailReadiness(true)).toEqual({ provider: 'resend', configured: true, missing: [] });
  });

  it('does not call the provider without the API key or sender', async () => {
    expect(await sendMail(invoice)).toEqual({ sent: false, reason: 'not_configured' });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('sends the existing template through Resend and returns its message ID', async () => {
    mocks.env.RESEND_API_KEY = 'test-secret-key';
    mocks.env.EMAIL_FROM = 'Somwave Solution <noreply@botandev.com>';
    mocks.send.mockResolvedValue({ data: { id: 'resend-message-1' }, error: null });
    expect(await sendMail({ ...invoice, idempotencyKey: 'invoice:1' })).toEqual({
      sent: true,
      providerMessageId: 'resend-message-1',
    });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: mocks.env.EMAIL_FROM,
        to: invoice.to,
        subject: expect.stringContaining('INV-1'),
      }),
      { idempotencyKey: 'invoice:1' },
    );
  });

  it.each([
    ['invalid_api_Key', 'invalid_credentials'],
    ['invalid_from_address', 'invalid_sender'],
    ['rate_limit_exceeded', 'rate_limited'],
  ] as const)('classifies provider rejection %s safely', async (name, reason) => {
    mocks.env.RESEND_API_KEY = 'test-secret-key';
    mocks.env.EMAIL_FROM = 'Somwave Solution <noreply@botandev.com>';
    mocks.send.mockResolvedValue({ data: null, error: { name, message: 'provider details' } });
    expect(await sendMail(invoice)).toEqual({ sent: false, reason });
  });

  it('reports transport errors without logging credentials', async () => {
    mocks.env.RESEND_API_KEY = 'test-secret-key';
    mocks.env.EMAIL_FROM = 'Somwave Solution <noreply@botandev.com>';
    mocks.send.mockRejectedValue(new Error('transport failed'));
    expect(await sendMail(invoice)).toEqual({ sent: false, reason: 'failed' });
  });
});
