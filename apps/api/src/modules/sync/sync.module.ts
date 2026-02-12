import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@database/database.module';

// Controllers
import { AgentIngestController } from './controllers/agent-ingest.controller';
import { AgentRegistryController } from './controllers/agent-registry.controller';
import { AgentCallbackController } from './controllers/agent-callback.controller';
import { SyncAdminController } from './controllers/sync-admin.controller';
import { ErpMappingController } from './controllers/erp-mapping.controller';

// Guards
import { AgentAuthGuard } from '@common/guards/agent-auth.guard';
import { ApiKeyGuard } from '@common/guards/api-key.guard';

/**
 * SyncModule
 *
 * ERP sync architecture module for RestoMarket.
 *
 * Features:
 * - Agent registry and lifecycle management
 * - Direct ingest pipeline (Agent → NestJS → PostgreSQL)
 * - Outbound sync via BullMQ (Order → ERP)
 * - Circuit breaker per vendor
 * - Dead letter queue for failed jobs
 * - Reconciliation engine for drift detection
 * - ERP code mapping with in-memory cache
 * - Scheduled tasks (drift detection, cleanup, health checks)
 * - Admin API for monitoring and management
 *
 * BullMQ queues:
 * - order-sync: Order synchronization to ERP agents
 * - reconciliation: Drift detection and resolution
 * - image-sync: Product image synchronization (future)
 */
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue(
      { name: 'order-sync' },
      { name: 'reconciliation' },
      { name: 'image-sync' },
    ),
  ],
  controllers: [
    AgentIngestController,
    AgentRegistryController,
    AgentCallbackController,
    SyncAdminController,
    ErpMappingController,
  ],
  providers: [
    // Guards
    AgentAuthGuard,
    ApiKeyGuard,
    // Services will be added in Tasks 5-15
    // Processors will be added in Task 11
    // Schedulers will be added in Task 14
  ],
  exports: [
    // Key services will be exported as they're created
    // AgentRegistryService (Task 5)
    // SyncJobService (Task 10)
    // ErpMappingService (Task 6)
  ],
})
export class SyncModule {}
