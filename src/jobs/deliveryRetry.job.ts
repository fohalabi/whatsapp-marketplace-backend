import cron from 'node-cron';
import { DeliveryOrchestrator } from '../services/delivery/DeliveryOrchestrator.service';

export class DeliveryRetryJob {
  private orchestrator: DeliveryOrchestrator;

  constructor() {
    this.orchestrator = new DeliveryOrchestrator();
  }

  start() {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      await this.orchestrator.retryStuckDeliveries();
    });

    console.log('✅ Delivery retry job started');
  }
}