import { Response } from 'express';
import { TeamService } from '../services/team.service';
import { AuthRequest } from '../types/auth.types';

const teamService = new TeamService();

export class TeamController {
  async inviteTeamMember(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const result = await teamService.inviteTeamMember(req.body, req.user.userId);
      
      res.status(201).json({
        success: true,
        message: 'Team member invited successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

    async getAllTeamMembers(req: AuthRequest, res: Response) {
        try {
        const members = await teamService.getAllTeamMembers();
        
        res.status(200).json({
            success: true,
            data: members,
        });
        } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
        }
    }

    async updateMemberRole(req: AuthRequest, res: Response) {
        try {
            const { memberId } = req.params;
            
            if (!memberId) {
            return res.status(400).json({
                success: false,
                message: 'Member ID is required',
            });
            }

            const updatedMember = await teamService.updateMemberRole(memberId, req.body);
            
            res.status(200).json({
            success: true,
            message: 'Role updated successfully',
            data: updatedMember,
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
            const { memberId } = req.params;
            
            if (!memberId) {
            return res.status(400).json({
                success: false,
                message: 'Member ID is required',
            });
            }

            const updatedMember = await teamService.toggleMemberStatus(memberId);
            
            res.status(200).json({
            success: true,
            message: 'Status updated successfully',
            data: updatedMember,
            });
        } catch (error: any) {
            res.status(400).json({
            success: false,
            message: error.message,
            });
        }
    }
}