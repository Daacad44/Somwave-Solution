import { describe, it, expect } from 'vitest';
import { renderMail } from './templates';

describe('mail templates', () => {
  it('renders invoice-sent.v1 without leaking secrets', () => {
    const mail = renderMail('invoice-sent.v1', {
      number: 'INV-2026-0001',
      total: '30.00',
      dueDate: '2026-12-15',
    });
    expect(mail.subject).toContain('INV-2026-0001');
    expect(mail.text).toContain('$30.00');
  });

  it('renders enquiry-notify.v1', () => {
    const mail = renderMail('enquiry-notify.v1', {
      name: 'Hodan',
      email: 'h@example.com',
      message: 'Salaan',
    });
    expect(mail.text).toContain('Hodan');
    expect(mail.text).toContain('Salaan');
  });
});
