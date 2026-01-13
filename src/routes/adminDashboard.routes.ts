// routes/admin-dashboard.routes.ts
import { Router } from 'express';
import { AdminDashboardController } from '../controllers/adminDashboard.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const dashboardController = new AdminDashboardController();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

// Get complete admin dashboard data
router.get('/', (req, res) => dashboardController.getDashboard(req, res));

// Individual endpoints
router.get('/stats', (req, res) => dashboardController.getStats(req, res));
router.get('/revenue-trend', (req, res) => dashboardController.getRevenueTrend(req, res));
router.get('/top-merchants', (req, res) => dashboardController.getTopMerchants(req, res));
router.get('/delivery-zones', (req, res) => dashboardController.getDeliveryZones(req, res));
router.get('/order-flow', (req, res) => dashboardController.getOrderFlow(req, res));
router.get('/alerts', (req, res) => dashboardController.getAlerts(req, res));
router.get('/system-health', (req, res) => dashboardController.getSystemHealth(req, res));

// Export reports
router.post('/export', (req, res) => dashboardController.exportReport(req, res));

// Health check
router.get('/health', (req, res) => dashboardController.healthCheck(req, res));

export default router;