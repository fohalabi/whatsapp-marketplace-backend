// services/broadcast.service.ts
import prisma from '../config/database';
import { whatsappService } from './whatsapp.service';
import { 
  CreateTemplateDTO, 
  UpdateTemplateDTO, 
  SubmitTemplateDTO,
  CreateBroadcastDTO,
  UpdateBroadcastDTO,
  BroadcastRecipient,
  BroadcastStats,
  TemplateApprovalStatus
} from '../types/broadcast.types';
import { ApproveStatus } from '@prisma/client';

export class BroadcastService {
  async createTemplate(data: CreateTemplateDTO, userId: string) {
    try {
      const template = await prisma.broadcastTemplate.create({
        data: {
          name: data.name,
          category: data.category,
          body: data.body,
          variables: data.variables || [],
          languageCode: data.languageCode || 'en_US',
          approvalStatus: 'DRAFT',
          createdBy: userId,
          ...(data.description && { description: data.description }),
          ...(data.header && { header: data.header }),
          ...(data.footer && { footer: data.footer }),
          ...(data.sampleData && { sampleData: data.sampleData })
        }
      });

      return template;
    } catch (error) {
      console.error('Error creating template:', error);
      throw new Error('Failed to create template');
    }
  }

  async getTemplates(params: {
    approvalStatus?: string | undefined;
    category?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }) {
    const {
      approvalStatus,
      category,
      search,
      page = 1,
      limit = 20
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.broadcastTemplate.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.broadcastTemplate.count({ where })
    ]);

    return {
      data: templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getTemplate(id: string) {
    const template = await prisma.broadcastTemplate.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return template;
  }

  async updateTemplate(id: string, data: UpdateTemplateDTO, userId: string) {
    const template = await prisma.broadcastTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // If template is already submitted/approved, only certain fields can be updated
    if (template.approvalStatus !== 'DRAFT') {
      // Only allow updating name, description, sampleData for submitted templates
      const allowedUpdates = ['name', 'description', 'sampleData'];
      const updateData: any = {};
      
      Object.keys(data).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updateData[key] = (data as any)[key];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error('Cannot edit submitted template content');
      }

      data = updateData as UpdateTemplateDTO;
    }

    const updatedTemplate = await prisma.broadcastTemplate.update({
  where: { id },
  data: {
    updatedAt: new Date(),
    ...(data.name && { name: data.name }),
    ...(data.description && { description: data.description }),
    ...(data.category && { category: data.category }),
    ...(data.header && { header: data.header }),
    ...(data.body && { body: data.body }),
    ...(data.footer && { footer: data.footer }),
    ...(data.variables && { variables: data.variables }),
    ...(data.languageCode && { languageCode: data.languageCode }),
    ...(data.sampleData && { sampleData: data.sampleData })
  }
});

    return updatedTemplate;
  }

  async deleteTemplate(id: string) {
    const template = await prisma.broadcastTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Only allow deletion of draft templates
    if (template.approvalStatus !== 'DRAFT') {
      throw new Error('Cannot delete submitted or approved templates');
    }

    await prisma.broadcastTemplate.delete({
      where: { id }
    });

    return { success: true };
  }

  async submitTemplateForApproval(id: string, data: SubmitTemplateDTO) {
    const template = await prisma.broadcastTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.approvalStatus !== 'DRAFT') {
      throw new Error('Template has already been submitted');
    }

