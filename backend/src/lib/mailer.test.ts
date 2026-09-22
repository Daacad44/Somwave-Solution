import { describe, it, expect } from 'vitest';
import { sendMail } from './mailer';

describe('sendMail', () => {
  it('skips when SMTP is not configured', async () => {
    const result = await sendMail({
      to: 'client@example.com',
      template: 'invoice-sent.v1',
      vars: { number: 'INV-1', total: '10.00', dueDate: '2026-12-15' },
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('not_configured');
  });
});
