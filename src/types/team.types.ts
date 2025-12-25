import { Role } from '@prisma/client';

export interface InviteTeamMemberDTO {
  name: string;
  email: string;
  role: Role;
}

export interface UpdateRoleDTO {
  role: Role;
}

export interface TeamMemberResponse {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  joinedAt: Date;
}