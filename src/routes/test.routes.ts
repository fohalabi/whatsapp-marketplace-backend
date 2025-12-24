import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { AuthRequest } from '../types/auth.types';

const router = Router();

router.get('/merchant-only', authenticate, authorize('MERCHANT'), (req: AuthRequest, res) => {
  res.json({ message: 'Merchant access granted', user: req.user });
});

router.get('/admin-only', authenticate, authorize('ADMIN'), (req: AuthRequest, res) => {
  res.json({ message: 'Admin access granted', user: req.user });
});

export default router;