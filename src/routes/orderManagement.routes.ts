import { Router } from 'express';
import { OrderManagementController } from '../controllers/orderManagement.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const orderController = new OrderManagementController();

// All routes require authentication
router.use(authenticate);

// Admin routes
router.get('/admin/orders', authorize('ADMIN', 'MANAGER'), (req, res) => orderController.getAllOrders(req, res));
router.get('/admin/orders/stats', authorize('ADMIN', 'MANAGER'), (req, res) => orderController.getOrderStats(req, res));
router.get('/admin/orders/:orderId', authorize('ADMIN', 'MANAGER'), (req, res) => orderController.getOrderById(req, res));
router.put('/admin/orders/:orderId/status', authorize('ADMIN', 'MANAGER'), (req, res) => orderController.updateOrderStatus(req, res));
router.post('/admin/orders/:orderId/assign-courier', authorize('ADMIN', 'MANAGER'), (req, res) => orderController.assignCourier(req, res));
router.post('/admin/orders/:orderId/cancel', authorize('ADMIN'), (req, res) => orderController.cancelOrder(req, res));

// Merchant routes
router.get('/merchant/orders', authorize('MERCHANT'), (req, res) => orderController.getMerchantOrders(req, res));
router.put('/merchant/orders/:orderId/status', authorize('MERCHANT'), (req, res) => orderController.updateMerchantOrderStatus(req, res));

export default router;