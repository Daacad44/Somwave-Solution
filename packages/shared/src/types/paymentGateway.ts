import type { PaymentRecord, RecordPaymentInput } from '../schemas/payment';

/** Input passed to a payment gateway adapter (backend implements charge). */
export interface PaymentGatewayChargeInput extends RecordPaymentInput {
  actorId: string;
  idempotencyKey: string;
  /** EVC Plus payer mobile (required when method is EVC_PLUS). */
  payerPhone?: string;
}

export interface PaymentGateway {
  charge(input: PaymentGatewayChargeInput): Promise<PaymentRecord>;
}
