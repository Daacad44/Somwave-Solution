import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyGitHubWebhookSignature } from './github.service';

describe('GitHub webhook signature', () => {
  const secret = 'test-webhook-secret';
  const body = Buffer.from('{"action":"opened"}');
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts only the exact signed payload', () => {
    expect(verifyGitHubWebhookSignature(body, signature, secret)).toBe(true);
    expect(
      verifyGitHubWebhookSignature(Buffer.from('{"action":"closed"}'), signature, secret),
    ).toBe(false);
  });

  it('rejects missing, malformed, and unconfigured signatures', () => {
    expect(verifyGitHubWebhookSignature(body, undefined, secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(body, 'sha256=invalid', secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(body, signature, undefined)).toBe(false);
  });
});
