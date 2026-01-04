import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const reportController = new ReportController();

router.get('/summary', authenticate, (req, res) => reportController.getFinancialSummary(req, res));
router.get('/merchants', authenticate, (req, res) => reportController.getMerchantPerformance(req, res));
router.get('/comparison', authenticate, (req, res) => reportController.getReportComparison(req, res));

export default router;