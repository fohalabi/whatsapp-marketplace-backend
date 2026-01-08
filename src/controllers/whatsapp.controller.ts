import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth.types';
import { whatsappService } from '../services/whatsapp.service';

export class WhatsAppController {
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { to, message, type = 'text', templateName, buttons, previewUrl = false } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'Recipient phone number and message are required'
        });
      }

      let result;

      switch (type) {
        case 'text':
          result = await whatsappService.sendText(to, message, previewUrl);
          break;
        case 'template':
          if (!templateName) {
            return res.status(400).json({
              success: false,
              error: 'Template name is required for template messages'
            });
          }
          result = await whatsappService.sendTemplate(to, templateName);
          break;
        case 'interactive':
          if (!buttons || !Array.isArray(buttons)) {
            return res.status(400).json({
              success: false,
              error: 'Buttons array is required for interactive messages'
            });
          }
          result = await whatsappService.sendInteractiveButtons(to, message, buttons);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid message type. Use: text, template, or interactive'
          });
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send message'
      });
    }
  }

  async sendMediaMessage(req: AuthRequest, res: Response) {
    try {
      const { to, mediaUrl, type, caption, filename } = req.body;

      if (!to || !mediaUrl || !type) {
        return res.status(400).json({
          success: false,
          error: 'Recipient phone number, media URL, and type are required'
        });
      }

      let result;

      switch (type) {
        case 'image':
          result = await whatsappService.sendImage(to, mediaUrl, caption);
          break;
        case 'document':
          if (!filename) {
            return res.status(400).json({
              success: false,
              error: 'Filename is required for document messages'
            });
          }
          result = await whatsappService.sendDocument(to, mediaUrl, filename, caption);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid media type. Use: image or document'
          });
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Send media message error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send media message'
      });
    }
  }

  async sendCatalogMessage(req: AuthRequest, res: Response) {
    try {
      const { to, message, catalogId } = req.body;

      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: 'Recipient phone number and message are required'
        });
      }

      const result = await whatsappService.sendCatalogMessage(to, message, catalogId);

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Send catalog message error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send catalog message'
      });
    }
  }

  async sendInteractiveList(req: AuthRequest, res: Response) {
    try {
      const { to, message, buttonText, sections } = req.body;

      if (!to || !message || !buttonText || !sections) {
        return res.status(400).json({
          success: false,
          error: 'Recipient phone number, message, buttonText, and sections are required'
        });
      }

      const result = await whatsappService.sendInteractiveList(to, message, buttonText, sections);

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Send interactive list error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send interactive list'
      });
    }
  }

  async getRegisteredContacts(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const contacts = await whatsappService.getRegisteredContacts(parseInt(limit as string) || 500);

      res.json({
        success: true,
        data: contacts
      });

    } catch (error: any) {
      console.error('Get registered contacts error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get registered contacts'
      });
    }
  }

  async checkContacts(req: Request, res: Response) {
    try {
      const { phoneNumbers } = req.body;

      if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
        return res.status(400).json({
          success: false,
          error: 'Phone numbers array is required'
        });
      }

      const contacts = await whatsappService.checkContacts(phoneNumbers);

      res.json({
        success: true,
        data: contacts
      });

    } catch (error: any) {
      console.error('Check contacts error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check contacts'
      });
    }
  }

  async syncContacts(req: Request, res: Response) {
    try {
      const result = await whatsappService.syncContactsWithDatabase();

      res.json({
        success: true,
        data: result,
        message: 'Contacts synced successfully'
      });

    } catch (error: any) {
      console.error('Sync contacts error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync contacts'
      });
    }
  }

  async getContactInfo(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const contactInfo = await whatsappService.getContactInfo(phoneNumber);

      if (!contactInfo) {
        return res.status(404).json({
          success: false,
          error: 'Contact not found'
        });
      }

      res.json({
        success: true,
        data: contactInfo
      });

    } catch (error: any) {
      console.error('Get contact info error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get contact info'
      });
    }
  }

  async getRecentContacts(req: Request, res: Response) {
    try {
      const { days = '7', limit = '100' } = req.query;
      const contacts = await whatsappService.getRecentContacts(
        parseInt(days as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: contacts
      });

    } catch (error: any) {
      console.error('Get recent contacts error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get recent contacts'
      });
    }
  }

  async getContactProfilePicture(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const profilePicture = await whatsappService.getContactProfilePicture(phoneNumber);

      res.json({
        success: true,
        data: { profilePicture }
      });

    } catch (error: any) {
      console.error('Get contact profile picture error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get profile picture'
      });
    }
  }

  async blockContact(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const success = await whatsappService.blockContact(phoneNumber);

      res.json({
        success,
        message: success ? 'Contact blocked successfully' : 'Failed to block contact'
      });

    } catch (error: any) {
      console.error('Block contact error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to block contact'
      });
    }
  }

  async unblockContact(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const success = await whatsappService.unblockContact(phoneNumber);

      res.json({
        success,
        message: success ? 'Contact unblocked successfully' : 'Failed to unblock contact'
      });

    } catch (error: any) {
      console.error('Unblock contact error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to unblock contact'
      });
    }
  }

  async getBlockedContacts(req: Request, res: Response) {
    try {
      const blockedContacts = await whatsappService.getBlockedContacts();

      res.json({
        success: true,
        data: blockedContacts
      });

    } catch (error: any) {
      console.error('Get blocked contacts error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get blocked contacts'
      });
    }
  }

  async getContactMessageStats(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.params;
      const { days = '30' } = req.query;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const stats = await whatsappService.getContactMessageStats(
        phoneNumber,
        parseInt(days as string)
      );

      res.json({
        success: true,
        data: stats
      });

    } catch (error: any) {
      console.error('Get contact message stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get message stats'
      });
    }
  }

  async searchContacts(req: Request, res: Response) {
    try {
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const contacts = await whatsappService.searchContacts(query);

      res.json({
        success: true,
        data: contacts
      });

    } catch (error: any) {
      console.error('Search contacts error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to search contacts'
      });
    }
  }

  async getBusinessProfile(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const businessProfile = await whatsappService.getBusinessProfile(phoneNumber);

      res.json({
        success: true,
        data: businessProfile
      });

    } catch (error: any) {
      console.error('Get business profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get business profile'
      });
    }
  }

  async getContactsOverview(req: Request, res: Response) {
    try {
      const overview = await whatsappService.getContactsOverview();

      res.json({
        success: true,
        data: overview
      });

    } catch (error: any) {
      console.error('Get contacts overview error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get contacts overview'
      });
    }
  }

  async syncProductToCatalog(req: AuthRequest, res: Response) {
    try {
      const product = req.body;

      if (!product.id || !product.name || !product.price) {
        return res.status(400).json({
          success: false,
          error: 'Product ID, name, and price are required'
        });
      }

      const productId = await whatsappService.syncProductToCatalog(product);

      res.json({
        success: true,
        data: { whatsappProductId: productId },
        message: 'Product synced to WhatsApp catalog successfully'
      });

    } catch (error: any) {
      console.error('Sync product error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync product to catalog'
      });
    }
  }

  async updateCatalogProduct(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;
      const product = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: 'Product ID is required'
        });
      }

      await whatsappService.updateCatalogProduct(productId, product);

      res.json({
        success: true,
        message: 'Catalog product updated successfully'
      });

    } catch (error: any) {
      console.error('Update catalog product error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update catalog product'
      });
    }
  }

  async deleteCatalogProduct(req: AuthRequest, res: Response) {
    try {
      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: 'Product ID is required'
        });
      }

      await whatsappService.deleteCatalogProduct(productId);

      res.json({
        success: true,
        message: 'Catalog product deleted successfully'
      });

    } catch (error: any) {
      console.error('Delete catalog product error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete catalog product'
      });
    }
  }

  async getCatalogProducts(req: Request, res: Response) {
    try {
      const products = await whatsappService.getCatalogProducts();

      res.json({
        success: true,
        data: products
      });

    } catch (error: any) {
      console.error('Get catalog products error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get catalog products'
      });
    }
  }

  async getConversations(req: Request, res: Response) {
    try {
      const {
        status = 'active',
        assignedTo,
        search,
        tags,
        page = '1',
        limit = '20'
      } = req.query;

      const result = await whatsappService.getConversations({
        status: status as 'active' | 'resolved' | 'archived',
        assignedTo: assignedTo as string,
        search: search as string,
        tags: tags ? (tags as string).split(',') : undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });

    } catch (error: any) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get conversations'
      });
    }
  }

  async getConversation(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required'
        });
      }

      const conversation = await whatsappService.getConversation(id);

      res.json({
        success: true,
        data: conversation
      });

    } catch (error: any) {
      console.error('Get conversation error:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Conversation not found'
      });
    }
  }

  async getConversationByPhone(req: Request, res: Response) {
    try {
      const { phone } = req.params;

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const conversation = await whatsappService.getConversationByPhone(phone);

      res.json({
        success: true,
        data: conversation
      });

    } catch (error: any) {
      console.error('Get conversation by phone error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get conversation'
      });
    }
  }

  async sendChatMessage(req: AuthRequest, res: Response) {
    try {
      const data = {
        ...req.body,
        adminId: req.user?.id
      };

      const result = await whatsappService.sendChatMessage(data);

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Send chat message error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send message'
      });
    }
  }

  async getMessages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { limit = '50', before } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required'
        });
      }

      const messages = await whatsappService.getDecryptedMessages(id, 
        parseInt(limit as string),
        before ? new Date(before as string) : undefined
      );

      res.json({
        success: true,
        data: messages
      });

    } catch (error: any) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get messages'
      });
    }
  }

  async updateConversation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { tags, status, assignedTo, customerName } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required'
        });
      }

      const updateData: any = {};
      if (tags) updateData.tags = tags;
      if (status) updateData.status = status;
      if (assignedTo) updateData.assignedTo = assignedTo;
      if (customerName) updateData.customerName = customerName;

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { ...updateData, updatedAt: new Date() }
      });

      res.json({
        success: true,
        data: conversation
      });

    } catch (error: any) {
      console.error('Update conversation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update conversation'
      });
    }
  }

  async assignConversation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { adminId } = req.body;

      if (!adminId) {
        return res.status(400).json({
          success: false,
          error: 'Admin ID is required'
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required'
        });
      }

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { assignedTo: adminId, updatedAt: new Date() }
      });

      res.json({
        success: true,
        data: conversation
      });

    } catch (error: any) {
      console.error('Assign conversation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to assign conversation'
      });
    }
  }

  async markAsResolved(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required'
        });
      }

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { status: 'resolved', updatedAt: new Date() }
      });

      res.json({
        success: true,
        data: conversation
      });

    } catch (error: any) {
      console.error('Mark as resolved error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark conversation as resolved'
      });
    }
  }

  async markMessagesAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required'
        });
      }

      const conversation = await whatsappService.getConversation(id);
      
      await prisma.message.updateMany({
        where: {
          conversationId: id,
          senderType: 'customer',
          status: 'delivered'
        },
        data: { status: 'read' }
      });

      await prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 }
      });

      res.json({
        success: true,
        message: 'Messages marked as read'
      });

    } catch (error: any) {
      console.error('Mark messages as read error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark messages as read'
      });
    }
  }

  async sendBroadcast(req: AuthRequest, res: Response) {
    try {
      const { customerPhones, message, templateName } = req.body;
      const adminId = req.user?.id;

       if (!adminId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - admin ID required'
        });
      }

      if (!customerPhones || !customerPhones.length || (!message && !templateName)) {
        return res.status(400).json({
          success: false,
          error: 'Customer phones and message/template are required'
        });
      }

      const result = await whatsappService.sendBroadcast({
        customerPhones,
        message,
        templateName,
        adminId
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Send broadcast error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send broadcast'
      });
    }
  }

  async updateTags(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { tags } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required'
        });
      }

      if (!tags || !Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          error: 'Tags array is required'
        });
      }

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { tags, updatedAt: new Date() }
      });

      res.json({
        success: true,
        data: conversation
      });

    } catch (error: any) {
      console.error('Update tags error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update tags'
      });
    }
  }

  async updateCustomerInfo(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { customerName } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required'
        });
      }

      if (!customerName) {
        return res.status(400).json({
          success: false,
          error: 'Customer name is required'
        });
      }

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { customerName, updatedAt: new Date() }
      });

      res.json({
        success: true,
        data: conversation
      });

    } catch (error: any) {
      console.error('Update customer info error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update customer info'
      });
    }
  }

  async getWhatsAppStatus(req: Request, res: Response) {
    try {
      const status = whatsappService.getStatus();

      res.json({
        success: true,
        data: status
      });

    } catch (error: any) {
      console.error('Get WhatsApp status error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get WhatsApp status'
      });
    }
  }

  async getTemplates(req: Request, res: Response) {
    try {
      const templates = await whatsappService.getTemplates();

      res.json({
        success: true,
        data: templates
      });

    } catch (error: any) {
      console.error('Get templates error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get templates'
      });
    }
  }

  async getBusinessProfileInfo(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.query;
      
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const profile = await whatsappService.getBusinessProfile(phoneNumber);

      res.json({
        success: true,
        data: profile
      });

    } catch (error: any) {
      console.error('Get business profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get business profile'
      });
    }
  }

  async verifyWebhook(req: Request, res: Response) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'jaspers_market_2024';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
      } else {
        console.log('❌ Webhook verification failed');
        res.sendStatus(403);
      }
    } catch (error: any) {
      console.error('Webhook verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook verification failed'
      });
    }
  }

  async receiveWebhook(req: Request, res: Response) {
    try {
      // This endpoint is handled by the webhook router
      // Just acknowledge receipt
      res.status(200).send('EVENT_RECEIVED');
      
    } catch (error: any) {
      console.error('Webhook receive error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }
  }

  async getChatStatistics(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

      const start = startDate ? new Date(startDate as string) : thirtyDaysAgo;
      const end = endDate ? new Date(endDate as string) : new Date();

      const [totalConversations, activeConversations, totalMessages] = await Promise.all([
        prisma.conversation.count({
          where: {
            createdAt: { gte: start, lte: end }
          }
        }),
        prisma.conversation.count({
          where: {
            createdAt: { gte: start, lte: end },
            status: 'active'
          }
        }),
        prisma.message.count({
          where: {
            createdAt: { gte: start, lte: end }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalConversations,
          activeConversations,
          totalMessages,
          averageResponseTime: 'Calculated separately', // You'd implement this
          responseRate: 'Calculated separately' // You'd implement this
        }
      });

    } catch (error: any) {
      console.error('Get statistics error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get statistics'
      });
    }
  }

  // ========== TOKEN MANAGEMENT ==========

  async refreshToken(req: AuthRequest, res: Response) {
    try {
      const refreshed = await whatsappService.refreshToken();

      res.json({
        success: refreshed,
        message: refreshed ? 'Token refreshed successfully' : 'Token refresh failed'
      });

    } catch (error: any) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to refresh token'
      });
    }
  }

  async checkTokenHealth(req: Request, res: Response) {
    try {
      await whatsappService.checkTokenHealth();
      
      res.json({
        success: true,
        message: 'Token health check completed'
      });

    } catch (error: any) {
      console.error('Token health check error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Token health check failed'
      });
    }
  }
}

// Import Prisma for direct DB operations
import prisma from '../config/database';

// Export controller instance
export const whatsappController = new WhatsAppController();
export default whatsappController;