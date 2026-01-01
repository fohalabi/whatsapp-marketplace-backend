import { Response } from 'express';
import { TeamManagementService } from '../services/teamManagement.service';
import { AuthRequest } from '../types/auth.types';

const teamManagementService = new TeamManagementService();

export class TeamManagementController {
  async getAllTeamMembers(req: AuthRequest, res: Response) {
    try {
      const members = await teamManagementService.getAllTeamMembers();

      res.status(200).json({
        success: true,
        data: members,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async inviteTeamMember(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const member = await teamManagementService.inviteTeamMember(
        req.body,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        message: 'Team member invited successfully',
        data: member,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateMemberRole(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
            success: false,
            message: 'Member ID is required'
        });
      }
      const member = await teamManagementService.updateMemberRole(
        id,
        req.body,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: member,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async toggleMemberStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
            success: false,
            message: 'Member ID is required',
        });
      }

      const result = await teamManagementService.toggleMemberStatus(
        id,
        req.user.userId
      );

      res.status(200).json({
        success: true,
        message: 'Status updated successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getRolePermissions(req: AuthRequest, res: Response) {
    try {
      const permissions = await teamManagementService.getRolePermissions();

      res.status(200).json({
        success: true,
        data: permissions,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async verifyInviteToken(req: AuthRequest, res: Response) {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required',
            });
        }

        const user = await teamManagementService.verifyInviteToken(token);

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
  }

  async acceptInvite(req: AuthRequest, res: Response) {
    try {
        const result = await teamManagementService.acceptInvite(req.body);

        res.status(200).json({
            success: true,
            message: result.message,
            data: result.user,
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
  }
}