import axios, { AxiosInstance, AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
import prisma from '../config/database';
import { getSocketManager } from '../middleware/socket.middleware';
import { encryptionService } from '../utils/encryption.utils';
import {
  WhatsAppTextMessage,
  WhatsAppTemplateMessage,
  WhatsAppMediaMessage,
  WhatsAppInteractiveMessage,
  WhatsAppAPIResponse
} from '../types/whatsapp.types';

dotenv.config();

// ========== EXPANDED INTERFACES ==========

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  retailPrice: number | null;
  images: string[];
  stockQuantity: number;
  category?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId?: string;
  senderType: 'customer' | 'admin' | 'bot';
  content: string;
  encryptedContent?: string;
  encryptionIv?: string;
  encryptionAuthTag?: string;
  messageHash?: string;
  messageType: 'text' | 'image' | 'document' | 'interactive' | 'template' | 'audio' | 'video' | 'sticker' | 'location' | 'contacts';
  whatsappMessageId?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: any;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  customerPhone: string;
  customerPhoneHash: string;
  customerName?: string;
  lastMessage?: string;
  lastMessageAt: Date;
  unreadCount: number;
  status: 'active' | 'resolved' | 'archived';
  tags: string[];
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageDTO {
  conversationId?: string;
  customerPhone: string;
  message: string;
  type?: 'text' | 'interactive' | 'template';
  templateName?: string;
  buttons?: Array<{ id: string; title: string }>;
  adminId: string;
}

export interface UpdateConversationDTO {
  tags?: string[];
  status?: 'active' | 'resolved' | 'archived';
  assignedTo?: string;
  customerName?: string;
}

interface TokenInfo {
  token: string;
  expiresAt: number;
  lastRefreshed: Date;
  isRefreshing: boolean;
}

// ========== WHATSAPP CONTACTS INTERFACES ==========

export interface WhatsAppContact {
  input: string;
  wa_id: string;
  status: 'valid' | 'invalid';
  profile_name?: string | undefined;
  last_seen?: string | undefined;
  is_blocked?: boolean | undefined;
  is_business?: boolean | undefined;
  business_name?: string | undefined;
}

export interface ContactProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  phones?: Array<{
    phone: string;
    wa_id: string;
    type?: string;
  }>;
  websites?: string[];
  vertical?: string;
}

export interface ContactInfo {
  wa_id: string;
  profile_name?: string;
  profile_picture_url?: string;
  status?: string;
  last_seen?: Date;
  is_blocked?: boolean;
  is_business?: boolean;
  business_profile?: {
    id?: string;
    name?: string;
    description?: string;
    vertical?: string;
    address?: string;
    email?: string;
    websites?: string[];
    profile_picture_url?: string;
  };
}

export interface ContactSyncResult {
  synced: number;
  newContacts: number;
  updatedContacts: number;
  errors: Array<{ phone: string; error: string }>;
}

export interface MessageStats {
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  lastMessageDate?: Date | undefined;
  firstMessageDate?: Date | undefined;
}

// ========== MAIN WHATSAPP SERVICE CLASS ==========

export class WhatsAppService {
  // WhatsApp API Configuration
  private readonly baseURL: string = 'https://graph.facebook.com/v18.0';
  private readonly phoneId: string;
  private readonly businessId: string;
  private readonly catalogId: string;
  private tokenInfo: TokenInfo;
  private axiosInstance: AxiosInstance;
  private refreshThresholdDays = 7;

  constructor() {
    this.phoneId = process.env.WHATSAPP_PHONE_ID!;
    this.businessId = process.env.WHATSAPP_BUSINESS_ID || '';
    this.catalogId = process.env.WHATSAPP_CATALOG_ID || '';
    const initialToken = process.env.WHATSAPP_ACCESS_TOKEN!;

    if (!this.phoneId || !initialToken) {
      throw new Error('WhatsApp credentials not found in environment variables');
    }

    this.tokenInfo = {
      token: initialToken,
      expiresAt: 0,
      lastRefreshed: new Date(),
      isRefreshing: false
    };

    // Initialize axios instance
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${this.tokenInfo.token}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
    this.checkTokenHealth().catch(console.error);
    this.startTokenMonitor();

    console.log(`✅ WhatsApp Service initialized for Phone ID: ${this.phoneId}`);
  }

  // ========== WHATSAPP API METHODS ==========

