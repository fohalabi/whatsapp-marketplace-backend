import prisma from '../config/database';
import { UpdatePreferencesDTO, ChangePasswordDTO } from '../types/admin.types';
import { comparePassword, hashPassword } from '../utils/password.utils';
import { PERMISSIONS } from '../config/permissions';

export class AdminProfileService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        activityLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Only allow admin team members (not merchants)
    if (user.role === 'MERCHANT') {
      throw new Error('This endpoint is for admin team members only');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
      joinedAt: user.joinedAt,
      permissions: PERMISSIONS[user.role] || [],
      preferences: user.preferences,
      recentActivity: user.activityLogs.map(log => ({
        id: log.id,
        action: log.action,
        description: log.description,
        createdAt: log.createdAt,
      })),
    };
  }

  async updatePreferences(userId: string, data: UpdatePreferencesDTO) {
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        emailNotifications: data.emailNotifications ?? true,
        pushNotifications: data.pushNotifications ?? false,
      },
      update: data,
    });

    return preferences;
  }

  async changePassword(userId: string, data: ChangePasswordDTO) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await comparePassword(data.currentPassword, user.password);

    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newHashedPassword = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: newHashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async toggle2FA(userId: string, enabled: boolean) {
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: enabled },
    });

    return { twoFactorEnabled: enabled };
  }

  async logActivity(userId: string, action: string, description?: string) {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        description: description ?? null,
      },
    });
  }
}