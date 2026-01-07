import { Router } from 'express';
import { EscrowController } from '../controllers/escrow.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const escrowController = new EscrowController();

router.get('/', authenticate, (req, res) => escrowController.getAllEscrow(req, res));
router.get('/stats', authenticate, (req, res) => escrowController.getEscrowStats(req, res));

export default router;