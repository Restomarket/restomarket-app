import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
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
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { AgentCommunicationService } from './services/agent-communication.service';
import { SyncIngestService } from './services/sync-ingest.service';
import { SyncJobService } from './services/sync-job.service';
import { DeadLetterQueueService } from './services/dead-letter-queue.service';
import { ReconciliationService } from './services/reconciliation.service';

// Processors
import { OrderSyncProcessor } from './processors/order-sync.processor';

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
    HttpModule.register({
      timeout: 30_000, // 30s default timeout for agent communication
      maxRedirects: 0, // No redirects for agent calls
    }),
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
    CircuitBreakerService,
    AgentCommunicationService,
    SyncIngestService,
    SyncJobService,
    DeadLetterQueueService,
    ReconciliationService,
    // Processors
    OrderSyncProcessor,
    // Additional services will be added in Tasks 14-15
    // Schedulers will be added in Task 14
  ],
  exports: [
    // Key services exported for use by other modules
    AgentRegistryService,
    ErpMappingService,
    CircuitBreakerService,
    AgentCommunicationService,
    SyncIngestService,
    SyncJobService,
    DeadLetterQueueService,
    ReconciliationService,
  ],
})
export class SyncModule {}
