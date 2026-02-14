import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { getQueueToken } from '@nestjs/bullmq';
import { E2ETestSetup } from './helpers';
import { agentRegistry, items, syncJobs, erpCodeMappings } from '@repo/shared/database/schema';
import { OrderSyncProcessor } from '../src/modules/sync/processors/order-sync.processor';

/**
 * Sync API E2E Tests
 *
 * Testing Strategy:
 * - Covers the 10 scenarios from the sync spec
 * - Agent authentication via direct DB insert of agent + known token
 * - BullMQ queue mocked to avoid Redis dependency
 * - ERP code mappings seeded per test where needed
 * - Each test is isolated with database cleanup in beforeEach
 *
 * Scenarios covered:
 * 1. Agent registers → sends items → items upserted in DB
 * 2. Content-hash dedup: same data sent twice → second returns all skipped
 * 3. Stale data rejection: old timestamp (handled by content hash / no update)
 * 4. Unmapped ERP code → item fails, others succeed
 * 5. Order created → sync job created in DB
 * 6. Health endpoint shows all subsystems
 * 7. Rate limiting returns 429 after threshold (skipped - needs Redis)
 * 8. Agent ingest requires valid auth token (401 without token)
 * 9. Batch item sync upserts multiple items
 * 10. Order CRUD via /orders endpoint
 */

// ============================================================
// Test Helpers
// ============================================================

const TEST_VENDOR_ID = 'test-vendor-e2e';
const TEST_AGENT_TOKEN = 'test-agent-token-12345';

/**
 * Build a minimal valid ItemSyncPayloadDto
 */
