import { Router } from 'express';
import { RiderApprovalController } from '../controllers/riderApproval.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const riderApprovalController = new RiderApprovalController();

router.use(authenticate);
router.use(authorize('ADMIN', 'MANAGER'));

router.get('/pending', (req, res) => riderApprovalController.getPendingRiders(req, res));
router.get('/', (req, res) => riderApprovalController.getAllRiders(req, res));
router.patch('/:riderId/approve', (req, res) => riderApprovalController.approveRider(req, res));
router.patch('/:riderId/reject', (req, res) => riderApprovalController.rejectRider(req, res));

export default router;