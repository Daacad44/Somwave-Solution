export const INVOICE_SENT_V1 = 'invoice-sent.v1' as const;
export const ENQUIRY_NOTIFY_V1 = 'enquiry-notify.v1' as const;

export type MailTemplateId = typeof INVOICE_SENT_V1 | typeof ENQUIRY_NOTIFY_V1;

export function renderMail(
  template: MailTemplateId,
  vars: Record<string, string>,
): { subject: string; text: string } {
  if (template === INVOICE_SENT_V1) {
    return {
      subject: `Biil ${vars.number ?? ''} — Somwave`,
      text: [
        `As-salaamu calaykum,`,
        '',
        `Waxaa laguu diray biil ${vars.number ?? ''} oo dhan $${vars.total ?? '0.00'}.`,
        `Dhicitaanka: ${vars.dueDate ?? '—'}.`,
        '',
        'Mahadsanid,',
        'Somwave',
      ].join('\n'),
    };
  }
  return {
    subject: 'Codsi cusub — Somwave',
    text: [
      'Codsi cusub ayaa ka yimid websaydka.',
      '',
      `Magaca: ${vars.name ?? '—'}`,
      `Iimayl: ${vars.email ?? '—'}`,
      '',
      vars.message ?? '',
    ].join('\n'),
  };
}
