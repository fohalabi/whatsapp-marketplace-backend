import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { AuthRequest } from '../types/auth.types';

const router = Router();

// Test role-based access
router.get('/merchant-only', authenticate, authorize('MERCHANT'), (req: AuthRequest, res) => {
  res.json({ message: 'Merchant access granted', user: req.user });
});

router.get('/admin-only', authenticate, authorize('ADMIN'), (req: AuthRequest, res) => {
  res.json({ message: 'Admin access granted', user: req.user });
});

router.get('/manager-only', authenticate, authorize('MANAGER'), (req: AuthRequest, res) => {
  res.json({ message: 'Manager access granted', user: req.user });
});

router.get('/support-only', authenticate, authorize('SUPPORT'), (req: AuthRequest, res) => {
  res.json({ message: 'Support access granted', user: req.user });
});

// Test permission-based access
router.get('/manage-team', authenticate, requirePermission('manage_team_members'), (req: AuthRequest, res) => {
  res.json({ message: 'You can manage team members', user: req.user });
});

router.get('/view-reports', authenticate, requirePermission('view_reports'), (req: AuthRequest, res) => {
  res.json({ message: 'You can view reports', user: req.user });
});

export default router;