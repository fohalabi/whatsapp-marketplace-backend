import { Router } from 'express';
import { AdminProductController } from '../controllers/admin.product.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const adminProductController = new AdminProductController();

router.use(authenticate);
router.use(authorize('ADMIN'));

// Get all products
router.get('/', (req, res) => adminProductController.getAllProducts(req, res));

// Bulk update pricing (before :productId routes!)
router.patch('/bulk-pricing', (req, res) => adminProductController.bulkUpdatePricing(req, res));

// Approve product
router.patch('/:productId/approve', (req, res) => adminProductController.approveProduct(req, res));

// Hide product
router.patch('/:productId/hide', (req, res) => adminProductController.hideProduct(req, res));

// Reject product
router.patch('/:productId/reject', (req, res) => adminProductController.rejectProduct(req, res));

// Update pricing
router.patch('/:productId/pricing', (req, res) => adminProductController.updateProductPricing(req, res));

// Toggle status
router.patch('/:productId/toggle-status', (req, res) => adminProductController.toggleProductStatus(req, res));

export default router;