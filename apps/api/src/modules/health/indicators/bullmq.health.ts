import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

export interface BullMQHealthIndicator {
  status: 'up' | 'down' | 'warning';
  queues: {
    [queueName: string]: number;
  };
  message?: string;
}

@Injectable()
export class BullMQHealthService {
  constructor(
    @InjectQueue('order-sync') private readonly orderSyncQueue: Queue,
    @InjectQueue('reconciliation') private readonly reconciliationQueue: Queue,
    @InjectQueue('image-sync') private readonly imageSyncQueue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BullMQHealthService.name);
  }

  async check(): Promise<BullMQHealthIndicator> {
    try {
      const [orderSyncWaiting, reconciliationWaiting, imageSyncWaiting] = await Promise.all([
        this.orderSyncQueue.getWaitingCount(),
        this.reconciliationQueue.getWaitingCount(),
        this.imageSyncQueue.getWaitingCount(),
      ]);

      const queues = {
        'order-sync': orderSyncWaiting,
        reconciliation: reconciliationWaiting,
        'image-sync': imageSyncWaiting,
      };

      // Warning if any queue has > 100 waiting jobs
      const maxWaiting = Math.max(orderSyncWaiting, reconciliationWaiting, imageSyncWaiting);
      const status = maxWaiting > 100 ? 'warning' : 'up';

      return {
        status,
        queues,
        ...(maxWaiting > 100 && {
          message: `Queue backlog detected: ${maxWaiting} jobs waiting`,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown BullMQ error';
      this.logger.warn({ error: message }, 'BullMQ health check failed');

      return {
        status: 'down',
        queues: {},
        message,
      };
    }
  }
}
