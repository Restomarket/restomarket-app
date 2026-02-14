import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthService } from './indicators/database.health';
import { RedisHealthService } from './indicators/redis.health';
import { BullMQHealthService } from './indicators/bullmq.health';
import { AgentHealthService } from './indicators/agent.health';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: 'order-sync' }),
    BullModule.registerQueue({ name: 'reconciliation' }),
    BullModule.registerQueue({ name: 'image-sync' }),
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    DatabaseHealthService,
    RedisHealthService,
    BullMQHealthService,
    AgentHealthService,
  ],
})
export class HealthModule {}
