import { createHmac } from 'node:crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    PAYMENT_EVC_API_URL: undefined,
    PAYMENT_EVC_API_KEY: undefined,
    PAYMENT_EVC_MERCHANT_ID: undefined,
    PAYMENT_EVC_WEBHOOK_SECRET: 'test-webhook-secret-16',
  },
}));

import { initiateEvcCharge, verifyEvcWebhookSignature } from './evcplus.client';

describe('evcplus.client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a dev transaction id when EVC is not configured', async () => {
    const result = await initiateEvcCharge({
      amount: '10.00',
      phone: '+252612345678',
      merchantReference: 'pay_1',
    });
    expect(result.transactionId).toContain('evc_dev_');
  });

  it('verifies webhook HMAC signatures', () => {
    const body = Buffer.from(JSON.stringify({ transactionId: 'tx_1', status: 'SUCCESS' }));
    const sig = createHmac('sha256', 'test-webhook-secret-16').update(body).digest('hex');
    expect(verifyEvcWebhookSignature(body, sig)).toBe(true);
    expect(verifyEvcWebhookSignature(body, 'bad')).toBe(false);
  });
});
