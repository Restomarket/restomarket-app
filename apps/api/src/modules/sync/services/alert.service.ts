import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export type AlertType =
  | 'agent_offline'
  | 'dlq_entries_found'
  | 'circuit_breaker_open'
  | 'reconciliation_drift';

export interface AlertContext {
  vendorId?: string;
  count?: number;
  threshold?: number;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable()
export class AlertService {
  private readonly slackWebhookUrl: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly httpService: HttpService,
  ) {
    this.logger.setContext(AlertService.name);
    this.slackWebhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
  }

  /**
   * Send an alert via logging and optionally Slack
   */
  async sendAlert(type: AlertType, message: string, context?: AlertContext): Promise<void> {
    const alertData = {
      type,
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    // Always log the alert
    this.logger.warn(alertData, `Alert: ${type}`);

    // Send to Slack if webhook URL is configured
    if (this.slackWebhookUrl) {
      try {
        await this.sendSlackNotification(type, message, context);
      } catch (error) {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Failed to send Slack notification',
        );
      }
    }
  }

  /**
   * Send notification to Slack webhook
   */
  private async sendSlackNotification(
    type: AlertType,
    message: string,
    context?: AlertContext,
  ): Promise<void> {
    if (!this.slackWebhookUrl) {
      return;
    }

    const emoji = this.getAlertEmoji(type);
    const color = this.getAlertColor(type);

    const slackPayload = {
      attachments: [
        {
          color,
          title: `${emoji} RestoMarket Alert: ${this.formatAlertType(type)}`,
          text: message,
          fields: context ? this.formatContextFields(context) : [],
          footer: 'RestoMarket Sync System',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    await firstValueFrom(
      this.httpService.post(this.slackWebhookUrl, slackPayload, {
        timeout: 5000,
      }),
    );

    this.logger.debug({ type }, 'Slack notification sent successfully');
  }

  /**
   * Get emoji for alert type
   */
  private getAlertEmoji(type: AlertType): string {
    const emojiMap: Record<AlertType, string> = {
      agent_offline: '🔴',
      dlq_entries_found: '⚠️',
      circuit_breaker_open: '⚡',
      reconciliation_drift: '🔄',
    };
    return emojiMap[type] || '⚠️';
  }

  /**
   * Get color for alert type (Slack attachment color)
   */
  private getAlertColor(type: AlertType): string {
    const colorMap: Record<AlertType, string> = {
      agent_offline: 'danger', // red
      dlq_entries_found: 'warning', // yellow
      circuit_breaker_open: 'danger', // red
      reconciliation_drift: 'warning', // yellow
    };
    return colorMap[type] || 'warning';
  }

  /**
   * Format alert type for display
   */
  private formatAlertType(type: AlertType): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format context object into Slack fields
   */
  private formatContextFields(
    context: AlertContext,
  ): Array<{ title: string; value: string; short: boolean }> {
    const fields: Array<{ title: string; value: string; short: boolean }> = [];

    if (context.vendorId) {
      fields.push({
        title: 'Vendor ID',
        value: context.vendorId,
        short: true,
      });
    }

    if (context.count !== undefined) {
      fields.push({
        title: 'Count',
        value: String(context.count),
        short: true,
      });
    }

    if (context.threshold !== undefined) {
      fields.push({
        title: 'Threshold',
        value: String(context.threshold),
        short: true,
      });
    }

    // Add other context fields
    Object.entries(context)
      .filter(([key]) => !['vendorId', 'count', 'threshold', 'details'].includes(key))
      .forEach(([key, value]) => {
        fields.push({
          title: key,
          value: String(value),
          short: true,
        });
      });

    return fields;
  }
}
