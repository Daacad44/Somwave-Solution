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

  it('gives a new engineer a single-use, time-limited verification link', () => {
    const mail = renderMail('engineer-account-invite.v1', {
      name: 'Ada',
      setupUrl: 'https://app.example.com/activate-engineer?token=example',
    });
    expect(mail.text).toContain('Ada');
    expect(mail.text).toContain('https://app.example.com/activate-engineer?token=example');
    expect(mail.text).toContain('48 hours');
    expect(mail.text).toContain('used once');
    expect(mail.subject).toBe("You're Invited to Join Somwave Solution");
    expect(mail.html).toContain('Verify email and activate');
    expect(mail.html).toContain('width:100%;max-width:600px');
  });

  it('escapes engineer-supplied content in the responsive HTML template', () => {
    const mail = renderMail('engineer-account-invite.v1', {
      name: '<script>alert(1)</script>',
      setupUrl: 'https://app.example.com/activate-engineer?token=a&next=b',
      supportEmail: 'support@example.com',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('token=a&amp;next=b');
    expect(mail.text).toContain('support@example.com');
  });
});
