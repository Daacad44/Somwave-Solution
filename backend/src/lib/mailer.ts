import { Resend } from 'resend';
import { env } from './env';
import { logger } from './logger';
import { renderMail, type MailTemplateId } from '../mail/templates';

export interface SendMailInput {
  to: string;
  template: MailTemplateId;
  vars: Record<string, string>;
  /** Stable per business event/attempt; Resend suppresses duplicate accepted sends. */
  idempotencyKey?: string;
}

export interface SendMailResult {
  /** True means Resend accepted the request, not that a mailbox delivered it. */
  sent: boolean;
  providerMessageId?: string;
  reason?: 'not_configured' | 'invalid_credentials' | 'invalid_sender' | 'rate_limited' | 'failed';
}

export function emailReadiness(requireAppUrl = false) {
  const missing: string[] = [];
  if (!env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!env.EMAIL_FROM) missing.push('EMAIL_FROM');
  if (requireAppUrl && !env.APP_PUBLIC_URL) missing.push('APP_PUBLIC_URL');
  return { provider: 'resend' as const, configured: missing.length === 0, missing };
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (!emailReadiness().configured) return { sent: false, reason: 'not_configured' };
  const { subject, text, html } = renderMail(input.template, input.vars);
  try {
    const response = await new Resend(env.RESEND_API_KEY!).emails.send(
      { from: env.EMAIL_FROM!, to: input.to, subject, text, ...(html ? { html } : {}) },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    if (response.error || !response.data?.id) {
      const name = response.error?.name ?? 'application_error';
      const normalizedName = name.toLowerCase();
      logger.warn({ template: input.template, providerError: name }, 'Resend rejected email');
      return {
        sent: false,
        reason:
          normalizedName === 'rate_limit_exceeded'
            ? 'rate_limited'
            : normalizedName === 'invalid_api_key' || normalizedName === 'missing_api_key'
              ? 'invalid_credentials'
              : normalizedName === 'invalid_from_address' || normalizedName === 'validation_error'
                ? 'invalid_sender'
                : 'failed',
      };
    }
    return { sent: true, providerMessageId: response.data.id };
  } catch (error) {
    // Never log raw responses or credentials.
    logger.error(
      { template: input.template, errorName: error instanceof Error ? error.name : 'unknown' },
      'Resend request failed',
    );
    return { sent: false, reason: 'failed' };
  }
}

export function notifyAddress(): string | null {
  return env.EMAIL_NOTIFY_TO ?? null;
}
