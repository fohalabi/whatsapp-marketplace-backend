import { Router } from 'express';
import { RiderApprovalController } from '../controllers/riderApproval.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

console.log('🚴 Rider Approval Routes Loaded');

router.use((req, res, next) => {
  console.log('🚴 Rider Approval Route Hit:', req.method, req.path);
  next();
});

const riderApprovalController = new RiderApprovalController();

router.use(authenticate);
router.use(authorize(Role.ADMIN, Role.MANAGER));

router.get('/pending', (req, res) => riderApprovalController.getPendingRiders(req, res));
router.get('/', (req, res) => riderApprovalController.getAllRiders(req, res));
router.patch('/:riderId/approve', (req, res) => riderApprovalController.approveRider(req, res));
router.patch('/:riderId/reject', (req, res) => riderApprovalController.rejectRider(req, res));

export default router;