import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { DatabaseHealthService } from '../database.health';
import { DATABASE_CONNECTION } from '../../../../database/database.module';

describe('DatabaseHealthService', () => {
  let service: DatabaseHealthService;
  let mockDb: any;
  let mockLogger: Partial<PinoLogger>;

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn().mockResolvedValue([{ result: 1 }]),
    };

    mockLogger = {
      setContext: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseHealthService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<DatabaseHealthService>(DatabaseHealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return up status when database is connected', async () => {
    const result = await service.check();

    expect(result.status).toBe('up');
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
    expect(result.message).toBeUndefined();
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it('should return down status when database query fails', async () => {
    mockDb.execute = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
    expect(result.message).toBe('Connection refused');
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should handle unknown database errors', async () => {
    mockDb.execute = jest.fn().mockRejectedValue('Unknown error');

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.message).toBe('Unknown database error');
  });

  it('should set logger context on initialization', () => {
    expect(mockLogger.setContext).toHaveBeenCalledWith('DatabaseHealthService');
  });
});
