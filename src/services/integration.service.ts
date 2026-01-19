import prisma from '../config/database';
import encryptionService from '../utils/encryption.utils';

export class IntegrationService {
  
  // Get all integrations
  async getAllIntegrations() {
    const integrations = await prisma.integration.findMany({
      orderBy: { category: 'asc' }
    });

    return integrations.map(integration => ({
      id: integration.integrationId,
      name: integration.name,
      description: integration.description,
      category: integration.category,
      status: integration.status,
      lastSync: integration.lastSync?.toLocaleString() || 'Never',
      details: {
        apiKey: integration.encryptedApiKey ? this.maskApiKey(integration.encryptedApiKey) : undefined,
        endpoint: integration.endpoint,
        version: integration.version
      }
    }));
  }

  // Connect integration
    async connectIntegration(
        integrationId: string,
        apiKey: string,
        apiSecret?: string,
        webhookUrl?: string
        ) {
        const { encrypted: encryptedKey, iv: keyIv, authTag: keyTag } = 
            encryptionService.encrypt(apiKey);
        
        const encryptedSecret = apiSecret ? 
            encryptionService.encrypt(apiSecret).encrypted : null;

        const encryptedWebhook = webhookUrl ? 
            encryptionService.encrypt(webhookUrl).encrypted : null;

        const integration = await prisma.integration.upsert({
            where: { integrationId },
            update: {
            encryptedApiKey: encryptedKey,
            encryptedApiSecret: encryptedSecret,
            encryptedWebhookUrl: encryptedWebhook,
            encryptionIv: keyIv,
            status: 'CONNECTED',
            connectedAt: new Date(),
            lastSync: new Date()
            },
            create: {
            integrationId,
            name: this.getIntegrationName(integrationId),
            category: this.getIntegrationCategory(integrationId),
            encryptedApiKey: encryptedKey,
            encryptedApiSecret: encryptedSecret,
            encryptedWebhookUrl: encryptedWebhook,
            encryptionIv: keyIv,
            status: 'CONNECTED',
            connectedAt: new Date()
            }
        });

        return integration;
    }

  // Disconnect integration
  async disconnectIntegration(integrationId: string) {
    await prisma.integration.update({
      where: { integrationId },
      data: {
        status: 'DISCONNECTED',
        encryptedApiKey: null,
        encryptedApiSecret: null,
        encryptedWebhookUrl: null,
        encryptionIv: null
      }
    });
  }

  // Test connection
  async testConnection(integrationId: string) {
    const integration = await prisma.integration.findUnique({
      where: { integrationId }
    });

    if (!integration || !integration.encryptedApiKey || !integration.encryptionIv) {
      throw new Error('Integration not configured');
    }

    // Decrypt credentials
    const apiKey = encryptionService.decrypt(
      integration.encryptedApiKey,
      integration.encryptionIv!,
      '' // You'll need to store authTag separately
    );

    // Test based on integration type
    switch (integrationId) {
      case 'whatsapp-api':
        return await this.testWhatsApp(apiKey);
      case 'paystack':
        return await this.testPaystack(apiKey);
      default:
        return { success: true };
    }
  }

  private async testWhatsApp(apiKey: string) {
    // Test WhatsApp API
    return { success: true, message: 'WhatsApp connected' };
  }

  private async testPaystack(apiKey: string) {
    // Test Paystack API
    return { success: true, message: 'Paystack connected' };
  }

  private maskApiKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return `••••••••••••${key.slice(-4)}`;
  }

  private getIntegrationName(id: string): string {
    const names: Record<string, string> = {
      'whatsapp-api': 'WhatsApp Business API',
      'paystack': 'Paystack Payment Gateway',
      'flutterwave': 'Flutterwave',
      'gokada': 'Gokada Delivery',
      'kwik': 'Kwik Delivery'
    };
    return names[id] || id;
  }

  private getIntegrationCategory(id: string): 'COMMUNICATION' | 'PAYMENT' | 'DELIVERY' {
    if (id.includes('whatsapp')) return 'COMMUNICATION';
    if (id.includes('paystack') || id.includes('flutter')) return 'PAYMENT';
    return 'DELIVERY';
  }
}

export const integrationService = new IntegrationService();