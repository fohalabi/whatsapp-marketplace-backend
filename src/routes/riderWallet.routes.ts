import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { RiderController } from '../controllers/rider.controller';
import { RiderWalletController } from '../controllers/riderWallet.controller';
import { Role } from '@prisma/client';

const router = Router();
const riderController = new RiderController();
const riderWalletController = new RiderWalletController();

// Rider wallet routes (Rider only)
router.get(
  '/balance',
  authenticate,
  authorize(Role.RIDER),
  riderWalletController.getBalance
);

router.get(
  '/transactions',
  authenticate,
  authorize(Role.RIDER),
  riderWalletController.getTransactions
);

router.get(
  '/withdrawals',
  authenticate,
  authorize(Role.RIDER),
  riderWalletController.getWithdrawalHistory
);

router.post(
  '/withdraw',
  authenticate,
  authorize(Role.RIDER),
  riderWalletController.requestWithdrawal
);

router.get(
  '/all',
  authenticate,
  authorize(Role.ADMIN),
  (req, res) => riderWalletController.getAllRiderWallets(req, res)
);

export default router;