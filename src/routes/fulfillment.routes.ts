import { Router } from 'express';
import { FulfillmentController } from '../controllers/fulfillment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const fulfillmentController = new FulfillmentController();

// All routes require authentication
router.use(authenticate);
router.use(authorize('ADMIN', 'MANAGER'));

// Get all fulfillments
router.get('/fulfillments', (req, res) => fulfillmentController.getAllFulfillments(req, res));

// Get fulfillment stats
router.get('/fulfillments/stats', (req, res) => fulfillmentController.getFulfillmentStats(req, res));

// Get delivery by ID
router.get('/fulfillments/:deliveryId', (req, res) => fulfillmentController.getDeliveryById(req, res));

// Assign rider
router.post('/fulfillments/:deliveryId/assign-rider', (req, res) => fulfillmentController.assignRider(req, res));

// Notify merchant
router.post('/fulfillments/:deliveryId/notify-merchant', (req, res) => fulfillmentController.notifyMerchant(req, res));

export default router;