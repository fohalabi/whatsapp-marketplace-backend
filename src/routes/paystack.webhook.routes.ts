import { Router } from 'express';
import { PaystackWebhookController } from '../controllers/paystack.webhook.controller';

const router = Router();
const paystackWebhookController = new PaystackWebhookController();

// Paystack webhook (no auth needed - Paystack calls this)
router.post('/webhook', (req, res) => paystackWebhookController.handleWebhook(req, res));

export default router;