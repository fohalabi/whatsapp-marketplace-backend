import { Request, Response } from 'express';
import { integrationService } from '../services/integration.service';
import { errorLogger, ErrorSeverity } from '../services/errorLogger.service';

export class IntegrationController {
  
  // GET /api/integrations
  async getAll(req: Request, res: Response) {
    try {
      const integrations = await integrationService.getAllIntegrations();
      res.json({ success: true, data: integrations });
    } catch (error: any) {
      await errorLogger.logError({
        service: 'IntegrationController',
        action: 'getAll',
        severity: ErrorSeverity.MEDIUM,
        error
      });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/integrations/:id/connect
  async connect(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { apiKey, apiSecret, webhookUrl } = req.body;

      if (!apiKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'API Key is required' 
        });
      }

      const integration = await integrationService.connectIntegration(
        id,
        apiKey,
        apiSecret,
        webhookUrl
      );

      res.json({ 
        success: true, 
        message: 'Integration connected successfully',
        data: integration 
      });
    } catch (error: any) {
      await errorLogger.logError({
        service: 'IntegrationController',
        action: 'connect',
        severity: ErrorSeverity.HIGH,
        error,
        context: { integrationId: req.params.id }
      });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/integrations/:id/disconnect
  async disconnect(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await integrationService.disconnectIntegration(id);

      res.json({ 
        success: true, 
        message: 'Integration disconnected successfully' 
      });
    } catch (error: any) {
      await errorLogger.logError({
        service: 'IntegrationController',
        action: 'disconnect',
        severity: ErrorSeverity.MEDIUM,
        error,
        context: { integrationId: req.params.id }
      });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/integrations/:id/test
  async test(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await integrationService.testConnection(id);

      res.json({ 
        success: true, 
        message: 'Connection test successful',
        data: result 
      });
    } catch (error: any) {
      await errorLogger.logError({
        service: 'IntegrationController',
        action: 'test',
        severity: ErrorSeverity.LOW,
        error,
        context: { integrationId: req.params.id }
      });
      res.status(500).json({ 
        success: false, 
        error: 'Connection test failed: ' + error.message 
      });
    }
  }
}

export const integrationController = new IntegrationController();