import { Router } from 'express';
import { RiderController } from '../controllers/rider.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const riderController = new RiderController();

router.use(authenticate);
router.use(authorize('RIDER'));

router.get('/profile', (req, res) => riderController.getProfile(req, res));
router.patch('/status', (req, res) => riderController.updateStatus(req, res));
router.patch('/location', (req, res) => riderController.updateLocation(req, res));
router.get('/deliveries', (req, res) => riderController.getMyDeliveries(req, res));
router.patch('/deliveries/:deliveryId/status', (req, res) => riderController.updateDeliveryStatus(req, res));

export default router;