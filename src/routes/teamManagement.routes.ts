import { Router } from 'express';
import { TeamManagementController } from '../controllers/teamManagement.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const teamManagementController = new TeamManagementController();

router.get(
    '/verify-invite/:token',
    (req, res) => teamManagementController.verifyInviteToken(req, res)
);

router.post(
    '/accept-invite',
    (req, res) => teamManagementController.acceptInvite(req, res)
);

router.use(authenticate);
router.use(authorize('ADMIN', 'MANAGER'));


router.get(
  '/',
  (req, res) => teamManagementController.getAllTeamMembers(req, res)
);

router.post(
  '/invite',
  (req, res) => teamManagementController.inviteTeamMember(req, res)
);

router.patch(
  '/:id/role',
  (req, res) => teamManagementController.updateMemberRole(req, res)
);

router.patch(
  '/:id/status',
  (req, res) => teamManagementController.toggleMemberStatus(req, res)
);

router.get(
  '/roles',
  (req, res) => teamManagementController.getRolePermissions(req, res)
);

export default router;