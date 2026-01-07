import { Router } from 'express';
import { PayoutController } from '../controllers/payout.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const payoutController = new PayoutController();

router.get('/', authenticate, (req, res) => payoutController.getMerchantPayouts(req, res));
router.post('/:merchantId/process', authenticate, (req, res) => payoutController.processSinglePayout(req, res));
router.post('/bulk-process', authenticate, (req, res) => payoutController.processBulkPayouts(req, res));

export default router;