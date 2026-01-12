import { Router } from 'express';
import { MerchantStockController } from '../controllers/merchantStock.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const stockController = new MerchantStockController();

// All routes require merchant authentication
router.use(authenticate);
router.use(authorize('MERCHANT'));

// Get all products
router.get('/merchant/stock', (req, res) => stockController.getMerchantProducts(req, res));

// Get stock stats
router.get('/merchant/stock/stats', (req, res) => stockController.getStockStats(req, res));

// Get single product
router.get('/merchant/stock/:productId', (req, res) => stockController.getProductById(req, res));

// Update stock
router.put('/merchant/stock/:productId', (req, res) => stockController.updateStock(req, res));

// Bulk update stock
router.post('/merchant/stock/bulk-update', (req, res) => stockController.bulkUpdateStock(req, res));

export default router;