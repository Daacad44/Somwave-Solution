import type { NextFunction, Request, Response } from 'express';
import { evcWebhookPayloadSchema } from '@somwave/shared';
import { AppError, sendData } from '../lib/http';
import { verifyEvcWebhookSignature } from '../payments/evcplus.client';
import * as paymentService from '../services/payment.service';

export async function evcPlusWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Webhook body invalid');
    }
    const signature = req.header('X-EVC-Signature');
    if (!verifyEvcWebhookSignature(raw, signature)) {
      throw new AppError('UNAUTHORIZED', 401, 'Webhook signature invalid');
    }

    const parsed = evcWebhookPayloadSchema.safeParse(JSON.parse(raw.toString('utf8')));
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Webhook payload invalid');
    }

    const result = await paymentService.applyEvcWebhook(parsed.data);
    if (!result) {
      throw new AppError('NOT_FOUND', 404, 'Lacag bixintan lama helin');
    }
    sendData(res, result);
  } catch (err) {
    next(err);
  }
}
