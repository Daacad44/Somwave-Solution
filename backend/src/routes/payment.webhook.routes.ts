import { Router } from 'express';
import * as paymentWebhookController from '../controllers/payment.webhook.controller';

export const paymentWebhooksRouter: Router = Router();

paymentWebhooksRouter.post('/evc-plus', paymentWebhookController.evcPlusWebhook);
