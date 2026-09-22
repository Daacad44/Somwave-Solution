// SMTP send helper (SYSTEM_PROMPT §14). Optional in dev/test: missing SMTP_HOST
// skips the send with a safe reason. The password is never logged.
import nodemailer from 'nodemailer';
import { env } from './env';
import { logger } from './logger';
import { renderMail, type MailTemplateId } from '../mail/templates';

export interface SendMailInput {
  to: string;
  template: MailTemplateId;
  vars: Record<string, string>;
}

export interface SendMailResult {
  sent: boolean;
  reason?: 'not_configured' | 'failed';
}

function createTransport() {
  if (!env.SMTP_HOST || !env.SMTP_FROM) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const transport = createTransport();
  if (!transport || !env.SMTP_FROM) {
    return { sent: false, reason: 'not_configured' };
  }
  const { subject, text } = renderMail(input.template, input.vars);
  try {
    await transport.sendMail({ from: env.SMTP_FROM, to: input.to, subject, text });
    return { sent: true };
  } catch (err) {
    logger.error({ err, template: input.template }, 'SMTP send failed');
    return { sent: false, reason: 'failed' };
  }
}

export function notifyAddress(): string | null {
  return env.SMTP_NOTIFY_TO ?? null;
}
