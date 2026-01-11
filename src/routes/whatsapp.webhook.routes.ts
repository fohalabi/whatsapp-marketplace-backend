import { Router } from 'express';
import { WhatsAppWebhookController } from '../controllers/whatsapp.webhook.controller';
import { webhookRateLimiter } from '../middleware/webhookRateLimit.middleware';

const router = Router();
const webhookController = new WhatsAppWebhookController();

// GET for webhook verification
router.get('/webhook', (req, res) => webhookController.verifyWebhook(req, res));

// POST for receiving messages
router.post('/webhook', webhookRateLimiter, (req, res) => webhookController.receiveMessage(req, res));

export default router;