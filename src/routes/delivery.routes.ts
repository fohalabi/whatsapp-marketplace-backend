import { Router } from 'express';
import { DeliveryController } from '../controllers/delivery.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const deliveryController = new DeliveryController();

router.use(authenticate);
router.use(authorize('ADMIN', 'MANAGER'));

router.post('/', (req, res) => deliveryController.createDelivery(req, res));
router.get('/', (req, res) => deliveryController.getAllDeliveries(req, res));
router.get('/:deliveryId', (req, res) => deliveryController.getDeliveryById(req, res));
router.patch('/:deliveryId/status', (req, res) => deliveryController.updateStatus(req, res));

export default router;