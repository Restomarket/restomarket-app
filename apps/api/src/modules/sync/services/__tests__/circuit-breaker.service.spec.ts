import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { CircuitBreakerService } from '../circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let mockLogger: Partial<PinoLogger>;

  beforeEach(async () => {
    mockLogger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBreaker', () => {
    it('should create a new circuit breaker if not exists', () => {
      const breaker = service.getBreaker('vendor1', 'items');

      expect(breaker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('Creating circuit breaker for vendor1:items');
    });

    it('should return existing circuit breaker if already created', () => {
      const breaker1 = service.getBreaker('vendor1', 'items');
      const breaker2 = service.getBreaker('vendor1', 'items');

      expect(breaker1).toBe(breaker2);
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should create separate breakers for different vendors', () => {
      const breaker1 = service.getBreaker('vendor1', 'items');
      const breaker2 = service.getBreaker('vendor2', 'items');

      expect(breaker1).not.toBe(breaker2);
    });

    it('should create separate breakers for different API types', () => {
      const breaker1 = service.getBreaker('vendor1', 'items');
      const breaker2 = service.getBreaker('vendor1', 'orders');

      expect(breaker1).not.toBe(breaker2);
    });
  });

  describe('execute', () => {
    it('should execute function successfully when circuit is closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await service.execute('vendor1', 'items', mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from executed function', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(service.execute('vendor1', 'items', mockFn)).rejects.toThrow('API Error');
    });

    it('should track successful executions', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      await service.execute('vendor1', 'items', mockFn);

      const status = service.getStatus();
      const breakerStatus = status.find(s => s.key === 'vendor1:items');

      expect(breakerStatus).toBeDefined();
      expect(breakerStatus!.stats.successes).toBeGreaterThan(0);
    });

    it('should track failed executions', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));

      try {
        await service.execute('vendor1', 'items', mockFn);
      } catch {
        // Expected to fail
      }

      const status = service.getStatus();
      const breakerStatus = status.find(s => s.key === 'vendor1:items');

      expect(breakerStatus).toBeDefined();
      expect(breakerStatus!.stats.failures).toBeGreaterThan(0);
    });
  });

  describe('circuit breaker state transitions', () => {
    it('should open circuit after error threshold is exceeded', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));

      // Execute enough times to trigger circuit opening (volumeThreshold: 5, errorThresholdPercentage: 50)
      for (let i = 0; i < 10; i++) {
        try {
          await service.execute('vendor1', 'items', mockFn);
        } catch {
          // Expected to fail
        }
      }

      const state = service.getState('vendor1', 'items');
      expect(state).toBe('open');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker OPEN'),
        expect.objectContaining({
          vendorId: 'vendor1',
          apiType: 'items',
          state: 'open',
        }),
      );
    });

    it('should remain closed when success rate is high', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      // Execute successful calls
      for (let i = 0; i < 10; i++) {
        await service.execute('vendor1', 'items', mockFn);
      }

      const state = service.getState('vendor1', 'items');
      expect(state).toBe('closed');
    });

    it('should log state transitions via event listeners', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));

      // Force circuit to open
      for (let i = 0; i < 10; i++) {
        try {
          await service.execute('vendor1', 'items', mockFn);
        } catch {
          // Expected
        }
      }

      expect(service.getState('vendor1', 'items')).toBe('open');

      // Verify that the OPEN event was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker OPEN'),
        expect.objectContaining({
          vendorId: 'vendor1',
          apiType: 'items',
          state: 'open',
        }),
      );

      // Note: halfOpen and close transitions happen automatically after resetTimeout
      // In production, opossum would handle this, and we'd see the corresponding logs
    });
  });

  describe('reset', () => {
    it('should manually reset circuit breaker to closed state', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));

      // Force circuit to open
      for (let i = 0; i < 10; i++) {
        try {
          await service.execute('vendor1', 'items', mockFn);
        } catch {
          // Expected
        }
      }

      expect(service.getState('vendor1', 'items')).toBe('open');

      // Reset circuit
      service.reset('vendor1', 'items');

      expect(service.getState('vendor1', 'items')).toBe('closed');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker manually reset to CLOSED for vendor1:items',
        { vendorId: 'vendor1', apiType: 'items' },
      );
    });

    it('should log warning when resetting non-existent circuit breaker', () => {
      service.reset('nonexistent', 'items');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot reset circuit breaker - not found for nonexistent:items',
        { vendorId: 'nonexistent', apiType: 'items' },
      );
    });
  });

  describe('getStatus', () => {
    it('should return empty array when no breakers exist', () => {
      const status = service.getStatus();

      expect(status).toEqual([]);
    });

    it('should return status for all circuit breakers', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      await service.execute('vendor1', 'items', mockFn);
      await service.execute('vendor2', 'orders', mockFn);

      const status = service.getStatus();

      expect(status).toHaveLength(2);
      expect(status.map(s => s.key)).toContain('vendor1:items');
      expect(status.map(s => s.key)).toContain('vendor2:orders');
    });

    it('should include state and stats in status', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      await service.execute('vendor1', 'items', mockFn);

      const status = service.getStatus();
      const breakerStatus = status.find(s => s.key === 'vendor1:items');

      expect(breakerStatus).toBeDefined();
      expect(breakerStatus!.state).toBe('closed');
      expect(breakerStatus!.stats).toMatchObject({
        successes: expect.any(Number),
        failures: expect.any(Number),
        fires: expect.any(Number),
      });
    });
  });

  describe('getState', () => {
    it('should return null for non-existent circuit breaker', () => {
      const state = service.getState('nonexistent', 'items');

      expect(state).toBeNull();
    });

    it('should return closed state for healthy circuit', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      await service.execute('vendor1', 'items', mockFn);

      const state = service.getState('vendor1', 'items');

      expect(state).toBe('closed');
    });

    it('should return open state for tripped circuit', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));

      // Force circuit to open
      for (let i = 0; i < 10; i++) {
        try {
          await service.execute('vendor1', 'items', mockFn);
        } catch {
          // Expected
        }
      }

      const state = service.getState('vendor1', 'items');

      expect(state).toBe('open');
    });
  });
});
