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

// All routes require authentication and admin/manager access
router.use(authenticate);
router.use(authorize('ADMIN', 'MANAGER'));

// Get all team members
router.get(
  '/',
  (req, res) => teamManagementController.getAllTeamMembers(req, res)
);

// Invite team member
router.post(
  '/invite',
  (req, res) => teamManagementController.inviteTeamMember(req, res)
);

// Update member role
router.patch(
  '/:id/role',
  (req, res) => teamManagementController.updateMemberRole(req, res)
);

// Toggle member status
router.patch(
  '/:id/status',
  (req, res) => teamManagementController.toggleMemberStatus(req, res)
);

// Get role permissions
router.get(
  '/roles',
  (req, res) => teamManagementController.getRolePermissions(req, res)
);

export default router;