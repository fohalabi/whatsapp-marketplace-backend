import { TemplateCategory } from "@prisma/client";

// types/broadcast.types.ts
export interface CreateTemplateDTO {
  name: string;
  description?: string;
  category: 'PROMOTION' | 'ALERT' | 'UPDATE' | 'WELCOME' | 'VERIFICATION' | 'UTILITY' | 'TRANSACTIONAL';
  header?: string;
  body: string;
  footer?: string;
  variables?: string[];
  languageCode?: string;
  sampleData?: Record<string, any>;
}

export interface UpdateTemplateDTO {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  header?: string;
  body?: string;
  footer?: string;
  variables?: string[];
  languageCode?: string;
  sampleData?: Record<string, any>;
}

export interface SubmitTemplateDTO {
  notes?: string;
}

export interface CreateBroadcastDTO {
  name: string;
  description?: string;
  content: string;
  templateId?: string;
  segmentId?: string;
  customFilter?: Record<string, any>;
  scheduledFor?: Date;
  contentVariables?: Record<string, any>;
}

export interface UpdateBroadcastDTO {
  name?: string;
  description?: string;
  content?: string;
  scheduledFor?: Date;
  contentVariables?: Record<string, any>;
}

export interface BroadcastRecipient {
  id: string;
  customerPhone: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'OPTED_OUT';
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  whatsappMessageId?: string;
}

export interface BroadcastStats {
  totalRecipients: number;
  sent: number;
  failed: number;
  pending: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  statusBreakdown: Record<string, number>;
}

export interface TemplateApprovalStatus {
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  whatsappTemplateId?: string;
  whatsappTemplateName?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

// Frontend types matching the component
export interface Template {
  id: string;
  name: string;
  category: string;
  approvalStatus: string;
  lastUpdated: string;
  content: string;
  variables: string[];
  description?: string;
  header?: string;
  footer?: string;
  whatsappTemplateId?: string;
  whatsappTemplateName?: string;
  sampleData?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StatusBadgeProps {
  status: string;
  type: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}