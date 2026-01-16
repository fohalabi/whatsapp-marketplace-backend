import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { WalletController } from '../controllers/wallet.controller';
import { Role } from '@prisma/client';

const router = Router();
const walletController = new WalletController();

// Platform wallet routes (Admin only)
router.get(
  '/platform',
  authenticate,
  authorize(Role.ADMIN),
  walletController.getPlatformWallet
);

router.get(
  '/platform/transactions',
  authenticate,
  authorize(Role.ADMIN),
  walletController.getPlatformTransactions
);

router.post(
  '/platform/withdraw',
  authenticate,
  authorize(Role.ADMIN),
  walletController.withdrawFromPlatform
);

router.get(
  '/platform/revenue',
  authenticate,
  authorize(Role.ADMIN),
  walletController.getPlatformRevenue
);

// Merchant wallet routes
router.get(
  '/merchants/all',
  authenticate,
  authorize(Role.ADMIN),
  walletController.getAllMerchnatWallets
);

router.get(
  '/merchant/:merchantId',
  authenticate,
  authorize(Role.ADMIN, Role.MERCHANT), // Both admin and merchant can view
  walletController.getMerchantWallet
);

router.get(
  '/merchant/:merchantId/transactions',
  authenticate,
  authorize(Role.ADMIN, Role.MERCHANT),
  walletController.getMerchantTransactions
);

router.get(
  '/merchant/:merchantId/dashboard',
  authenticate,
  authorize(Role.ADMIN, Role.MERCHANT),
  walletController.getMerchantDashboardData
);

router.post(
  '/merchant/:merchantId/withdraw',
  authenticate,
  authorize(Role.MERCHANT), // Only merchant can withdraw their own funds
  walletController.requestWithdrawal
);

export default router;