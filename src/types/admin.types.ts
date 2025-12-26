export interface AdminProfileResponse {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  joinedAt: Date;
  permissions: string[];
  preferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
  } | null;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string | null;
    createdAt: Date;
  }>;
}

export interface UpdatePreferencesDTO {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface Toggle2FADTO {
  enabled: boolean;
}