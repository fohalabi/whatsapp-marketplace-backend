import { Router } from 'express';
import { DashboardController } from '../controllers/merchantdashboard.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const dashboardController = new DashboardController();

router.get(
  '/merchant/stats',
  authenticate,
  authorize('MERCHANT'),
  (req, res) => dashboardController.getMerchantStats(req, res)
);

export default router;