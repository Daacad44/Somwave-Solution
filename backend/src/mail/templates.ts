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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });
}

export function renderMail(
  template: MailTemplateId,
  vars: Record<string, string>,
): { subject: string; text: string; html?: string } {
  if (template === ENGINEERING_NOTIFICATION_V1) {
    return {
      subject: vars.subject ?? 'Somwave engineering notification',
      text: [vars.message ?? '', ...(vars.url ? ['', vars.url] : []), '', 'Somwave'].join('\n'),
    };
  }
  if (template === ENGINEER_ACCOUNT_INVITE_V1) {
    const name = vars.name ?? 'engineer';
    const setupUrl = vars.setupUrl ?? '';
    const supportEmail = vars.supportEmail ?? '';
    return {
      subject: "You're Invited to Join Somwave Solution",
      text: [
        `Hello ${name},`,
        '',
        'Somwave Solution has invited you to join the engineering workspace.',
        `Verify your email address and activate your account within 48 hours: ${setupUrl}`,
        'The link can be used once. You will set a password, or confirm your existing account password, during activation.',
        'After activation, sign in to review any pending project assignments.',
        '',
        'If you did not expect this invitation, ignore this message and do not share the link.',
        ...(supportEmail ? [`For help, contact ${supportEmail}.`] : []),
        '',
        'Somwave Solution',
      ].join('\n'),
      html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Somwave Solution invitation</title></head><body style="margin:0;padding:24px 12px;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#1c2938"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dce4ed;border-radius:8px"><tr><td style="padding:28px 32px;border-bottom:1px solid #dce4ed"><strong style="color:#1458a5;font-size:20px">Somwave Solution</strong></td></tr><tr><td style="padding:32px"><h1 style="font-size:24px;line-height:1.3;margin:0 0 20px">You're invited to join our engineering workspace</h1><p style="font-size:16px;line-height:1.6">Hello ${escapeHtml(name)},</p><p style="font-size:16px;line-height:1.6">Somwave Solution has invited you to create your engineer account. Verify your email address and activate your account using the secure link below.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="background:#1458a5;border-radius:6px"><a href="${escapeHtml(setupUrl)}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold">Verify email and activate</a></td></tr></table><p style="font-size:14px;line-height:1.6">This invitation expires in <strong>48 hours</strong> and the link can be used only once. During activation you will set a password, or confirm the password for your existing account.</p><p style="font-size:14px;line-height:1.6;word-break:break-all">If the button does not work, copy this link into your browser:<br><a href="${escapeHtml(setupUrl)}" style="color:#1458a5">${escapeHtml(setupUrl)}</a></p><p style="font-size:14px;line-height:1.6;color:#566274">If you did not expect this invitation, ignore this email. Do not share the activation link.${supportEmail ? ` For help, contact <a href="mailto:${escapeHtml(supportEmail)}" style="color:#1458a5">${escapeHtml(supportEmail)}</a>.` : ''}</p></td></tr><tr><td style="padding:20px 32px;border-top:1px solid #dce4ed;color:#697788;font-size:12px">Somwave Solution · Secure engineering access</td></tr></table></body></html>`,
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
