import { Router } from 'express';
import { MerchantController } from '../controllers/verification.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  uploadVerificationFiles,
  validateVerificationFiles,
  validateVerificationData,
} from '../middleware/verification.middleware';

const router = Router();
const merchantController = new MerchantController();

router.post(
  '/verification',
  authenticate,
  uploadVerificationFiles,
  validateVerificationFiles,
  validateVerificationData,
  merchantController.submitVerification.bind(merchantController)
);

router.get(
  '/profile',
  authenticate,
  merchantController.getMerchantProfile.bind(merchantController)
);

router.patch(
  '/password',
  authenticate,
  merchantController.changePassword.bind(merchantController)
);

export default router;