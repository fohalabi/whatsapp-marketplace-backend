import { Router } from 'express';
import { PaystackWebhookController } from '../controllers/paystack.webhook.controller';
import { paystackIPWhitelist } from '../middleware/webhookSecurity.middleware';
import { webhookRateLimiter } from '../middleware/webhookRateLimit.middleware';

const router = Router();
const paystackWebhookController = new PaystackWebhookController();

router.post('/webhook', webhookRateLimiter, paystackIPWhitelist, paystackWebhookController.handleWebhook);

export default router;