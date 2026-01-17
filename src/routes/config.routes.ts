import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();
const configController = new ConfigController();

// Get platform configuration (admin only)
router.get(
  '/config',
  authenticate,
  authorize(Role.ADMIN),
  configController.getConfig.bind(configController)
);

// Update platform configuration (admin only)
router.put(
  '/config',
  authenticate,
  authorize(Role.ADMIN),
  configController.updateConfig.bind(configController)
);

export default router;