import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const walletController = new WalletController();

// Merchant wallet routes
router.get('/merchant/:merchantId', authenticate, (req, res) => walletController.getMerchantWallet(req, res));
router.get('/merchant/:merchantId/transactions', authenticate, (req, res) => walletController.getMerchantTransactions(req, res));
router.post('/merchant/:merchantId/withdraw', authenticate, (req, res) => walletController.requestWithdrawal(req, res));

// Platform wallet routes
router.get('/platform', authenticate, (req, res) => walletController.getPlatformWallet(req, res));

// Merchant dashboard data
router.get('/merchant/:merchantId/dashboard', authenticate, (req, res) => walletController.getMerchantDashboardData(req, res));

// Platform revenue
router.get('/platform/revenue', authenticate, (req, res) => walletController.getPlatformRevenue(req, res));

// Platform withdrawal
router.post('/platform/withdraw', authenticate, (req, res) => walletController.withdrawFromPlatform(req, res));

export default router;