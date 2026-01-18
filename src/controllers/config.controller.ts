import { Request, Response } from 'express';
import prisma from '../config/database';
import { getRedis } from '../config/redis';

const REDIS_CONFIG_KEY = 'platform:config';

export class ConfigController {
  async getConfig(req: Request, res: Response) {
    try {
      // const redis = getRedis();

      // // Try Redis cache first
      // const cached = await redis.get(REDIS_CONFIG_KEY);
      // if (cached) {
      //   console.log('✅ Config loaded from Redis cache');
      //   return res.json({
      //     success: true,
      //     data: JSON.parse(cached),
      //     source: 'cache'
      //   });
      // }

      // Fallback to database
      let config = await prisma.platformConfig.findFirst({
        orderBy: { updatedAt: 'desc' }
      });

      // If no config exists, create default
      if (!config) {
        config = await prisma.platformConfig.create({
          data: {
            businessHoursEnabled: true,
            openTime: '09:00',
            closeTime: '18:00',
            mainlandToIsland: 2500,
            islandToMainland: 2500,
            mainlandToMainland: 1500,
            islandToIsland: 1500,
            defaultDeliveryFee: 2000,
            orderCutoffEnabled: true,
            orderCutoffTime: '20:00',
            autoConfirmOrders: false,
            allowWeekendDelivery: true
          }
        });

        console.log('✅ Default config created');
      }

      // Cache in Redis (7 days TTL)
      // await redis.setex(REDIS_CONFIG_KEY, 7 * 24 * 60 * 60, JSON.stringify(config));

      return res.json({
        success: true,
        data: config,
        source: 'database'
      });

    } catch (error: any) {
      console.error('❌ Error fetching config:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch configuration',
        error: error.message
      });
    }
  }

  async updateConfig(req: Request, res: Response) {
    try {
      const {
        businessHoursEnabled,
        openTime,
        closeTime,
        mainlandToIsland,
        islandToMainland,
        mainlandToMainland,
        islandToIsland,
        defaultDeliveryFee,
        orderCutoffEnabled,
        orderCutoffTime,
        autoConfirmOrders,
        allowWeekendDelivery
      } = req.body;

      
      // 1. Validate business hours
      if (businessHoursEnabled && openTime && closeTime) {
        if (!this.isValidTime(openTime) || !this.isValidTime(closeTime)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid time format. Use HH:MM (e.g., 09:00)'
          });
        }

        if (this.timeToMinutes(openTime) >= this.timeToMinutes(closeTime)) {
          return res.status(400).json({
            success: false,
            message: 'Opening time must be before closing time'
          });
        }
      }

      // 2. Validate order cutoff time
      if (orderCutoffEnabled && orderCutoffTime) {
        if (!this.isValidTime(orderCutoffTime)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid cutoff time format. Use HH:MM'
          });
        }
      }

      // 3. Validate delivery fees (must be positive)
      const fees = {
        mainlandToIsland,
        islandToMainland,
        mainlandToMainland,
        islandToIsland,
        defaultDeliveryFee
      };

      for (const [key, value] of Object.entries(fees)) {
        if (value !== undefined && value < 0) {
          return res.status(400).json({
            success: false,
            message: `${key} cannot be negative`
          });
        }
      }
      
      const updatedConfig = await prisma.platformConfig.upsert({
        where: { id: 'singleton' }, // Use a fixed ID for singleton pattern
        create: {
          id: 'singleton',
          businessHoursEnabled,
          openTime,
          closeTime,
          mainlandToIsland,
          islandToMainland,
          mainlandToMainland,
          islandToIsland,
          defaultDeliveryFee,
          orderCutoffEnabled,
          orderCutoffTime,
          autoConfirmOrders,
          allowWeekendDelivery
        },
        update: {
          businessHoursEnabled,
          openTime,
          closeTime,
          mainlandToIsland,
          islandToMainland,
          mainlandToMainland,
          islandToIsland,
          defaultDeliveryFee,
          orderCutoffEnabled,
          orderCutoffTime,
          autoConfirmOrders,
          allowWeekendDelivery
        }
      });

      
      // const redis = getRedis();
      // await redis.setex(REDIS_CONFIG_KEY, 7 * 24 * 60 * 60, JSON.stringify(updatedConfig));

      console.log('✅ Platform config updated and cached');

      return res.json({
        success: true,
        message: 'Configuration updated successfully',
        data: updatedConfig
      });

    } catch (error: any) {
      console.error('❌ Error updating config:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update configuration',
        error: error.message
      });
    }
  }

  private isValidTime(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  private timeToMinutes(time: string): number {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