  private setupInterceptors() {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          console.log('🔄 Token expired, attempting refresh...');
          try {
            await this.refreshToken();
            originalRequest.headers.Authorization = `Bearer ${this.tokenInfo.token}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private startTokenMonitor() {
    // Check token every 12 hours
    setInterval(() => this.checkAndRefreshToken(), 12 * 60 * 60 * 1000);
  }

  async checkTokenHealth(): Promise<void> {
    try {
      await this.axiosInstance.get(`/${this.phoneId}?fields=id`);
      console.log('✅ Token is valid');

      if (!this.tokenInfo.expiresAt) {
        const estimatedExpiry = Math.floor(Date.now() / 1000) + (55 * 24 * 60 * 60);
        this.tokenInfo.expiresAt = estimatedExpiry;
      }

    } catch (error: any) {
      console.error('❌ Token check failed:', error.response?.data?.error?.message || error.message);
    }
  }

  async refreshToken(): Promise<boolean> {
    if (this.tokenInfo.isRefreshing) {
      return false;
    }

    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;

    if (!appId || !appSecret) {
      console.warn('⚠️ Cannot auto-refresh: FB_APP_ID and FB_APP_SECRET not set');
      return false;
    }

    this.tokenInfo.isRefreshing = true;

    try {
      const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: this.tokenInfo.token
        }
      });

      const newToken = response.data.access_token;
      const expiresIn = response.data.expires_in;

      this.tokenInfo.token = newToken;
      this.tokenInfo.expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
      this.tokenInfo.lastRefreshed = new Date();
      this.tokenInfo.isRefreshing = false;

      this.axiosInstance.defaults.headers.Authorization = `Bearer ${newToken}`;

      console.log('✅ Token refreshed!');
      return true;

    } catch (error: any) {
      this.tokenInfo.isRefreshing = false;
      console.error('❌ Token refresh failed:', error.response?.data?.error?.message || error.message);
      return false;
    }
  }

  private async checkAndRefreshToken(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const daysUntilExpiry = (this.tokenInfo.expiresAt - now) / (24 * 60 * 60);

      if (daysUntilExpiry < this.refreshThresholdDays) {
        await this.refreshToken();
      }
    } catch (error) {
      console.error('Token monitor error:', error);
    }
  }

  // ========== WHATSAPP CONTACTS API ==========

  /**
   * Get registered contacts from WhatsApp Business account
   */
  async getRegisteredContacts(limit: number = 500): Promise<WhatsAppContact[]> {
    try {
      console.log('📞 Fetching registered WhatsApp contacts...');

      // WhatsApp doesn't have direct "get all contacts" API
      // We get contacts from recent messages
      const conversations = await this.getRecentConversations(limit);

      // Extract unique phone numbers
      const uniqueContacts = new Map<string, WhatsAppContact>();

      for (const conv of conversations) {
        if (conv.from) {
          const phone = this.formatPhoneNumber(conv.from);
          if (!uniqueContacts.has(phone)) {
            try {
              const contactInfo = await this.getContactInfo(phone);
              uniqueContacts.set(phone, {
                input: phone,
                wa_id: phone,
                status: 'valid',
                profile_name: contactInfo?.profile_name,
                last_seen: contactInfo?.last_seen?.toISOString(),
                is_blocked: contactInfo?.is_blocked,
                is_business: contactInfo?.is_business,
                business_name: contactInfo?.business_profile?.name
              });
            } catch (error) {
              // If we can't get contact info, still add as valid contact
              uniqueContacts.set(phone, {
                input: phone,
                wa_id: phone,
                status: 'valid'
              });
            }

            // Rate limiting to avoid hitting API limits
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      const contacts = Array.from(uniqueContacts.values());
      console.log(`✅ Found ${contacts.length} registered contacts`);
      return contacts;

    } catch (error: any) {
      console.error('❌ Error fetching registered contacts:', error.response?.data || error.message);
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }
  }

  /**
   * Get recent conversations to extract contacts
   */
  private async getRecentConversations(limit: number = 100): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get(`${this.phoneId}/messages`, {
        params: {
          fields: 'from,id,timestamp,type',
          limit: Math.min(limit, 1000),
          sort: 'desc'
        }
      });

      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching conversations:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get detailed contact information
   */
  async getContactInfo(phoneNumber: string): Promise<ContactInfo | null> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await this.axiosInstance.get(`${formattedPhone}`, {
        params: {
          fields: 'profile,status,last_seen,blocked,business_profile'
        }
      });

      if (response.data.error) {
        console.warn(`Contact info not available for ${phoneNumber}:`, response.data.error.message);
        return null;
      }

      const data = response.data;

      return {
        wa_id: formattedPhone,
        profile_name: data.profile?.name,
        profile_picture_url: data.profile?.picture?.url,
        status: data.status?.status,
        last_seen: data.status?.timestamp ?
          new Date(parseInt(data.status.timestamp) * 1000) : undefined,
        is_blocked: data.blocked || false,
        is_business: !!data.business_profile,
        business_profile: data.business_profile ? {
          id: data.business_profile.id,
          name: data.business_profile.name,
          description: data.business_profile.description,
          vertical: data.business_profile.vertical,
          address: data.business_profile.address,
          email: data.business_profile.email,
          websites: data.business_profile.websites,
          profile_picture_url: data.business_profile.profile_picture_url
        } : undefined
      };
    } catch (error: any) {
      console.error(`Error fetching contact info for ${phoneNumber}:`, error.response?.data?.error?.message || error.message);
      return null;
    }
  }

  /**
   * Check if phone numbers are valid WhatsApp numbers
   */
  async checkContacts(phoneNumbers: string[]): Promise<WhatsAppContact[]> {
    try {
      const response = await this.axiosInstance.post(`${this.phoneId}/contacts`, {
        contacts: phoneNumbers.map(phone => ({
          input: phone,
          wa_id: this.formatPhoneNumber(phone)
        })),
        blocking: 'no_wait'
      });

      return response.data.contacts || [];
    } catch (error: any) {
      console.error('Error checking contacts:', error.response?.data || error.message);

      // Fallback: check each contact individually
      return await this.checkContactsIndividually(phoneNumbers);
    }
  }

  /**
   * Fallback method to check contacts individually
   */
  private async checkContactsIndividually(phoneNumbers: string[]): Promise<WhatsAppContact[]> {
    const results: WhatsAppContact[] = [];

    for (const phone of phoneNumbers) {
      try {
        const formattedPhone = this.formatPhoneNumber(phone);
        // Try to get contact info - if successful, contact is valid
        const contactInfo = await this.getContactInfo(phone);

        results.push({
          input: phone,
          wa_id: formattedPhone,
          status: contactInfo ? 'valid' : 'invalid'
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          input: phone,
          wa_id: this.formatPhoneNumber(phone),
          status: 'invalid'
        });
      }
    }

    return results;
  }

  /**
   * Sync WhatsApp contacts with local database
   */
  async syncContactsWithDatabase(): Promise<ContactSyncResult> {
    try {
      console.log('🔄 Syncing WhatsApp contacts with database...');

      const whatsappContacts = await this.getRegisteredContacts(200);

      const result: ContactSyncResult = {
        synced: 0,
        newContacts: 0,
        updatedContacts: 0,
        errors: []
      };

      for (const contact of whatsappContacts) {
        if (contact.status !== 'valid') continue;

        try {
          const phoneHash = encryptionService.hashPhone(contact.wa_id);
          const maskedPhone = this.maskPhoneNumber(contact.wa_id);

          // Check if contact exists in database
          const existingCustomer = await prisma.customer.findUnique({
            where: { phoneHash }
          });

          if (existingCustomer) {
            // Update existing customer
            await prisma.customer.update({
              where: { id: existingCustomer.id },
              data: {
                lastActive: new Date(),
                status: 'active',
                name: contact.profile_name || existingCustomer.name,
                ...(contact.is_business && {
                  customerType: 'business',
                  businessName: contact.business_name
                })
              }
            });
            result.updatedContacts++;
          } else {
            // Create new customer
            await prisma.customer.create({
              data: {
                phone: maskedPhone,
                phoneHash,
                name: contact.profile_name || `Customer ${maskedPhone.slice(-4)}`,
                source: 'whatsapp',
                tags: ['whatsapp-registered'],
                status: 'active',
                lastActive: new Date(),
                whatsappOptIn: true,
                ...(contact.is_business && {
                  customerType: 'business',
                  businessName: contact.business_name
                })
              }
            });
            result.newContacts++;
          }

          result.synced++;
        } catch (error: any) {
          result.errors.push({
            phone: contact.wa_id,
            error: error.message
          });
        }
      }

      console.log(`✅ Contact sync completed: ${result.synced} synced, ${result.newContacts} new, ${result.updatedContacts} updated`);

      return result;
    } catch (error: any) {
      console.error('❌ Contact sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Get recent contacts (last X days)
   */
  async getRecentContacts(days: number = 7, limit: number = 100): Promise<ContactInfo[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceTimestamp = Math.floor(since.getTime() / 1000);

      const response = await this.axiosInstance.get(`${this.phoneId}/messages`, {
        params: {
          fields: 'from,id,timestamp',
          since: sinceTimestamp,
          limit
        }
      });

      const messages = response.data.data || [];
      const uniquePhones = Array.from(new Set(messages.map((msg: any) => msg.from)));

      // Get contact info for each unique phone
      const contacts: ContactInfo[] = [];

      for (const phone of uniquePhones.slice(0, 50)) {
        const contactInfo = await this.getContactInfo(phone);
        if (contactInfo) {
          contacts.push(contactInfo);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return contacts;
    } catch (error: any) {
      console.error('Error fetching recent contacts:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get contact's profile picture
   */
  async getContactProfilePicture(phoneNumber: string): Promise<string | null> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await this.axiosInstance.get(`${formattedPhone}/picture`, {
        params: {
          type: 'large',
          redirect: false
        }
      });

      return response.data.url || null;
    } catch (error: any) {
      console.error(`Error fetching profile picture for ${phoneNumber}:`, error.response?.data?.error?.message || error.message);
      return null;
    }
  }

  /**
   * Block a contact
   */
  async blockContact(phoneNumber: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      await this.axiosInstance.post(`${formattedPhone}/block`);

      console.log(`✅ Contact ${phoneNumber} blocked`);
      return true;
    } catch (error: any) {
      console.error(`Error blocking contact ${phoneNumber}:`, error.response?.data?.error?.message || error.message);
      return false;
    }
  }

  /**
   * Unblock a contact
   */
  async unblockContact(phoneNumber: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      await this.axiosInstance.post(`${formattedPhone}/unblock`);

      console.log(`✅ Contact ${phoneNumber} unblocked`);
      return true;
    } catch (error: any) {
      console.error(`Error unblocking contact ${phoneNumber}:`, error.response?.data?.error?.message || error.message);
      return false;
    }
  }

  /**
   * Get blocked contacts
   */
  async getBlockedContacts(): Promise<string[]> {
    try {
      const recentContacts = await this.getRecentContacts(30, 200);

      const blockedContacts = [];
      for (const contact of recentContacts) {
        if (contact.is_blocked) {
          blockedContacts.push(contact.wa_id);
        }
      }

      return blockedContacts;
    } catch (error: any) {
      console.error('Error fetching blocked contacts:', error.message);
      return [];
    }
  }

  /**
   * Get contact's message statistics
   */
  async getContactMessageStats(phoneNumber: string, days: number = 30): Promise<MessageStats> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceTimestamp = Math.floor(since.getTime() / 1000);

      const response = await this.axiosInstance.get(`${this.phoneId}/messages`, {
        params: {
          fields: 'from,id,timestamp,direction',
          since: sinceTimestamp,
          to: formattedPhone,
          limit: 1000
        }
      });

      const messages = response.data.data || [];

      if (messages.length === 0) {
        return {
          totalMessages: 0,
          incomingMessages: 0,
          outgoingMessages: 0
        };
      }

      const incomingMessages = messages.filter((msg: any) => msg.direction === 'incoming').length;
      const outgoingMessages = messages.filter((msg: any) => msg.direction === 'outgoing').length;

      const timestamps = messages.map((msg: any) => parseInt(msg.timestamp) * 1000);
      const lastMessageDate = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;
      const firstMessageDate = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined;

      return {
        totalMessages: messages.length,
        incomingMessages,
        outgoingMessages,
        lastMessageDate,
        firstMessageDate
      };
    } catch (error: any) {
      console.error(`Error fetching message stats for ${phoneNumber}:`, error.response?.data?.error?.message || error.message);
      return {
        totalMessages: 0,
        incomingMessages: 0,
        outgoingMessages: 0
      };
    }
  }

  /**
   * Search for contacts by name or phone
   */
  async searchContacts(searchTerm: string): Promise<ContactInfo[]> {
    try {
      const recentContacts = await this.getRecentContacts(30, 200);

      const filtered = recentContacts.filter(contact => {
        const searchLower = searchTerm.toLowerCase();
        return (
          (contact.profile_name?.toLowerCase().includes(searchLower)) ||
          contact.wa_id.includes(searchTerm) ||
          (contact.business_profile?.name?.toLowerCase().includes(searchLower))
        );
      });

      return filtered.slice(0, 50);
    } catch (error: any) {
      console.error('Error searching contacts:', error.message);
      return [];
    }
  }

  /**
   * Get business profile of a contact
   */
  async getBusinessProfile(phoneNumber: string): Promise<any> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await this.axiosInstance.get(`${formattedPhone}/whatsapp_business_profile`);

      if (response.data.error) {
        return null;
      }

      return response.data;
    } catch (error: any) {
      console.error(`Error fetching business profile for ${phoneNumber}:`, error.response?.data?.error?.message || error.message);
      return null;
    }
  }

  // ========== PRODUCT CATALOG MANAGEMENT ==========

  async syncProductToCatalog(product: Product): Promise<string> {
    try {
      if (!this.catalogId) {
        throw new Error('WHATSAPP_CATALOG_ID not configured');
      }

      const response = await this.axiosInstance.post(
        `${this.catalogId}/products`,
        {
          retailer_id: product.id.toString(),
          name: product.name,
          description: product.description,
          price: Math.round((product.retailPrice || product.price) * 100), // in kobo
          currency: 'NGN',
          image_url: product.images[0] || '',
          url: `${process.env.STORE_URL || 'https://yourstore.com'}/products/${product.id}`,
          availability: product.stockQuantity > 0 ? 'in stock' : 'out of stock',
          category: product.category || 'General'
        }
      );

      console.log(`✅ Product synced to catalog: ${product.name}`);
      return response.data.id; // WhatsApp product ID

    } catch (error: any) {
      console.error('❌ WhatsApp catalog sync error:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  async updateCatalogProduct(whatsappProductId: string, product: Partial<Product>): Promise<void> {
    try {
      if (!this.catalogId) {
        throw new Error('WHATSAPP_CATALOG_ID not configured');
      }

      const updateData: any = {};
      if (product.name) updateData.name = product.name;
      if (product.description) updateData.description = product.description;
      if (product.price !== undefined) updateData.price = Math.round(product.price * 100);
      if (product.retailPrice !== undefined) updateData.price = Math.round(product.retailPrice * 100);
      if (product.stockQuantity !== undefined) {
        updateData.availability = product.stockQuantity > 0 ? 'in stock' : 'out of stock';
      }
      if (product.images?.[0]) updateData.image_url = product.images[0];
      if (product.category) updateData.category = product.category;

      await this.axiosInstance.post(
        `${this.catalogId}/products/${whatsappProductId}`,
        updateData
      );

      console.log(`✅ Catalog product updated: ${whatsappProductId}`);

    } catch (error: any) {
      console.error('❌ Catalog update error:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  async deleteCatalogProduct(whatsappProductId: string): Promise<void> {
    try {
      if (!this.catalogId) {
        throw new Error('WHATSAPP_CATALOG_ID not configured');
      }

      await this.axiosInstance.delete(`${this.catalogId}/products/${whatsappProductId}`);
      console.log(`✅ Catalog product deleted: ${whatsappProductId}`);

    } catch (error: any) {
      console.error('❌ Catalog delete error:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  async getCatalogProducts(): Promise<any> {
    try {
      if (!this.catalogId) {
        throw new Error('WHATSAPP_CATALOG_ID not configured');
      }

      const response = await this.axiosInstance.get(`${this.catalogId}/products`);
      return response.data;

    } catch (error: any) {
      console.error('❌ Get catalog products error:', error.response?.data?.error || error.message);
      return { data: [] };
    }
  }

  // ========== MESSAGE SENDING ==========

  async sendMessage<T>(phoneNumber: string, messageData: Omit<T, 'messaging_product' | 'recipient_type' | 'to'>): Promise<WhatsAppAPIResponse> {
    try {
      const url = `${this.phoneId}/messages`;

      const payload = {
        messaging_product: 'whatsapp' as const,
        recipient_type: 'individual' as const,
        to: this.formatPhoneNumber(phoneNumber),
        ...messageData
      };

      const response: AxiosResponse<WhatsAppAPIResponse> = await this.axiosInstance.post(url, payload);
      return response.data;

    } catch (error: any) {
      console.error('❌ WhatsApp API Error:', error.response?.data?.error || error.message);

      if (error.response?.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.sendMessage(phoneNumber, messageData);
        }
      }

      throw new Error(`WhatsApp API Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async sendText(phoneNumber: string, text: string, previewUrl: boolean = false): Promise<WhatsAppAPIResponse> {
    const messageData: Omit<WhatsAppTextMessage, 'messaging_product' | 'recipient_type' | 'to'> = {
      type: 'text',
      text: {
        body: text,
        preview_url: previewUrl
      }
    };

    return this.sendMessage(phoneNumber, messageData);
  }

  async sendTemplate(
    phoneNumber: string,
    templateName: string,
    languageCode: string = 'en_US',
    components?: any[]
  ): Promise<WhatsAppAPIResponse> {
    const templateData: any = {
      name: templateName,
      language: { code: languageCode }
    };

    if (components?.length) {
      templateData.components = components;
    }

    const messageData: Omit<WhatsAppTemplateMessage, 'messaging_product' | 'recipient_type' | 'to'> = {
      type: 'template',
      template: templateData
    };

    return this.sendMessage(phoneNumber, messageData);
  }

  async sendInteractiveButtons(
    phoneNumber: string,
    message: string,
    buttons: Array<{ id: string, title: string }>
  ): Promise<WhatsAppAPIResponse> {
    const messageData: Omit<WhatsAppInteractiveMessage, 'messaging_product' | 'recipient_type' | 'to'> = {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: message
        },
        action: {
          buttons: buttons.map(button => ({
            type: 'reply',
            reply: button
          }))
        }
      }
    };

    return this.sendMessage(phoneNumber, messageData);
  }

