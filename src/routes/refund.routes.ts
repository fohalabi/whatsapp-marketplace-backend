import { Router } from 'express';
import { RefundController } from '../controllers/refund.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const refundController = new RefundController();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', (req, res) => refundController.getAllRefunds(req, res));
router.patch('/:orderId/approve', (req, res) => refundController.approveRefund(req, res));
router.patch('/:orderId/reject', (req, res) => refundController.rejectRefund(req, res));
router.post('/:orderId/process', (req, res) => refundController.processRefund(req, res));

export default router;