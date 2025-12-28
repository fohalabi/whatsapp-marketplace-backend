import { Router } from 'express';
import { AdminMerchantController } from '../controllers/adminMerchant.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const adminMerchantController = new AdminMerchantController();

router.use(authenticate, authorize('ADMIN', 'MANAGER'));

router.get(
  '/pending',
  adminMerchantController.getPendingMerchants.bind(adminMerchantController)
);

router.get(
  '/',
  adminMerchantController.getAllMerchants.bind(adminMerchantController)
);

router.get(
  '/:merchantId',
  adminMerchantController.getMerchantDetails.bind(adminMerchantController)
);

// Step-by-step approval/rejection
router.patch(
  '/:merchantId/approve/:step',
  authorize('ADMIN'),
  adminMerchantController.approveStep.bind(adminMerchantController)
);

router.patch(
  '/:merchantId/reject/:step',
  authorize('ADMIN'),
  adminMerchantController.rejectStep.bind(adminMerchantController)
);

export default router;