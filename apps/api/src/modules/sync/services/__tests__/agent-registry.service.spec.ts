import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { AgentRegistryService } from '../agent-registry.service';
import { AgentRegistryRepository } from '../../../../database/adapters';
import { RegisterAgentDto } from '../../dto/agent-register.dto';
import type { Agent } from '@repo/shared';

describe('AgentRegistryService', () => {
  let service: AgentRegistryService;
  let repository: jest.Mocked<AgentRegistryRepository>;
  let logger: jest.Mocked<PinoLogger>;

  const mockAgent: Agent = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    vendorId: 'vendor-123',
    agentUrl: 'https://agent.vendor123.com',
    erpType: 'ebp',
    status: 'online',
    authTokenHash: '$2b$10$hashedtoken',
    version: '1.0.0',
    lastHeartbeat: new Date('2026-02-12T10:00:00.000Z'),
    createdAt: new Date('2026-02-12T10:00:00.000Z'),
    updatedAt: new Date('2026-02-12T10:00:00.000Z'),
  };

  beforeEach(async () => {
    const mockRepository = {
      upsert: jest.fn(),
      findByVendorId: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      updateHeartbeat: jest.fn(),
      updateStatus: jest.fn(),
      deleteByVendorId: jest.fn(),
      countByStatus: jest.fn(),
      findStale: jest.fn(),
    };

    const mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRegistryService,
        {
          provide: AgentRegistryRepository,
          useValue: mockRepository,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AgentRegistryService>(AgentRegistryService);
    repository = module.get(AgentRegistryRepository);
    logger = module.get(PinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new agent successfully', async () => {
      const dto: RegisterAgentDto = {
        vendorId: 'vendor-123',
        agentUrl: 'https://agent.vendor123.com',
        erpType: 'ebp',
        authToken: 'super-secret-token-1234567890',
        version: '1.0.0',
      };

      repository.upsert.mockResolvedValue(mockAgent);

      const result = await service.register(dto);

      expect(result).toBeDefined();
      expect(result?.vendorId).toBe('vendor-123');
      expect(result).not.toHaveProperty('authTokenHash');
      expect(repository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId: dto.vendorId,
          agentUrl: dto.agentUrl,
          erpType: dto.erpType,
          status: 'online',
        }),
      );
      expect(logger.info).toHaveBeenCalledWith('Registering agent', {
        vendorId: dto.vendorId,
        erpType: dto.erpType,
      });
    });

    it('should hash the auth token with bcrypt', async () => {
      const dto: RegisterAgentDto = {
        vendorId: 'vendor-123',
        agentUrl: 'https://agent.vendor123.com',
        erpType: 'ebp',
        authToken: 'plaintext-token',
      };

      repository.upsert.mockResolvedValue(mockAgent);

      await service.register(dto);

      // Verify that the repository was called with a hashed token
      // (bcrypt hashes start with $2b$ and are 60 chars long)
      const upsertCall = repository.upsert.mock.calls[0][0];
      expect(upsertCall.authTokenHash).toBeDefined();
      expect(upsertCall.authTokenHash).toMatch(/^\$2b\$/);
      expect(upsertCall.authTokenHash.length).toBeGreaterThan(50);
      // The hash should NOT be the plaintext token
      expect(upsertCall.authTokenHash).not.toBe('plaintext-token');
    });

    it('should return null if upsert fails', async () => {
      const dto: RegisterAgentDto = {
        vendorId: 'vendor-123',
        agentUrl: 'https://agent.vendor123.com',
        erpType: 'ebp',
        authToken: 'super-secret-token-1234567890',
      };

      repository.upsert.mockResolvedValue(null);

      const result = await service.register(dto);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to register agent', {
        vendorId: dto.vendorId,
      });
    });

    it('should handle registration errors gracefully', async () => {
      const dto: RegisterAgentDto = {
        vendorId: 'vendor-123',
        agentUrl: 'https://agent.vendor123.com',
        erpType: 'ebp',
        authToken: 'super-secret-token-1234567890',
      };

      repository.upsert.mockRejectedValue(new Error('Database error'));

      const result = await service.register(dto);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error during agent registration',
        expect.objectContaining({
          vendorId: dto.vendorId,
          error: 'Database error',
        }),
      );
    });
  });

  describe('heartbeat', () => {
    it('should update agent heartbeat successfully', async () => {
      repository.updateHeartbeat.mockResolvedValue(mockAgent);

      const result = await service.heartbeat('vendor-123', '1.0.0');

      expect(result).toEqual(mockAgent);
      expect(repository.updateHeartbeat).toHaveBeenCalledWith('vendor-123', '1.0.0');
      expect(logger.debug).toHaveBeenCalledWith('Agent heartbeat received', {
        vendorId: 'vendor-123',
        version: '1.0.0',
      });
    });

    it('should return null if agent not found', async () => {
      repository.updateHeartbeat.mockResolvedValue(null);

      const result = await service.heartbeat('vendor-999');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Heartbeat failed - agent not found', {
        vendorId: 'vendor-999',
      });
    });

    it('should work without version parameter', async () => {
      repository.updateHeartbeat.mockResolvedValue(mockAgent);

      const result = await service.heartbeat('vendor-123');

      expect(result).toEqual(mockAgent);
      expect(repository.updateHeartbeat).toHaveBeenCalledWith('vendor-123', undefined);
    });
  });

  describe('deregister', () => {
    it('should deregister agent successfully', async () => {
      repository.updateStatus.mockResolvedValue(mockAgent);

      const result = await service.deregister('vendor-123');

      expect(result).toBe(true);
      expect(repository.updateStatus).toHaveBeenCalledWith('vendor-123', 'offline');
      expect(logger.info).toHaveBeenCalledWith('Deregistering agent', { vendorId: 'vendor-123' });
    });

    it('should return false if agent not found', async () => {
      repository.updateStatus.mockResolvedValue(null);

      const result = await service.deregister('vendor-999');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('Deregistration failed - agent not found', {
        vendorId: 'vendor-999',
      });
    });
  });

  describe('getAgent', () => {
    it('should return agent without sensitive hash', async () => {
      repository.findByVendorId.mockResolvedValue(mockAgent);

      const result = await service.getAgent('vendor-123');

      expect(result).toBeDefined();
      expect(result?.vendorId).toBe('vendor-123');
      expect(result).not.toHaveProperty('authTokenHash');
      expect(repository.findByVendorId).toHaveBeenCalledWith('vendor-123');
    });

    it('should return null if agent not found', async () => {
      repository.findByVendorId.mockResolvedValue(null);

      const result = await service.getAgent('vendor-999');

      expect(result).toBeNull();
    });
  });

  describe('getAllAgents', () => {
    it('should return all agents without sensitive hashes', async () => {
      const mockAgents = [mockAgent, { ...mockAgent, vendorId: 'vendor-456' }];
      repository.findAll.mockResolvedValue(mockAgents);

      const result = await service.getAllAgents();

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('authTokenHash');
      expect(result[1]).not.toHaveProperty('authTokenHash');
      expect(repository.findAll).toHaveBeenCalled();
    });

    it('should return empty array if no agents', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.getAllAgents();

      expect(result).toEqual([]);
    });
  });

  describe('checkHealth', () => {
    it('should detect and update degraded agents', async () => {
      const degradedAgent = { ...mockAgent, status: 'online' as const };
      repository.findStale.mockResolvedValue({ degraded: [degradedAgent], offline: [] });
      repository.updateStatus.mockResolvedValue({ ...degradedAgent, status: 'degraded' });

      const result = await service.checkHealth();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        vendorId: 'vendor-123',
        oldStatus: 'online',
        newStatus: 'degraded',
      });
      expect(repository.updateStatus).toHaveBeenCalledWith('vendor-123', 'degraded');
      expect(logger.warn).toHaveBeenCalledWith(
        'Agent degraded due to stale heartbeat',
        expect.objectContaining({ vendorId: 'vendor-123' }),
      );
    });

    it('should detect and update offline agents', async () => {
      const offlineAgent = { ...mockAgent, status: 'degraded' as const };
      repository.findStale.mockResolvedValue({ degraded: [], offline: [offlineAgent] });
      repository.updateStatus.mockResolvedValue({ ...offlineAgent, status: 'offline' });

      const result = await service.checkHealth();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        vendorId: 'vendor-123',
        oldStatus: 'degraded',
        newStatus: 'offline',
      });
      expect(repository.updateStatus).toHaveBeenCalledWith('vendor-123', 'offline');
      expect(logger.error).toHaveBeenCalledWith(
        'Agent offline due to stale heartbeat',
        expect.objectContaining({ vendorId: 'vendor-123' }),
      );
    });

    it('should return empty array if all agents healthy', async () => {
      repository.findStale.mockResolvedValue({ degraded: [], offline: [] });

      const result = await service.checkHealth();

      expect(result).toEqual([]);
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle multiple status changes', async () => {
      const degradedAgent1 = { ...mockAgent, vendorId: 'vendor-1', status: 'online' as const };
      const degradedAgent2 = { ...mockAgent, vendorId: 'vendor-2', status: 'online' as const };
      const offlineAgent = { ...mockAgent, vendorId: 'vendor-3', status: 'degraded' as const };

      repository.findStale.mockResolvedValue({
        degraded: [degradedAgent1, degradedAgent2],
        offline: [offlineAgent],
      });
      repository.updateStatus.mockResolvedValue({ ...mockAgent, status: 'degraded' });

      const result = await service.checkHealth();

      expect(result).toHaveLength(3);
      expect(repository.updateStatus).toHaveBeenCalledTimes(3);
    });
  });

  describe('getAgentStats', () => {
    it('should return agent statistics', async () => {
      const mockStats = {
        online: 5,
        degraded: 2,
        offline: 3,
        total: 10,
      };
      repository.countByStatus.mockResolvedValue(mockStats);

      const result = await service.getAgentStats();

      expect(result).toEqual(mockStats);
      expect(repository.countByStatus).toHaveBeenCalled();
    });
  });
});