    // Submit to WhatsApp API for approval
    try {
      const whatsappResponse = await whatsappService.submitTemplate({
        name: template.name,
        category: template.category,
        language: template.languageCode,
        components: this.formatTemplateComponents(template)
      });

      const updatedTemplate = await prisma.broadcastTemplate.update({
        where: { id },
        data: {
          approvalStatus: 'PENDING',
          submittedAt: new Date(),
          whatsappTemplateName: `${template.name}_${Date.now()}`,
          ...data
        }
      });

      // Poll for approval status (in production, this would be webhook-based)
      this.pollTemplateApprovalStatus(id);

      return updatedTemplate;
    } catch (error) {
      console.error('Error submitting template:', error);
      throw new Error('Failed to submit template for approval');
    }
  }

  private async pollTemplateApprovalStatus(templateId: string) {
    // This would be called by a webhook from WhatsApp
    // For now, we'll simulate with a timeout
    setTimeout(async () => {
      try {
        const template = await prisma.broadcastTemplate.findUnique({
          where: { id: templateId }
        });

        if (template && template.approvalStatus === 'PENDING') {
          // Check with WhatsApp API
          const status = await whatsappService.getTemplateStatus(
            template.whatsappTemplateName!
          );

          await prisma.broadcastTemplate.update({
            where: { id: templateId },
            data: {
              approvalStatus: status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
              [status === 'APPROVED' ? 'approvedAt' : 'rejectedAt']: new Date(),
              whatsappTemplateId: status === 'APPROVED' ? `WAT_${Date.now()}` : null
            }
          });
        }
      } catch (error) {
        console.error('Error polling template status:', error);
      }
    }, 5000); // Poll after 5 seconds
  }

  private formatTemplateComponents(template: any) {
    const components: any[] = [];

    // Add header if exists
    if (template.header) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: template.header
      });
    }

    // Add body (required)
    components.push({
      type: 'BODY',
      text: template.body
    });

    // Add footer if exists
    if (template.footer) {
      components.push({
        type: 'FOOTER',
        text: template.footer
      });
    }

    return components;
  }

  async createBroadcast(data: CreateBroadcastDTO, userId: string) {
    try {
      let segmentId: string | undefined;
      let totalRecipients = 0;

      // If using segment, validate it exists
      if (data.segmentId) {
        const segment = await prisma.segment.findUnique({
          where: { id: data.segmentId }
        });

        if (!segment) {
          throw new Error('Segment not found');
        }

        segmentId = data.segmentId;
        
        // Get customer count from segment (you'd need to implement this)
        // For now, we'll use a placeholder
        totalRecipients = segment.customerCount || 0;
      } else if (data.customFilter) {
        // Calculate recipients based on custom filter
        totalRecipients = await this.calculateRecipientsByFilter(data.customFilter);
      }

      // If using template, validate it's approved
      if (data.templateId) {
        const template = await prisma.broadcastTemplate.findUnique({
          where: { id: data.templateId }
        });

        if (!template) {
          throw new Error('Template not found');
        }

        if (template.approvalStatus !== 'APPROVED') {
          throw new Error('Template must be approved before use');
        }
      }

      const broadcast = await prisma.broadcast.create({
        data: {
          name: data.name,
          content: data.content,
          totalRecipients,
          status: data.scheduledFor ? 'SCHEDULED' : 'DRAFT',
          approvalStatus: 'PENDING',
          createdBy: userId,
          ...(data.description && { description: data.description }),
          ...(data.templateId && { templateId: data.templateId }),
          ...(segmentId && { segmentId }),
          ...(data.customFilter && { customFilter: data.customFilter }),
          ...(data.scheduledFor && { scheduledFor: data.scheduledFor })
        }
      });

      return broadcast;
    } catch (error) {
      console.error('Error creating broadcast:', error);
      throw new Error('Failed to create broadcast');
    }
  }

  private async calculateRecipientsByFilter(filter: any): Promise<number> {
    // Implement logic to count customers based on filter
    // This is a simplified version
    const where: any = {};

    if (filter.tags && filter.tags.length > 0) {
      where.tags = {
        hasSome: filter.tags
      };
    }

    if (filter.minOrders) {
      where.totalOrders = {
        gte: filter.minOrders
      };
    }

    if (filter.minSpent) {
      where.totalSpent = {
        gte: filter.minSpent
      };
    }

    // Add more filter conditions as needed

    const count = await prisma.customer.count({ where });
    return count;
  }

  async getBroadcasts(params: {
    status?: string;
    approvalStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      status,
      approvalStatus,
      search,
      page = 1,
      limit = 20
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          segment: {
            select: {
              id: true,
              name: true,
              customerCount: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.broadcast.count({ where })
    ]);

    return {
      data: broadcasts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getBroadcast(id: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        segment: {
          select: {
            id: true,
            name: true,
            description: true,
            customerCount: true
          }
        }
      }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    return broadcast;
  }

  async updateBroadcast(id: string, data: UpdateBroadcastDTO, userId: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    // Can only update draft broadcasts
    if (broadcast.status !== 'DRAFT') {
      throw new Error('Can only update draft broadcasts');
    }

    const updatedBroadcast = await prisma.broadcast.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    return updatedBroadcast;
  }

  async submitBroadcastForApproval(id: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: {
        segment: true
      }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (broadcast.approvalStatus !== 'PENDING') {  // Use enum
      throw new Error('Broadcast has already been submitted');
    }

    if (!broadcast.segmentId && !broadcast.customFilter) {
      throw new Error('Broadcast must have a target segment or filter');
    }

    if (broadcast.totalRecipients === 0) {
      throw new Error('No recipients found for this broadcast');
    }

    const updatedBroadcast = await prisma.broadcast.update({
      where: { id },
      data: {
        approvalStatus: ApproveStatus.PENDING  // Use enum
      }
    });

    return updatedBroadcast;
  }

  async approveBroadcast(id: string, approvedBy: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (broadcast.approvalStatus !== 'PENDING') {
      throw new Error('Broadcast is not pending approval');
    }

    const updatedBroadcast = await prisma.broadcast.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        // If scheduled, status becomes SCHEDULED, otherwise DRAFT
        status: broadcast.scheduledFor ? 'SCHEDULED' : 'DRAFT'
      }
    });

    return updatedBroadcast;
  }

  async rejectBroadcast(id: string, rejectionReason: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (broadcast.approvalStatus !== 'PENDING') {
      throw new Error('Broadcast is not pending approval');
    }

    const updatedBroadcast = await prisma.broadcast.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        // Store rejection reason somewhere (you'd add this field to model)
      }
    });

    return updatedBroadcast;
  }

  async sendBroadcast(id: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: {
        segment: true
      }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (broadcast.approvalStatus !== 'APPROVED') {
      throw new Error('Broadcast must be approved before sending');
    }

    if (broadcast.status !== 'DRAFT' && broadcast.status !== 'SCHEDULED') {
      throw new Error('Broadcast has already been sent or is being sent');
    }

    // Update status to sending
    await prisma.broadcast.update({
      where: { id },
      data: {
        status: 'SENDING',
        sentAt: new Date()
      }
    });

    // Get recipients
    const recipients = await this.getBroadcastRecipients(broadcast);

    // Send messages in batches
    const batchSize = 50;
    const batches = Math.ceil(recipients.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = recipients.slice(i * batchSize, (i + 1) * batchSize);
      
      try {
        await this.sendBatch(broadcast, batch);
        
        // Update broadcast progress
        await prisma.broadcast.update({
          where: { id },
          data: {
            successfulSends: { increment: batch.length }
          }
        });
      } catch (error) {
        console.error('Error sending batch:', error);
        
        await prisma.broadcast.update({
          where: { id },
          data: {
            failedSends: { increment: batch.length }
          }
        });
      }
    }

    // Update final status
    const updatedBroadcast = await prisma.broadcast.update({
      where: { id },
      data: {
        status: 'SENT'
      }
    });

    return updatedBroadcast;
  }

  private async getBroadcastRecipients(broadcast: any): Promise<any[]> {
    if (broadcast.segmentId) {
      // Get customers from segment
      // This would query based on segment criteria
      // For now, return mock data
      return []; // Implement segment-based recipient fetching
    } else if (broadcast.customFilter) {
      // Query customers based on custom filter
      const where: any = {};

      if (broadcast.customFilter.tags) {
        where.tags = {
          hasSome: broadcast.customFilter.tags
        };
      }

      // Add more filter conditions

      const customers = await prisma.customer.findMany({
        where,
        select: {
          id: true,
          phoneHash: true
        }
      });

      return customers;
    }

    return [];
  }

  private async sendBatch(broadcast: any, recipients: any[]) {
    // Send messages using WhatsApp service
    for (const recipient of recipients) {
      try {
        let messageData: any;

        if (broadcast.templateId) {
          // Use WhatsApp template
          const template = await prisma.broadcastTemplate.findUnique({
            where: { id: broadcast.templateId }
          });

          if (template) {
            // Format message with variables
            const message = this.formatTemplateMessage(
              template.body,
              broadcast.contentVariables || {}
            );

            messageData = {
              type: 'template',
              template: {
                name: template.whatsappTemplateName!,
                language: { code: template.languageCode }
              }
            };
          }
        } else {
          // Send plain text message
          messageData = {
            type: 'text',
            text: { body: broadcast.content }
          };
        }

        // Send via WhatsApp
        const response = await whatsappService.sendMessage(
          recipient.phoneHash, // You'd need to get actual phone number
          messageData
        );

        // Save recipient status
        await prisma.broadcastRecipient.create({
          data: {
            broadcastId: broadcast.id,
            customerPhone: recipient.phoneHash,
            status: 'SENT',
            sentAt: new Date(),
            ...(response.messages?.[0]?.id && {
              whatsappMessageId: response.messages?.[0]?.id,
            })
          }
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error('Error sending to recipient:', error);
        
        await prisma.broadcastRecipient.create({
          data: {
            broadcastId: broadcast.id,
            customerPhone: recipient.phoneHash,
            status: 'FAILED',
            failedAt: new Date(),
            ...(error.message && { failureReason: error.message })
          }
        });
      }
    }
  }

  private formatTemplateMessage(template: string, variables: any): string {
    let message = template;
    
    Object.keys(variables).forEach(key => {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), variables[key] || '');
    });
    
    return message;
  }

  async getBroadcastStats(id: string): Promise<BroadcastStats> {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      select: {
        totalRecipients: true,
        successfulSends: true,
        failedSends: true
      }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    // Get recipient stats
    const recipientStats = await prisma.broadcastRecipient.groupBy({
      by: ['status'],
      where: { broadcastId: id },
      _count: true
    });

    // Calculate open/click rates (you'd need tracking implementation)
    const openRate = 0; // Implement based on WhatsApp read receipts
    const clickRate = 0; // Implement based on link tracking
    const conversionRate = 0; // Implement based on conversions

    return {
      totalRecipients: broadcast.totalRecipients,
      sent: broadcast.successfulSends,
      failed: broadcast.failedSends,
      pending: broadcast.totalRecipients - broadcast.successfulSends - broadcast.failedSends,
      openRate,
      clickRate,
      conversionRate,
      statusBreakdown: recipientStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  async cancelBroadcast(id: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id }
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (broadcast.status !== 'DRAFT' && broadcast.status !== 'SCHEDULED') {
      throw new Error('Cannot cancel broadcast that is already sending or sent');
    }

    const updatedBroadcast = await prisma.broadcast.update({
      where: { id },
      data: {
        status: 'CANCELLED'
      }
    });

    return updatedBroadcast;
  }

  // ========== SEGMENT MANAGEMENT ==========

  async createSegment(data: {
    name: string;
    description?: string;
    criteria: any;
    tags?: string[];
    color?: string;
  }, userId: string) {
    try {
      // Calculate customer count based on criteria
      const customerCount = await this.calculateRecipientsByFilter(data.criteria);

      const segment = await prisma.segment.create({
        data: {
          name: data.name,
          criteria: data.criteria,
          tags: data.tags || [],
          color: data.color || 'purple',
          customerCount,
          createdById: userId,
          purchaseBehavior: {
            avgOrderValue: 0,
            totalRevenue: 0,
            lastPurchase: '',
            preferredCategories: []
          },
          ...(data.description && { description: data.description })
        }
      });

      return segment;
    } catch (error) {
      console.error('Error creating segment:', error);
      throw new Error('Failed to create segment');
    }
  }

  async getSegments(params: {
    search?: string;
    page?: number;
    limit?: number;
    tags?: string[];
  }) {
    const {
      search,
      page = 1,
      limit = 20,
      tags
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags
      };
    }

    const [segments, total] = await Promise.all([
      prisma.segment.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.segment.count({ where })
    ]);

    return {
      data: segments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getSegment(id: string) {
    const segment = await prisma.segment.findUnique({
      where: { id, isDeleted: false },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    return segment;
  }

  async updateSegment(id: string, data: {
    name?: string;
    description?: string;
    criteria?: any;
    tags?: string[];
    color?: string;
  }, userId: string) {
    const segment = await prisma.segment.findUnique({
      where: { id, isDeleted: false }
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    // Recalculate customer count if criteria changed
    let customerCount = segment.customerCount;
    if (data.criteria) {
      customerCount = await this.calculateRecipientsByFilter(data.criteria);
    }

    const updatedSegment = await prisma.segment.update({
      where: { id },
      data: {
        ...data,
        customerCount,
        updatedAt: new Date()
      }
    });

    return updatedSegment;
  }

  async deleteSegment(id: string) {
    const segment = await prisma.segment.findUnique({
      where: { id, isDeleted: false }
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    // Soft delete
    const deletedSegment = await prisma.segment.update({
      where: { id },
      data: {
        isDeleted: true,
        updatedAt: new Date()
      }
    });

    return { success: true };
  }

  async estimateSegmentSize(criteria: any): Promise<number> {
    try {
      const count = await this.calculateRecipientsByFilter(criteria);
      return count;
    } catch (error) {
      console.error('Error estimating segment size:', error);
      throw new Error('Failed to estimate segment size');
    }
  }

  async getSegmentStats(id: string) {
    const segment = await prisma.segment.findUnique({
      where: { id, isDeleted: false },
      include: {
        _count: {
          select: {
            broadcasts: true
          }
        },
        broadcasts: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            sentAt: true,
            totalRecipients: true,
            successfulSends: true
          }
        }
      }
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    // Calculate purchase behavior (this would be from actual customer data)
    const purchaseBehavior = await this.calculateSegmentPurchaseBehavior(id);

    return {
      ...segment,
      purchaseBehavior
    };
  }

  private async calculateSegmentPurchaseBehavior(segmentId: string): Promise<any> {
    // This would query actual customer purchase data
    // For now, return mock/stubbed data
    return {
      avgOrderValue: 32000,
      totalRevenue: 1280000,
      lastPurchase: 'Within 14 days',
      preferredCategories: ['Fashion', 'Electronics']
    };
  }

  async duplicateSegment(id: string, newName: string, userId: string) {
    const segment = await prisma.segment.findUnique({
      where: { id, isDeleted: false }
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    const newSegment = await prisma.segment.create({
      data: {
        name: newName,
        criteria: segment.criteria as any,
        tags: segment.tags,
        color: segment.color,
        customerCount: segment.customerCount,
        createdById: userId,
        purchaseBehavior: segment.purchaseBehavior as any,
        ...(segment.description && { description: segment.description })
      }
    });

    return newSegment;
  }

  async getSegmentTags(): Promise<string[]> {
    // Get all unique tags from segments
    const segments = await prisma.segment.findMany({
      where: { isDeleted: false },
      select: { tags: true }
    });

    const allTags = segments.flatMap(segment => segment.tags);
    const uniqueTags = Array.from(new Set(allTags));
    
    return uniqueTags;
  }
}

// Export singleton
export const broadcastService = new BroadcastService();
export default broadcastService;