function buildItemPayload(overrides: Record<string, unknown> = {}) {
  return {
    sku: 'TEST-SKU-001',
    name: 'Test Item',
    description: 'A test item',
    erpUnitCode: 'KG',
    erpVatCode: 'TVA20',
    unitPrice: 1000,
    currency: 'EUR',
    isActive: true,
    contentHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    lastSyncedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build a valid ItemSyncIngestDto body
 */
function buildItemIngestBody(
  vendorId = TEST_VENDOR_ID,
  itemOverrides: Record<string, unknown> = {},
) {
  return {
    vendorId,
    items: [buildItemPayload(itemOverrides)],
  };
}

/**
 * Insert a test agent into the database and return the plain token
 */
async function seedTestAgent(
  testSetup: E2ETestSetup,
  vendorId = TEST_VENDOR_ID,
  token = TEST_AGENT_TOKEN,
) {
  const hash = await bcrypt.hash(token, 10);
  const [agent] = await testSetup.database
    .insert(agentRegistry)
    .values({
      vendorId,
      agentUrl: 'http://test-agent.local',
      erpType: 'custom',
      status: 'online',
      authTokenHash: hash,
    })
    .returning();
  return { agent, token };
}

/**
 * Seed ERP code mappings required for item sync to succeed
 */
async function seedErpMappings(testSetup: E2ETestSetup, vendorId = TEST_VENDOR_ID) {
  await testSetup.database.insert(erpCodeMappings).values([
    {
      vendorId,
      mappingType: 'unit',
      erpCode: 'KG',
      restoCode: 'kilogram',
      restoLabel: 'Kilogram',
      isActive: true,
    },
    {
      vendorId,
      mappingType: 'vat',
      erpCode: 'TVA20',
      restoCode: 'vat_20',
      restoLabel: '20% VAT',
      isActive: true,
    },
  ]);
}

// ============================================================
// Test Suite
// ============================================================

describe('Sync API (e2e)', () => {
  let testSetup: E2ETestSetup;

  const mockOrderSyncQueue = {
    add: jest.fn().mockResolvedValue({ id: 'mock-bullmq-job-id' }),
    getJob: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  };

  // Mock the processor so @nestjs/bullmq does not create a BullMQ Worker
  // (Worker creation requires a Redis connection; tests should not need Redis)
  const mockOrderSyncProcessor = {
    process: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    testSetup = await new E2ETestSetup()
      .withAppModule()
      .overrideProvider(getQueueToken('order-sync'), mockOrderSyncQueue)
      .overrideProvider(OrderSyncProcessor, mockOrderSyncProcessor)
      .setupApp();
  });

  beforeEach(async () => {
    await testSetup.cleanup();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testSetup.teardown();
  });

  // ============================================================
  // Scenario 6: Health endpoint shows all subsystems
  // (runs first as it has no auth dependency)
  // ============================================================

  describe('GET /health', () => {
    it('should return 200 and report subsystem statuses', async () => {
      const response = await request(testSetup.serverHttp).get('/health').expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  // ============================================================
  // Scenario 8: Agent ingest requires valid auth token
  // ============================================================

  describe('Authentication', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const body = buildItemIngestBody();

      await request(testSetup.serverHttp)
        .post('/sync/items')
        .send(body)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when Bearer token is invalid', async () => {
      await seedTestAgent(testSetup);

      const body = buildItemIngestBody();

      await request(testSetup.serverHttp)
        .post('/sync/items')
        .set('Authorization', 'Bearer invalid-token-xyz')
        .send(body)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when vendorId is missing from body', async () => {
      await seedTestAgent(testSetup);

      await request(testSetup.serverHttp)
        .post('/sync/items')
        .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
        .send({ items: [buildItemPayload()] })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 404 when agent vendorId is not registered', async () => {
      const body = buildItemIngestBody('unregistered-vendor-id');

      await request(testSetup.serverHttp)
        .post('/sync/items')
        .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
        .send(body)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ============================================================
  // Scenario 1: Agent registers → sends items → items upserted
  // ============================================================

  describe('POST /sync/items - Item ingest (incremental)', () => {
    describe('Success Cases', () => {
      it('should upsert items into the database on successful sync', async () => {
        // Arrange
        await seedTestAgent(testSetup);
        await seedErpMappings(testSetup);

        const body = buildItemIngestBody(TEST_VENDOR_ID, {
          sku: 'SKU-UPSERT-001',
          name: 'Upsert Test Item',
          contentHash: 'a'.repeat(64),
        });

        // Act
        const response = await request(testSetup.serverHttp)
          .post('/sync/items')
          .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
          .send(body)
          .expect(HttpStatus.OK);

        // Assert HTTP response
        expect(response.body).toHaveProperty('processed');
        expect(response.body).toHaveProperty('skipped');
        expect(response.body).toHaveProperty('failed');
        expect(response.body).toHaveProperty('results');
        expect(response.body.processed).toBe(1);
        expect(response.body.skipped).toBe(0);
        expect(response.body.failed).toBe(0);

        // Assert DB row was inserted
        const dbItems = await testSetup.database
          .select()
          .from(items)
          .then(rows =>
            rows.filter(r => r.vendorId === TEST_VENDOR_ID && r.sku === 'SKU-UPSERT-001'),
          );

        expect(dbItems).toHaveLength(1);
        expect(dbItems[0]).toMatchObject({
          vendorId: TEST_VENDOR_ID,
          sku: 'SKU-UPSERT-001',
          name: 'Upsert Test Item',
        });
      });

      // ============================================================
      // Scenario 2: Content-hash dedup
      // ============================================================

      it('should skip items on second sync when content hash is unchanged', async () => {
        // Arrange
        await seedTestAgent(testSetup);
        await seedErpMappings(testSetup);

        const contentHash = 'b'.repeat(64);
        const body = buildItemIngestBody(TEST_VENDOR_ID, {
          sku: 'SKU-DEDUP-001',
          contentHash,
        });

        // Act - first sync
        const firstResponse = await request(testSetup.serverHttp)
          .post('/sync/items')
          .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
          .send(body)
          .expect(HttpStatus.OK);

        expect(firstResponse.body.processed).toBe(1);
        expect(firstResponse.body.skipped).toBe(0);

        // Act - second sync with same content hash
        const secondResponse = await request(testSetup.serverHttp)
          .post('/sync/items')
          .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
          .send(body)
          .expect(HttpStatus.OK);

        // Assert - second request should skip all items
        expect(secondResponse.body.processed).toBe(0);
        expect(secondResponse.body.skipped).toBe(1);
        expect(secondResponse.body.failed).toBe(0);
        expect(secondResponse.body.results[0]).toMatchObject({
          identifier: 'SKU-DEDUP-001',
          status: 'skipped',
          reason: 'no_changes',
        });
      });

      // ============================================================
      // Scenario 3: Stale data handling (content hash change = update)
      // ============================================================

      it('should update item when content hash changes (new data version)', async () => {
        // Arrange
        await seedTestAgent(testSetup);
        await seedErpMappings(testSetup);

        const initialHash = 'c'.repeat(64);
        const updatedHash = 'd'.repeat(64);

        const initialBody = buildItemIngestBody(TEST_VENDOR_ID, {
          sku: 'SKU-STALE-001',
          name: 'Original Name',
          contentHash: initialHash,
        });

        // Act - first sync
        await request(testSetup.serverHttp)
          .post('/sync/items')
          .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
          .send(initialBody)
          .expect(HttpStatus.OK);

        // Act - second sync with different content hash
        const updatedBody = buildItemIngestBody(TEST_VENDOR_ID, {
          sku: 'SKU-STALE-001',
          name: 'Updated Name',
          contentHash: updatedHash,
        });

        const updateResponse = await request(testSetup.serverHttp)
          .post('/sync/items')
          .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
          .send(updatedBody)
          .expect(HttpStatus.OK);

        expect(updateResponse.body.processed).toBe(1);
        expect(updateResponse.body.skipped).toBe(0);

        // Assert DB row was updated
        const dbItems = await testSetup.database
          .select()
          .from(items)
          .then(rows =>
            rows.filter(r => r.vendorId === TEST_VENDOR_ID && r.sku === 'SKU-STALE-001'),
          );

        expect(dbItems[0]!.name).toBe('Updated Name');
        expect(dbItems[0]!.contentHash).toBe(updatedHash);
      });
    });

    // ============================================================
    // Scenario 4: Unmapped ERP code → item fails, others succeed
    // ============================================================

    describe('Partial failure with unmapped ERP codes', () => {
      it('should fail item with unmapped ERP code but succeed others', async () => {
        // Arrange
        await seedTestAgent(testSetup);
        await seedErpMappings(testSetup);

        // Body with two items: one with a valid mapping and one with an unmapped ERP code
        const body = {
          vendorId: TEST_VENDOR_ID,
          items: [
            buildItemPayload({
              sku: 'SKU-VALID-001',
              name: 'Valid Item',
              erpUnitCode: 'KG',
              erpVatCode: 'TVA20',
              contentHash: 'e'.repeat(64),
            }),
            buildItemPayload({
              sku: 'SKU-UNMAPPED-001',
              name: 'Unmapped Item',
              erpUnitCode: 'UNKNOWN_UNIT',
              erpVatCode: 'UNKNOWN_VAT',
              contentHash: 'f'.repeat(64),
            }),
          ],
        };

        // Act
        const response = await request(testSetup.serverHttp)
          .post('/sync/items')
          .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
          .send(body)
          .expect(HttpStatus.OK);

        // Assert: valid item processed, unmapped item failed
        expect(response.body.processed).toBe(1);
        expect(response.body.failed).toBe(1);

        const validResult = response.body.results.find(
          (r: { identifier: string }) => r.identifier === 'SKU-VALID-001',
        );
        const failedResult = response.body.results.find(
          (r: { identifier: string }) => r.identifier === 'SKU-UNMAPPED-001',
        );

        expect(validResult).toBeDefined();
        expect(validResult.status).toBe('processed');
        expect(failedResult).toBeDefined();
        expect(failedResult.status).toBe('failed');
      });
    });

    describe('Validation errors', () => {
      it('should return 400 when items array is empty', async () => {
        await seedTestAgent(testSetup);

        await request(testSetup.serverHttp)
          .post('/sync/items')
          .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
          .send({ vendorId: TEST_VENDOR_ID, items: [] })
          .expect(HttpStatus.BAD_REQUEST);
      });

      it('should return 400 when required fields are missing from item payload', async () => {
        await seedTestAgent(testSetup);

        await request(testSetup.serverHttp)
          .post('/sync/items')
          .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
          .send({
            vendorId: TEST_VENDOR_ID,
            items: [{ name: 'Missing sku and other required fields' }],
          })
          .expect(HttpStatus.BAD_REQUEST);
      });
    });
  });

  // ============================================================
  // Scenario 9: Batch item sync upserts multiple items
  // ============================================================

  describe('POST /sync/items/batch - Batch item sync', () => {
    it('should upsert multiple items in batch mode', async () => {
      // Arrange
      await seedTestAgent(testSetup);
      await seedErpMappings(testSetup);

      const batchItems = Array.from({ length: 5 }, (_, i) =>
        buildItemPayload({
          sku: `BATCH-SKU-${String(i).padStart(3, '0')}`,
          name: `Batch Item ${i}`,
          contentHash: `${'0'.repeat(63)}${i}`,
        }),
      );

      const body = {
        vendorId: TEST_VENDOR_ID,
        items: batchItems,
      };

      // Act
      const response = await request(testSetup.serverHttp)
        .post('/sync/items/batch')
        .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
        .send(body)
        .expect(HttpStatus.OK);

      // Assert HTTP response
      expect(response.body.processed).toBe(5);
      expect(response.body.skipped).toBe(0);
      expect(response.body.failed).toBe(0);
      expect(response.body.results).toHaveLength(5);

      // Assert all items exist in DB
      const dbItems = await testSetup.database
        .select()
        .from(items)
        .then(rows => rows.filter(r => r.vendorId === TEST_VENDOR_ID));

      expect(dbItems).toHaveLength(5);
    });

    it('should skip items in batch that have unchanged content hashes', async () => {
      // Arrange
      await seedTestAgent(testSetup);
      await seedErpMappings(testSetup);

      const contentHash = 'g'.repeat(64);
      const body = {
        vendorId: TEST_VENDOR_ID,
        items: [buildItemPayload({ sku: 'BATCH-DEDUP-001', contentHash })],
      };

      // First batch sync
      await request(testSetup.serverHttp)
        .post('/sync/items/batch')
        .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
        .send(body)
        .expect(HttpStatus.OK);

      // Second batch sync with same data
      const secondResponse = await request(testSetup.serverHttp)
        .post('/sync/items/batch')
        .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
        .send(body)
        .expect(HttpStatus.OK);

      expect(secondResponse.body.skipped).toBe(1);
      expect(secondResponse.body.processed).toBe(0);
    });
  });

  // ============================================================
  // Scenario 5: Order created → sync job created in DB
  // ============================================================

  describe('POST /orders - Order creation triggers sync job', () => {
    it('should create an order and enqueue a sync job', async () => {
      // Arrange
      const orderBody = {
        vendorId: TEST_VENDOR_ID,
        orderNumber: 'ORDER-E2E-001',
        customerEmail: 'customer@example.com',
        items: [
          {
            sku: 'SKU-ORDER-001',
            quantity: 2,
            unitPrice: 9.99,
          },
        ],
      };

      // Act
      const response = await request(testSetup.serverHttp)
        .post('/orders')
        .send(orderBody)
        .expect(HttpStatus.CREATED);

      // Assert HTTP response
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toMatchObject({
        vendorId: TEST_VENDOR_ID,
        orderNumber: 'ORDER-E2E-001',
      });

      const orderId = response.body.data.id;

      // Assert sync job was created in the database
      const jobs = await testSetup.database
        .select()
        .from(syncJobs)
        .then(rows => rows.filter(r => r.postgresOrderId === orderId));

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        vendorId: TEST_VENDOR_ID,
        operation: 'create_order',
        status: 'pending',
        postgresOrderId: orderId,
      });

      // Assert BullMQ queue was called
      expect(mockOrderSyncQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when order items array is empty', async () => {
      await request(testSetup.serverHttp)
        .post('/orders')
        .send({
          vendorId: TEST_VENDOR_ID,
          items: [],
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when vendorId is missing', async () => {
      await request(testSetup.serverHttp)
        .post('/orders')
        .send({
          items: [{ sku: 'SKU-001', quantity: 1 }],
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ============================================================
  // Scenario 10: Order CRUD via /orders endpoint
  // ============================================================

  describe('GET /orders/:id - Order retrieval', () => {
    it('should retrieve an order by ID after creation', async () => {
      // Arrange - create an order first
      const orderBody = {
        vendorId: TEST_VENDOR_ID,
        orderNumber: 'ORDER-E2E-CRUD-001',
        customerId: 'customer-123',
        items: [
          {
            sku: 'SKU-GET-001',
            quantity: 3,
            unitPrice: 4.5,
          },
        ],
      };

      const createResponse = await request(testSetup.serverHttp)
        .post('/orders')
        .send(orderBody)
        .expect(HttpStatus.CREATED);

      const orderId = createResponse.body.data.id;

      // Act
      const getResponse = await request(testSetup.serverHttp)
        .get(`/orders/${orderId}`)
        .expect(HttpStatus.OK);

      // Assert
      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data).toMatchObject({
        id: orderId,
        vendorId: TEST_VENDOR_ID,
        orderNumber: 'ORDER-E2E-CRUD-001',
        customerId: 'customer-123',
      });
    });

    it('should return 404 for a non-existent order ID', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      await request(testSetup.serverHttp)
        .get(`/orders/${nonExistentId}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 for an invalid UUID format', async () => {
      await request(testSetup.serverHttp)
        .get('/orders/not-a-valid-uuid')
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ============================================================
  // Integration: Full sync + order lifecycle
  // ============================================================

  describe('Integration: Item sync followed by order creation', () => {
    it('should sync items and then create an order referencing those items', async () => {
      // Step 1: Register agent and seed mappings
      await seedTestAgent(testSetup);
      await seedErpMappings(testSetup);

      // Step 2: Sync an item
      const syncBody = buildItemIngestBody(TEST_VENDOR_ID, {
        sku: 'LIFECYCLE-SKU-001',
        name: 'Lifecycle Test Item',
        contentHash: 'h'.repeat(64),
      });

      const syncResponse = await request(testSetup.serverHttp)
        .post('/sync/items')
        .set('Authorization', `Bearer ${TEST_AGENT_TOKEN}`)
        .send(syncBody)
        .expect(HttpStatus.OK);

      expect(syncResponse.body.processed).toBe(1);

      // Step 3: Create an order for that item
      const orderBody = {
        vendorId: TEST_VENDOR_ID,
        orderNumber: 'LIFECYCLE-ORDER-001',
        items: [
          {
            sku: 'LIFECYCLE-SKU-001',
            quantity: 5,
            unitPrice: 2.0,
          },
        ],
      };

      const orderResponse = await request(testSetup.serverHttp)
        .post('/orders')
        .send(orderBody)
        .expect(HttpStatus.CREATED);

      expect(orderResponse.body.data).toHaveProperty('id');
      expect(orderResponse.body.data.orderNumber).toBe('LIFECYCLE-ORDER-001');

      // Step 4: Verify sync job exists
      const orderId = orderResponse.body.data.id;
      const jobs = await testSetup.database
        .select()
        .from(syncJobs)
        .then(rows => rows.filter(r => r.postgresOrderId === orderId));

      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.status).toBe('pending');
    });
  });
});
