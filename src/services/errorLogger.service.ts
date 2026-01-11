import prisma from '../config/database';
import { getIO } from '../config/socket';

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export class ErrorLoggerService {
  async logError(data: {
    service: string;
    action: string;
    severity: ErrorSeverity;
    error: any;
    context?: any;
  }) {
    const { service, action, severity, error, context } = data;

    // Log to database
    const errorLog = await prisma.errorLog.create({
      data: {
        service,
        action,
        severity,
        errorMessage: error.message || String(error),
        errorStack: error.stack || null,
        context: context ? JSON.stringify(context) : null,
      }
    });

    // Log to console
    const emoji = this.getSeverityEmoji(severity);
    console.error(`${emoji} [${severity}] ${service}.${action}:`, error.message);
    if (context) console.error('Context:', context);

    // Emit real-time alert for HIGH/CRITICAL
    if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
      try {
        const io = getIO();
        io.emit('critical-error', {
          id: errorLog.id,
          service,
          action,
          severity,
          message: error.message,
          timestamp: errorLog.createdAt,
          context
        });
      } catch (socketError) {
        console.error('Socket emit failed:', socketError);
      }
    }

    // Log to activity log for admin dashboard
    if (severity === ErrorSeverity.CRITICAL) {
      await prisma.activityLog.create({
        data: {
          userId: 'SYSTEM',
          action: `critical_error_${service}`,
          description: `CRITICAL: ${action} failed - ${error.message}`
        }
      });
    }

    return errorLog;
  }

  private getSeverityEmoji(severity: ErrorSeverity): string {
    const emojis = {
      [ErrorSeverity.LOW]: 'ℹ️',
      [ErrorSeverity.MEDIUM]: '⚠️',
      [ErrorSeverity.HIGH]: '🚨',
      [ErrorSeverity.CRITICAL]: '🔥'
    };
    return emojis[severity];
  }

  async getCriticalErrors(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return await prisma.errorLog.findMany({
      where: {
        severity: { in: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL] },
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }
}

export const errorLogger = new ErrorLoggerService();