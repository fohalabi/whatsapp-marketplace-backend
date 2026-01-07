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

export default router;