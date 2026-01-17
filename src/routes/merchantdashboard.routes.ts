import { Router } from 'express';
import { DashboardController } from '../controllers/merchantdashboard.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const dashboardController = new DashboardController();

// All routes require authentication
router.use(authenticate);

// All dashboard routes are for merchants only
router.use(authorize('MERCHANT'));

// Dashboard health check
router.get('/health', (req, res) => dashboardController.healthCheck(req, res));

// Get complete dashboard data
router.get('/', (req, res) => dashboardController.getMerchantDashboard(req, res));

// Individual dashboard endpoints
router.get('/stats', (req, res) => dashboardController.getStats(req, res));
router.get('/sales-trend', (req, res) => dashboardController.getSalesTrend(req, res));
router.get('/categories', (req, res) => dashboardController.getCategoryPerformance(req, res));
router.get('/top-products', (req, res) => dashboardController.getTopProducts(req, res));
router.get('/low-stock', (req, res) => dashboardController.getLowStockProducts(req, res));
router.get('/customer-metrics', (req, res) => dashboardController.getCustomerMetrics(req, res));
router.get('/delivery-zones', (req, res) => dashboardController.getDeliveryZonePerformance(req, res));

export default router;