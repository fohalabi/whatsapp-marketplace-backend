import { Router } from 'express';
import { AbandonedOrderController } from '../controllers/abandonedOrder.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const abandonedOrderController = new AbandonedOrderController();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', (req, res) => abandonedOrderController.getAbandonedOrders(req, res));
router.get('/stats', (req, res) => abandonedOrderController.getStats(req, res));
router.post('/:orderId/resend', (req, res) => abandonedOrderController.resendPaymentLink(req, res));
router.post('/:orderId/cancel', (req, res) => abandonedOrderController.cancelOrder(req, res));
router.post('/:orderId/extend', (req, res) => abandonedOrderController.extendTimeout(req, res));

export default router;