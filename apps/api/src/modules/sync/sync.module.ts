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

// Services
import { AgentRegistryService } from './services/agent-registry.service';
import { ErpMappingService } from './services/erp-mapping.service';

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
    // Services
    AgentRegistryService,
    ErpMappingService,
    // Additional services will be added in Tasks 7-15
    // Processors will be added in Task 11
    // Schedulers will be added in Task 14
  ],
  exports: [
    // Key services exported for use by other modules
    AgentRegistryService,
    ErpMappingService,
    // SyncJobService (Task 10)
  ],
})
export class SyncModule {}
