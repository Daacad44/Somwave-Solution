export const INVOICE_SENT_V1 = 'invoice-sent.v1' as const;
export const ENQUIRY_NOTIFY_V1 = 'enquiry-notify.v1' as const;
export const PASSWORD_RESET_V1 = 'password-reset.v1' as const;
export const ENGINEERING_NOTIFICATION_V1 = 'engineering-notification.v1' as const;
export const ENGINEER_ACCOUNT_INVITE_V1 = 'engineer-account-invite.v1' as const;

export type MailTemplateId =
  | typeof INVOICE_SENT_V1
  | typeof ENQUIRY_NOTIFY_V1
  | typeof PASSWORD_RESET_V1
  | typeof ENGINEERING_NOTIFICATION_V1
  | typeof ENGINEER_ACCOUNT_INVITE_V1;

export function renderMail(
  template: MailTemplateId,
  vars: Record<string, string>,
): { subject: string; text: string } {
  if (template === ENGINEERING_NOTIFICATION_V1) {
    return {
      subject: vars.subject ?? 'Somwave engineering notification',
      text: [vars.message ?? '', ...(vars.url ? ['', vars.url] : []), '', 'Somwave'].join('\n'),
    };
  }
  if (template === ENGINEER_ACCOUNT_INVITE_V1) {
    return {
      subject: `Set up your Somwave engineer account`,
      text: [
        `Hello ${vars.name ?? 'engineer'},`,
        '',
        'Somwave Solution has invited you to join the engineering workspace.',
        `Verify your email address and activate your account within 48 hours: ${vars.setupUrl ?? ''}`,
        'The link can be used once. You will set a password, or confirm your existing account password, during activation.',
        'After activation, sign in to review any pending project assignments.',
        '',
        'If you did not expect this invitation, ignore this message and do not share the link.',
        '',
        'Somwave Solution',
      ].join('\n'),
    };
  }
  if (template === PASSWORD_RESET_V1) {
    return {
      subject: 'Reset your password — Somwave',
      text: [
        'Hello,',
        '',
        'We received a request to reset your account password.',
        `Open this link within one hour: ${vars.resetUrl ?? ''}`,
        '',
        'If you did not request this, you can ignore this email.',
        '',
        'Somwave',
      ].join('\n'),
    };
  }
  if (template === INVOICE_SENT_V1) {
    return {
      subject: `Invoice ${vars.number ?? ''} — Somwave`,
      text: [
        'Hello,',
        '',
        `Invoice ${vars.number ?? ''} for $${vars.total ?? '0.00'} is ready.`,
        `Due date: ${vars.dueDate ?? '—'}.`,
        '',
        'Thank you,',
        'Somwave',
      ].join('\n'),
    };
  }
  return {
    subject: 'New enquiry — Somwave',
    text: [
      'A new enquiry was submitted through the website.',
      '',
      `Name: ${vars.name ?? '—'}`,
      `Email: ${vars.email ?? '—'}`,
      '',
      vars.message ?? '',
    ].join('\n'),
  };
}
