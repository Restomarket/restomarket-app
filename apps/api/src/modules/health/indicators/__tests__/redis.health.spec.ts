import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { RedisHealthService } from '../redis.health';

// Mock ioredis with default export
const mockPing = jest.fn().mockResolvedValue('PONG');
const mockQuit = jest.fn().mockResolvedValue('OK');
const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return class MockRedis {
    ping = mockPing;
    quit = mockQuit;
    on = mockOn;
  };
});

describe('RedisHealthService', () => {
  let service: RedisHealthService;
  let mockConfigService: Partial<ConfigService>;
  let mockLogger: Partial<PinoLogger>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    mockLogger = {
      setContext: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<RedisHealthService>(RedisHealthService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set logger context on initialization', () => {
    expect(mockLogger.setContext).toHaveBeenCalledWith('RedisHealthService');
  });

  it('should return up status when redis ping succeeds', async () => {
    const result = await service.check();

    expect(result.status).toBe('up');
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
    expect(result.message).toBeUndefined();
    expect(mockPing).toHaveBeenCalled();
  });
});
