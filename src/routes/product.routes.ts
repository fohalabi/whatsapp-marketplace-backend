import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../utils/upload.utils';

const router = Router();
const productController = new ProductController();

// All routes require merchant authentication
router.use(authenticate);
router.use(authorize('MERCHANT'));

// Create product with images
router.post(
  '/',
  upload.array('images', 5),
  (req, res) => productController.createProduct(req, res)
);

// Get merchant's products
router.get(
  '/',
  (req, res) => productController.getMerchantProducts(req, res)
);

// Update product
router.patch(
  '/:productId',
  (req, res) => productController.updateProduct(req, res)
);

// Delete product
router.delete(
  '/:productId',
  (req, res) => productController.deleteProduct(req, res)
);

export default router;