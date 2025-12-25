import { Router } from 'express';
import { TeamController } from '../controllers/team.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const teamController = new TeamController();

// All routes here require authentication
router.use(authenticate);

// Invite a new team member (Admin Only)
router.post(
    '/invite',
    authorize('ADMIN'),
    (req, res) => teamController.inviteTeamMember(req, res)
);

// Get all team members (Admin and Manger)
router.get(
    '/',
    authorize('ADMIN', 'MANAGER'),
    (req, res) => teamController.getAllTeamMembers(req, res)
);

// Update member role (Admin only)
router.patch(
    '/:memberId/role',
    authorize('ADMIN'),
    (req, res) => teamController.updateMemberRole(req, res)
);

// Toggle member status (Admin only)
router.patch(
    '/:memberId/status',
    authorize('ADMIN'),
    (req, res) => teamController.toggleMemberStatus(req, res)
);


export default router;