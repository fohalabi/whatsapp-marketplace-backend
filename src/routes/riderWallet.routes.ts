import { Router } from 'express';
import { RiderWalletController } from '../controllers/riderWallet.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();
const riderWalletController = new RiderWalletController();

router.use(authenticate);
router.use(authorize(Role.RIDER));

router.get('/balance', (req, res) => riderWalletController.getBalance(req, res));
router.get('/transactions', (req, res) => riderWalletController.getTransactions(req, res));
router.post('/withdraw', (req, res) => riderWalletController.requestWithdrawal(req, res));

export default router;