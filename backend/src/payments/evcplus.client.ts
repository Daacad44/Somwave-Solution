import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../lib/http';
import { env } from '../lib/env';

export interface EvcInitiateParams {
  amount: string;
  phone: string;
  merchantReference: string;
}

export interface EvcInitiateResult {
  transactionId: string;
}

function evcConfigured(): boolean {
  return Boolean(
    env.PAYMENT_EVC_API_URL &&
    env.PAYMENT_EVC_API_KEY &&
    env.PAYMENT_EVC_MERCHANT_ID &&
    env.PAYMENT_EVC_WEBHOOK_SECRET,
  );
}

export function isEvcPlusConfigured(): boolean {
  return evcConfigured();
}

export async function initiateEvcCharge(params: EvcInitiateParams): Promise<EvcInitiateResult> {
  if (!evcConfigured()) {
    if (env.NODE_ENV === 'production') {
      throw new AppError('PAYMENT_FAILED', 502, 'EVC Plus lama habeeyin');
    }
    return { transactionId: `evc_dev_${params.merchantReference}` };
  }

  const res = await fetch(`${env.PAYMENT_EVC_API_URL}/charges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.PAYMENT_EVC_API_KEY}`,
    },
    body: JSON.stringify({
      merchantId: env.PAYMENT_EVC_MERCHANT_ID,
      amount: params.amount,
      phone: params.phone,
      reference: params.merchantReference,
    }),
  });

  const body = (await res.json().catch(() => null)) as {
    transactionId?: string;
    message?: string;
  } | null;

  if (!res.ok || !body?.transactionId) {
    throw new AppError(
      'PAYMENT_FAILED',
      502,
      body?.message ?? 'EVC Plus ma aqbalin codsiga lacag bixinta',
    );
  }

  return { transactionId: body.transactionId };
}

export function verifyEvcWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!env.PAYMENT_EVC_WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', env.PAYMENT_EVC_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  } catch {
    return false;
  }
}
