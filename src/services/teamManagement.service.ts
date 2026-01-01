import prisma from '../config/database';
import { EmailService } from './email.service';
import { PERMISSIONS } from '../config/permissions';
import crypto from 'crypto';
import { hashPassword } from '../utils/password.utils';

interface InviteTeamMemberDTO {
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'SUPPORT';
}

interface UpdateRoleDTO {
  role: 'ADMIN' | 'MANAGER' | 'SUPPORT';
}

interface AcceptInviteDTO {
    token: string;
    password: string;
}

export class TeamManagementService {
  private emailService = new EmailService();

  async getAllTeamMembers() {
    const members = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'MANAGER', 'SUPPORT'],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        joinedAt: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return members.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      accessLevel: this.getAccessLevel(member.role),
      status: member.isActive ? 'Active' : 'Disabled',
      joinedDate: member.joinedAt.toISOString().split('T')[0],
    }));
  }

  async inviteTeamMember(data: InviteTeamMemberDTO, invitedBy: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hours expiry

    const newMember = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: '', // No password yet, will be set when they accept invite
        role: data.role,
        isActive: false, // Inactive until they accept invite
        inviteToken,
        inviteTokenExpiry: tokenExpiry,
      },
    });

    // Send invite email
    await this.emailService.sendTeamInvite(
      data.email,
      data.name,
      data.role,
      inviteToken
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: invitedBy,
        action: 'Team member invited',
        description: `Invited ${data.name} as ${data.role}`,
      },
    });

    return {
      id: newMember.id,
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      accessLevel: this.getAccessLevel(newMember.role),
      status: 'Pending',
      joinedDate: newMember.joinedAt.toISOString().split('T')[0],
    };
  }

  async updateMemberRole(memberId: string, data: UpdateRoleDTO, updatedBy: string) {
    const member = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.role === 'MERCHANT') {
      throw new Error('Cannot modify merchant accounts');
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: { role: data.role },
    });

    await prisma.activityLog.create({
      data: {
        userId: updatedBy,
        action: 'Role updated',
        description: `Updated ${member.name}'s role from ${member.role} to ${data.role}`,
      },
    });

    return {
      id: updatedMember.id,
      name: updatedMember.name,
      email: updatedMember.email,
      role: updatedMember.role,
      accessLevel: this.getAccessLevel(updatedMember.role),
      status: updatedMember.isActive ? 'Active' : 'Disabled',
      joinedDate: updatedMember.joinedAt.toISOString().split('T')[0],
    };
  }

  async toggleMemberStatus(memberId: string, toggledBy: string) {
    const member = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.role === 'MERCHANT') {
      throw new Error('Cannot modify merchant accounts');
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: { isActive: !member.isActive },
    });

    await prisma.activityLog.create({
      data: {
        userId: toggledBy,
        action: 'Status updated',
        description: `${updatedMember.isActive ? 'Activated' : 'Disabled'} ${member.name}'s account`,
      },
    });

    return {
      id: updatedMember.id,
      status: updatedMember.isActive ? 'Active' : 'Disabled',
    };
  }

  async getRolePermissions() {
    return {
      Admin: {
        label: 'Administrator',
        permissions: PERMISSIONS.ADMIN || [
          'Full system access',
          'Manage team members',
          'Configure platform settings',
          'View all reports',
          'Manage integrations',
          'Process refunds',
          'Delete orders',
          'Manage inventory',
        ],
      },
      Manager: {
        label: 'Manager',
        permissions: PERMISSIONS.MANAGER || [
          'View all orders',
          'Process orders',
          'Manage inventory',
          'View reports',
          'Manage customers',
          'Handle disputes',
          'Export data',
        ],
      },
      Support: {
        label: 'Support Agent',
        permissions: PERMISSIONS.SUPPORT || [
          'View orders',
          'Update order status',
          'Chat with customers',
          'View customer details',
          'Create support tickets',
        ],
      },
    };
  }

  private getAccessLevel(role: string): string {
    switch (role) {
      case 'ADMIN':
        return 'Full Access';
      case 'MANAGER':
        return 'Management Access';
      case 'SUPPORT':
        return 'Support Access';
      default:
        return 'No Access';
    }
  }

  async verifyInviteToken(token: string) {
    const user = await prisma.user.findFirst({
        where: {
            inviteToken: token,
            inviteTokenExpiry: {
                gte: new Date(),
            },
        },
    });

    if (!user) {
        throw new Error('Invalid or expired invite token');
    }

    return {
        name: user.name,
        email: user.email,
        role: user.role,
    };
  }

  async acceptInvite(data: AcceptInviteDTO) {
    const user = await prisma.user.findFirst({
        where: {
            inviteToken: data.token,
            inviteTokenExpiry: {
                gte: new Date(),
            },
        },
    });

    if (!user) {
        throw new Error('Invalid or expired invite token');
    }

    const hashedPassword = await hashPassword(data.password);

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            isActive: true,
            inviteToken: null,
            inviteTokenExpiry: null,
        },
    });

    return {
        message: 'Account acivated successfully',
        user: {
           id: updatedUser.id,
           name: updatedUser.name,
           email: updatedUser.email,
           role: updatedUser.role,
        },
    };
  }
}