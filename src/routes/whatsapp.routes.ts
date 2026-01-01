import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const whatsappController = new WhatsAppController();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.post('/send-message', (req, res) => whatsappController.sendMessage(req, res));

export default router;