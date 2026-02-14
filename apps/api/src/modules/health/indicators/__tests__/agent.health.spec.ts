import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { AgentHealthService } from '../agent.health';
import { AgentRegistryRepository } from '../../../../database/adapters/nestjs-agent-registry.repository';

describe('AgentHealthService', () => {
  let service: AgentHealthService;
  let mockAgentRegistry: Partial<AgentRegistryRepository>;
  let mockLogger: Partial<PinoLogger>;

  beforeEach(async () => {
    mockAgentRegistry = {
      findAll: jest.fn().mockResolvedValue([]),
    };

    mockLogger = {
      setContext: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentHealthService,
        { provide: AgentRegistryRepository, useValue: mockAgentRegistry },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AgentHealthService>(AgentHealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return down status when no agents registered', async () => {
    mockAgentRegistry.findAll = jest.fn().mockResolvedValue([]);

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.online).toBe(0);
    expect(result.total).toBe(0);
    expect(result.message).toBe('No agents registered');
  });

  it('should return up status when at least one agent is online', async () => {
    mockAgentRegistry.findAll = jest.fn().mockResolvedValue([
      { id: '1', status: 'online', vendorId: 'vendor1' },
      { id: '2', status: 'offline', vendorId: 'vendor2' },
    ]);

    const result = await service.check();

    expect(result.status).toBe('up');
    expect(result.online).toBe(1);
    expect(result.total).toBe(2);
    expect(result.message).toBeUndefined();
  });

  it('should return degraded status when all agents are offline', async () => {
    mockAgentRegistry.findAll = jest.fn().mockResolvedValue([
      { id: '1', status: 'offline', vendorId: 'vendor1' },
      { id: '2', status: 'degraded', vendorId: 'vendor2' },
    ]);

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.online).toBe(0);
    expect(result.total).toBe(2);
    expect(result.message).toBe('All agents offline or degraded');
  });

  it('should return down status on repository error', async () => {
    mockAgentRegistry.findAll = jest.fn().mockRejectedValue(new Error('DB error'));

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.online).toBe(0);
    expect(result.total).toBe(0);
    expect(result.message).toBe('DB error');
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should set logger context on initialization', () => {
    expect(mockLogger.setContext).toHaveBeenCalledWith('AgentHealthService');
  });
});
