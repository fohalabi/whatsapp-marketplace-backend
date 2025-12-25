import prisma from '../config/database';
import { InviteTeamMemberDTO, UpdateRoleDTO } from '../types/team.types';
import { hashPassword } from '../utils/password.utils';

export class TeamService {
  async inviteTeamMember(data: InviteTeamMemberDTO, invitedBy: string) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Only allow admin roles (ADMIN, MANAGER, SUPPORT)
    if (data.role === 'MERCHANT') {
      throw new Error('Cannot invite merchants through team management');
    }

    // Generate temporary password (in production, send invite email)
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        invitedBy: invitedBy,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        joinedAt: true,
      },
    });

    return { user, tempPassword };
  }

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

    return members;
  }

  async updateMemberRole(memberId: string, data: UpdateRoleDTO) {
    const member = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.role === 'MERCHANT') {
      throw new Error('Cannot update merchant role through team management');
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: { role: data.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        joinedAt: true,
      },
    });

    return updatedMember;
  }

  async toggleMemberStatus(memberId: string) {
    const member = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new Error('Team member not found');
    }

    if (member.role === 'MERCHANT') {
      throw new Error('Cannot toggle merchant status through team management');
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: { isActive: !member.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        joinedAt: true,
      },
    });

    return updatedMember;
  }
}