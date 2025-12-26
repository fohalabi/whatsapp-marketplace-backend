import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const orderController = new OrderController();

// All routes require merchant authentication
router.use(authenticate);
router.use(authorize('MERCHANT'));

// Get merchant's orders
router.get(
  '/',
  (req, res) => orderController.getMerchantOrders(req, res)
);

// Update order status
router.patch(
  '/:orderId/status',
  (req, res) => orderController.updateOrderStatus(req, res)
);

export default router;