  async sendCatalogMessage(
    phoneNumber: string,
    message: string,
    catalogId?: string
  ): Promise<WhatsAppAPIResponse> {
    const catalogToUse = catalogId || this.catalogId;

    if (!catalogToUse) {
      throw new Error('Catalog ID not provided or configured');
    }

    const messageData: any = {
      type: 'interactive',
      interactive: {
        type: 'catalog_message',
        body: {
          text: message
        },
        action: {
          name: 'catalog',
          parameters: {
            catalog_id: catalogToUse,
            product_retailer_id: '' // Optional: specific product
          }
        }
      }
    };

    return this.sendMessage(phoneNumber, messageData);
  }

  async sendInteractiveList(
    phoneNumber: string,
    message: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>
  ): Promise<WhatsAppAPIResponse> {
    const messageData: any = {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: message
        },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    };

    return this.sendMessage(phoneNumber, messageData);
  }

  // ========== MEDIA MESSAGES ==========

  async sendImage(phoneNumber: string, imageUrl: string, caption?: string): Promise<WhatsAppAPIResponse> {
    const mediaId = await this.uploadMedia(imageUrl, 'image');

    const messageData: Omit<WhatsAppMediaMessage, 'messaging_product' | 'recipient_type' | 'to'> = {
      type: 'image',
      image: {
        id: mediaId,
        ...(caption && { caption })
      }
    };

    return this.sendMessage(phoneNumber, messageData);
  }

  async sendDocument(phoneNumber: string, documentUrl: string, filename: string, caption?: string): Promise<WhatsAppAPIResponse> {
    const mediaId = await this.uploadMedia(documentUrl, 'document');

    const messageData: Omit<WhatsAppMediaMessage, 'messaging_product' | 'recipient_type' | 'to'> = {
      type: 'document',
      document: {
        id: mediaId,
        filename: filename,
        ...(caption && { caption })
      }
    };

    return this.sendMessage(phoneNumber, messageData);
  }

  async uploadMedia(url: string, type: string): Promise<string> {
    try {
      const uploadUrl = `${this.phoneId}/media`;

      const response = await this.axiosInstance.post(uploadUrl, {
        messaging_product: 'whatsapp',
        url: url,
        type: type
      });

      return response.data.id;
    } catch (error: any) {
      console.error('Media upload error:', error.response?.data || error.message);
      throw error;
    }
  }

  // ========== CHAT MANAGEMENT METHODS ==========

  private encryptMessageContent(content: string): { encrypted: string; iv: string; authTag: string } {
    return encryptionService.encrypt(content);
  }

  private decryptMessageContent(encrypted: string, iv: string, authTag: string): string {
    try {
      return encryptionService.decrypt(encrypted, iv, authTag);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted message - decryption failed]';
    }
  }

  private async storeEncryptedMessage(data: {
    conversationId: string;
    senderId?: string | undefined;
    senderType: 'customer' | 'admin' | 'bot';
    content: string;
    messageType: string;
    whatsappMessageId?: string | undefined;
    status: string;
    metadata?: any;
  }) {
    const { content, ...rest } = data;

    const { encrypted, iv, authTag } = this.encryptMessageContent(content);

    const message = await prisma.message.create({
      data: {
        ...rest,
        encryptedContent: encrypted,
        encryptionIv: iv,
        encryptionAuthTag: authTag,
        content: '[Encrypted]',
        messageHash: encryptionService.generateMessageHash(content, new Date())
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return message;
  }

  // ========== CONVERSATION MANAGEMENT ==========

  async getConversations(params: {
    status?: 'active' | 'resolved' | 'archived' | undefined;
    assignedTo?: string | undefined;
    search?: string | undefined;
    tags?: string[] | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }) {
    const {
      status = 'active',
      assignedTo,
      search,
      tags,
      page = 1,
      limit = 20
    } = params;

    const skip = (page - 1) * limit;

    let searchHash: string | undefined;
    if (search && this.looksLikePhoneNumber(search)) {
      searchHash = encryptionService.hashPhone(search);
    }

    const where: any = {
      status,
      ...(assignedTo && { assignedTo }),
      ...(tags && tags.length > 0 && {
        tags: {
          hasEvery: tags
        }
      }),
      ...(search && {
        OR: [
          ...(searchHash ? [{ customerPhoneHash: { contains: searchHash } }] : []),
          { customerName: { contains: search, mode: 'insensitive' } },
          { lastMessage: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          assignedAdmin: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              messages: {
                where: {
                  status: 'delivered',
                  senderType: 'customer'
                }
              }
            }
          }
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.conversation.count({ where })
    ]);

    return {
      data: conversations.map(conv => ({
        id: conv.id,
        customer: conv.customerName || `Customer ${this.maskPhoneNumber(conv.customerPhone).slice(-4)}`,
        phone: this.maskPhoneNumber(conv.customerPhone),
        lastMessage: '[Encrypted message]',
        timestamp: this.formatTimestamp(conv.lastMessageAt),
        unread: conv.unreadCount,
        tags: conv.tags,
        avatar: this.getAvatar(conv.customerName || conv.customerPhone),
        status: 'online' as 'online' | 'offline',
        assignedTo: conv.assignedAdmin?.name,
        orders: []
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getConversation(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        assignedAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = await this.getDecryptedMessages(conversationId);

    return {
      ...conversation,
      messages: messages,
      customer: conversation.customerName || `Customer ${this.maskPhoneNumber(conversation.customerPhone).slice(-4)}`,
      phone: this.maskPhoneNumber(conversation.customerPhone)
    };
  }

  async getConversationByPhone(customerPhone: string) {
    const phoneHash = encryptionService.hashPhone(customerPhone);

    let conversation = await prisma.conversation.findFirst({
      where: { customerPhoneHash: phoneHash },
      include: {
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          customerPhone: this.maskPhoneNumber(customerPhone),
          customerPhoneHash: phoneHash,
          customerName: `Customer ${customerPhone.slice(-4)}`,
          status: 'active',
          tags: ['New Customer'],
          unreadCount: 0
        },
        include: {
          messages: true
        }
      });
    }

    return conversation;
  }

  async sendChatMessage(data: SendMessageDTO) {
    const { customerPhone, message, type = 'text', templateName, buttons, adminId } = data;

    let whatsappResponse;
    let messageType: 'text' | 'interactive' | 'template' = type;

    try {
      switch (type) {
        case 'text':
          whatsappResponse = await this.sendText(customerPhone, message);
          break;
        case 'interactive':
          if (!buttons || buttons.length === 0) {
            throw new Error('Buttons are required for interactive messages');
          }
          whatsappResponse = await this.sendInteractiveButtons(customerPhone, message, buttons);
          break;
        case 'template':
          if (!templateName) {
            throw new Error('Template name is required');
          }
          whatsappResponse = await this.sendTemplate(customerPhone, templateName);
          break;
        default:
          throw new Error('Invalid message type');
      }

      const conversation = await this.getConversationByPhone(customerPhone);

      const savedMessage = await this.storeEncryptedMessage({
        conversationId: conversation.id,
        senderId: adminId,
        senderType: 'admin',
        content: message,
        messageType: messageType,
        whatsappMessageId: whatsappResponse.messages?.[0]?.id,
        status: 'sent',
        metadata: {
          type,
          templateName,
          buttons,
          whatsappResponse
        }
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: '[Encrypted message]',
          lastMessageAt: new Date(),
          updatedAt: new Date()
        }
      });

      try {
        const socketManager = getSocketManager();
        socketManager.notifyNewMessage(customerPhone, {
          id: savedMessage.id,
          sender: 'admin',
          text: message,
          time: this.formatTime(savedMessage.createdAt),
          isBot: false
        });
      } catch (socketError) {
        console.error('Socket notification failed:', socketError);
      }

      return {
        messageId: savedMessage.id,
        whatsappMessageId: whatsappResponse.messages?.[0]?.id,
        timestamp: savedMessage.createdAt
      };

    } catch (error: any) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async saveIncomingMessage(data: {
    customerPhone: string;
    content: string;
    messageType: string;
    whatsappMessageId: string;
    metadata?: any;
  }) {
    const { customerPhone, content, messageType, whatsappMessageId, metadata } = data;

    const conversation = await this.getConversationByPhone(customerPhone);

    const message = await this.storeEncryptedMessage({
      conversationId: conversation.id,
      senderType: 'customer',
      content,
      messageType: messageType as any,
      whatsappMessageId,
      status: 'delivered',
      metadata
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: '[Encrypted message]',
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
        updatedAt: new Date()
      }
    });

    try {
      const socketManager = getSocketManager();
      socketManager.notifyNewMessage(customerPhone, {
        id: message.id,
        sender: 'customer',
        text: content,
        time: this.formatTime(message.createdAt),
        isBot: false
      });
    } catch (error) {
      console.error('Socket notification failed:', error);
    }

    return message;
  }

  public async getDecryptedMessages(conversationId: string, limit = 50, before?: Date) {
    const where: any = { conversationId };
    if (before) {
      where.createdAt = { lt: before };
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true
          }
        },
        conversation: {
          select: {
            id: true,
            customerPhone: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const decryptedMessages = messages.reverse().map(msg => {
      let content = msg.content;

      if (msg.encryptedContent && msg.encryptionIv && msg.encryptionAuthTag) {
        try {
          content = this.decryptMessageContent(
            msg.encryptedContent,
            msg.encryptionIv,
            msg.encryptionAuthTag
          );
        } catch (error) {
          console.error('Failed to decrypt message:', msg.id, error);
          content = '[Encrypted message - decryption failed]';
        }
      }

      return {
        id: msg.id,
        sender: msg.senderType === 'admin' ? 'admin' : 'customer',
        text: content,
        time: this.formatTime(msg.createdAt),
        isBot: msg.senderType === 'bot',
        timestamp: msg.createdAt.toISOString(),
        messageType: msg.messageType,
        status: msg.status
      };
    });

    return decryptedMessages;
  }


  // services/whatsapp.service.ts (add this method to your existing service)

  async submitTemplate(data: {
    name: string;
    category: string;
    language: string;
    components: any[];
  }): Promise<any> {
    try {
      if (!this.businessId) {
        throw new Error('WHATSAPP_BUSINESS_ID required for templates');
      }

      const url = `${this.businessId}/message_templates`;

      const response = await this.axiosInstance.post(url, {
        name: data.name,
        category: data.category,
        language: data.language,
        components: data.components
      });

      console.log(`✅ Template submitted to WhatsApp: ${data.name}`);
      return response.data;

    } catch (error: any) {
      console.error('❌ WhatsApp template submission error:', error.response?.data || error.message);
      throw new Error(`WhatsApp template submission failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getTemplateStatus(templateName: string): Promise<'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED'> {
    try {
      if (!this.businessId) {
        throw new Error('WHATSAPP_BUSINESS_ID required for template operations');
      }

      const url = `${this.businessId}/message_templates?name=${encodeURIComponent(templateName)}`;

      const response = await this.axiosInstance.get(url);

      if (!response.data.data || response.data.data.length === 0) {
        console.log(`Template "${templateName}" not found, returning PENDING`);
        return 'PENDING';
      }

      const template = response.data.data[0];
      const status = (template.status || 'PENDING').toUpperCase() as any;

      console.log(`ℹ️ Template "${templateName}" status: ${status}`);
      return status;

    } catch (error: any) {
      console.error('❌ WhatsApp template status check error:', error.response?.data || error.message);
      console.log(`ℹ️ Defaulting to PENDING status for template "${templateName}"`);
      return 'PENDING';
    }
  }

  async getWhatsAppTemplates(): Promise<any> {
    try {
      if (!this.businessId) {
        throw new Error('WHATSAPP_BUSINESS_ID required for templates');
      }

      const url = `${this.businessId}/message_templates`;
      const response = await this.axiosInstance.get(url);

      return response.data;

    } catch (error: any) {
      console.error('Get WhatsApp templates error:', error.response?.data || error.message);
      return { data: [] };
    }
  }
  // ========== UTILITY METHODS ==========

  private formatPhoneNumber(phoneNumber: string): string {
    let formatted = phoneNumber.replace(/\D/g, '');

    if (formatted.startsWith('0')) {
      formatted = '234' + formatted.substring(1);
    }

    if (!formatted.startsWith('234')) {
      formatted = '234' + formatted;
    }

    return formatted;
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!process.env.WHATSAPP_WEBHOOK_SECRET) {
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }

  maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    const visibleDigits = 4;
    const prefix = phone.slice(0, phone.length - visibleDigits - 2);
    const suffix = phone.slice(-visibleDigits);
    return `${prefix}****${suffix}`;
  }

  private looksLikePhoneNumber(text: string): boolean {
    const cleanText = text.replace(/\D/g, '');
    return cleanText.length >= 8 && cleanText.length <= 15;
  }

  private formatTimestamp(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private getAvatar(nameOrPhone: string): string {
    const parts = nameOrPhone.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameOrPhone.slice(0, 2).toUpperCase();
  }

  async getTemplates(): Promise<any> {
    if (!this.businessId) {
      throw new Error('WHATSAPP_BUSINESS_ID required for templates');
    }

    try {
      const url = `${this.businessId}/message_templates`;
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Get templates error:', error.response?.data || error.message);
      return { data: [] };
    }
  }
  getStatus() {
    const now = Math.floor(Date.now() / 1000);
    const daysUntilExpiry = this.tokenInfo.expiresAt ?
      Math.floor((this.tokenInfo.expiresAt - now) / (24 * 60 * 60)) : null;

    return {
      phoneId: this.phoneId,
      businessId: this.businessId || 'Not set',
      catalogId: this.catalogId || 'Not set',
      tokenValid: this.tokenInfo.expiresAt > now,
      daysUntilExpiry,
      lastRefreshed: this.tokenInfo.lastRefreshed,
      // Contact stats
      contactStats: {
        totalRegistered: 0, // This would need to be calculated
        lastSync: new Date()
      }
    };
  }

  // ========== BROADCAST & BULK MESSAGES ==========

  async sendBroadcast(data: {
    customerPhones: string[];
    message: string;
    templateName?: string;
    adminId: string;
  }) {
    const { customerPhones, message, templateName, adminId } = data;

    const results = [];
    const errors = [];

    const batch = customerPhones.slice(0, 100);

    for (const phone of batch) {
      try {
        let result;

        if (templateName) {
          result = await this.sendTemplate(phone, templateName);
        } else {
          result = await this.sendText(phone, message);
        }

        await this.getConversationByPhone(phone);

        results.push({
          phone: this.maskPhoneNumber(phone),
          success: true,
          messageId: result.messages?.[0]?.id
        });

        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error: any) {
        errors.push({
          phone: this.maskPhoneNumber(phone),
          error: error.message
        });
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'broadcast_sent',
        description: `Sent broadcast to ${results.length} customers`,
        metadata: {
          total: batch.length,
          successful: results.length,
          failed: errors.length,
          message,
          templateName
        }
      }
    });

    return {
      sent: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  // ========== CONTACTS STATISTICS ==========

  async getContactsOverview(): Promise<{
    totalContacts: number;
    businessContacts: number;
    blockedContacts: number;
    uniqueCountries: string[];
    messagesLast30Days: {
      total: number;
      incoming: number;
      outgoing: number;
      averagePerDay: number;
    };
  }> {
    try {
      const recentContacts = await this.getRecentContacts(30, 500);

      const totalContacts = recentContacts.length;
      const businessContacts = recentContacts.filter(c => c.is_business).length;
      const blockedContacts = recentContacts.filter(c => c.is_blocked).length;

      // Get unique countries
      const countries = new Set<string>();
      recentContacts.forEach(contact => {
        if (contact.wa_id.startsWith('234')) countries.add('Nigeria');
        else if (contact.wa_id.startsWith('91')) countries.add('India');
        else if (contact.wa_id.startsWith('1')) countries.add('USA/Canada');
        else if (contact.wa_id.startsWith('44')) countries.add('UK');
        else if (contact.wa_id.startsWith('27')) countries.add('South Africa');
        else if (contact.wa_id.startsWith('254')) countries.add('Kenya');
        else countries.add('Other');
      });

      // Get message statistics for last 30 days
      const messageStats = await this.getMessagesLast30Days();

      return {
        totalContacts,
        businessContacts,
        blockedContacts,
        uniqueCountries: Array.from(countries),
        messagesLast30Days: messageStats
      };
    } catch (error: any) {
      console.error('Error fetching contacts overview:', error);
      return {
        totalContacts: 0,
        businessContacts: 0,
        blockedContacts: 0,
        uniqueCountries: [],
        messagesLast30Days: {
          total: 0,
          incoming: 0,
          outgoing: 0,
          averagePerDay: 0
        }
      };
    }
  }

  private async getMessagesLast30Days(): Promise<{
    total: number;
    incoming: number;
    outgoing: number;
    averagePerDay: number;
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceTimestamp = Math.floor(since.getTime() / 1000);

      const response = await this.axiosInstance.get(`${this.phoneId}/messages`, {
        params: {
          fields: 'id,timestamp,direction',
          since: sinceTimestamp,
          limit: 1000
        }
      });

      const messages = response.data.data || [];
      const incoming = messages.filter((msg: any) => msg.direction === 'incoming').length;
      const outgoing = messages.filter((msg: any) => msg.direction === 'outgoing').length;

      return {
        total: messages.length,
        incoming,
        outgoing,
        averagePerDay: Math.round(messages.length / 30)
      };
    } catch (error) {
      return {
        total: 0,
        incoming: 0,
        outgoing: 0,
        averagePerDay: 0
      };
    }
  }
}

// Singleton
let whatsappServiceInstance: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappServiceInstance) {
    whatsappServiceInstance = new WhatsAppService();
  }
  return whatsappServiceInstance;
}

export const whatsappService = getWhatsAppService();
export default whatsappService;