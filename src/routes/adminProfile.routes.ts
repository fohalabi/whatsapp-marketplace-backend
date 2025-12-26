import { Router } from 'express';
import { AdminProfileController } from '../controllers/adminProfile.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const adminProfileController = new AdminProfileController();

// All routes require admin authentication (not merchant)
router.use(authenticate);
router.use(authorize('ADMIN', 'MANAGER', 'SUPPORT'));

// Get admin profile
router.get(
  '/',
  (req, res) => adminProfileController.getProfile(req, res)
);

// Update preferences
router.patch(
  '/preferences',
  (req, res) => adminProfileController.updatePreferences(req, res)
);

// Change password
router.patch(
  '/password',
  (req, res) => adminProfileController.changePassword(req, res)
);

// Toggle 2FA
router.patch(
  '/2fa',
  (req, res) => adminProfileController.toggle2FA(req, res)
);

export default router;