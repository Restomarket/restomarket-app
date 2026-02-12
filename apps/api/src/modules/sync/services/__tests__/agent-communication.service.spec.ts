import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PinoLogger } from 'nestjs-pino';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { AgentCommunicationService } from '../agent-communication.service';
import { AgentRegistryService } from '../agent-registry.service';
import { CircuitBreakerService } from '../circuit-breaker.service';
import { BusinessException } from '../../../../common/exceptions/business.exception';

describe('AgentCommunicationService', () => {
  let service: AgentCommunicationService;
  let agentRegistryService: jest.Mocked<AgentRegistryService>;
  let circuitBreakerService: jest.Mocked<CircuitBreakerService>;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockLogger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentCommunicationService,
        {
          provide: AgentRegistryService,
          useValue: {
            getAgent: jest.fn(),
          },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AgentCommunicationService>(AgentCommunicationService);
    agentRegistryService = module.get(AgentRegistryService);
    circuitBreakerService = module.get(CircuitBreakerService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('callAgent', () => {
    const mockAgent = {
      id: 'agent-1',
      vendorId: 'vendor-123',
      agentUrl: 'https://agent.example.com',
      erpType: 'ebp' as const,
      status: 'online' as const,
      lastHeartbeat: new Date(),
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPayload = { orderId: '12345', items: [] };
    const mockResponse = { success: true, erpReference: 'ERP-67890' };

    beforeEach(() => {
      configService.get.mockReturnValue('test-agent-secret');
    });

    it('should successfully call agent and return data', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);

      // Mock circuit breaker to execute the function
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => {
        return fn();
      });

      // Mock HTTP response
      const axiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.callAgent(
        'vendor-123',
        'orders',
        '/sync/create-order',
        mockPayload,
        'corr-123',
      );

      expect(result).toEqual(mockResponse);
      expect(agentRegistryService.getAgent).toHaveBeenCalledWith('vendor-123');
      expect(circuitBreakerService.execute).toHaveBeenCalledWith(
        'vendor-123',
        'orders',
        expect.any(Function),
      );
      expect(httpService.post).toHaveBeenCalledWith(
        'https://agent.example.com/sync/create-order',
        mockPayload,
        {
          headers: {
            Authorization: 'Bearer test-agent-secret',
            'Content-Type': 'application/json',
            'X-Correlation-ID': 'corr-123',
          },
          timeout: 30_000,
        },
      );
    });

    it('should include correlation ID in headers when provided', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => fn());

      const axiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(of(axiosResponse));

      await service.callAgent('vendor-123', 'items', '/sync/items', mockPayload, 'test-corr-id');

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Correlation-ID': 'test-corr-id',
          }),
        }),
      );
    });

    it('should not include correlation ID header when not provided', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => fn());

      const axiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(of(axiosResponse));

      await service.callAgent('vendor-123', 'items', '/sync/items', mockPayload);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'X-Correlation-ID': expect.anything(),
          }),
        }),
      );
    });

    it('should throw BusinessException when agent not found', async () => {
      agentRegistryService.getAgent.mockResolvedValue(null);

      await expect(
        service.callAgent('vendor-999', 'orders', '/sync/create-order', mockPayload),
      ).rejects.toThrow(BusinessException);

      await expect(
        service.callAgent('vendor-999', 'orders', '/sync/create-order', mockPayload),
      ).rejects.toThrow('Agent not found for vendor: vendor-999');

      expect(circuitBreakerService.execute).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should throw BusinessException when agent is offline', async () => {
      const offlineAgent = {
        ...mockAgent,
        status: 'offline' as const,
        lastHeartbeat: new Date('2024-01-01'),
      };
      agentRegistryService.getAgent.mockResolvedValue(offlineAgent);

      await expect(
        service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload),
      ).rejects.toThrow(BusinessException);

      await expect(
        service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload),
      ).rejects.toThrow(/Agent for vendor vendor-123 is offline/);

      expect(circuitBreakerService.execute).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should allow calls to degraded agents', async () => {
      const degradedAgent = {
        ...mockAgent,
        status: 'degraded' as const,
      };
      agentRegistryService.getAgent.mockResolvedValue(degradedAgent);
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => fn());

      const axiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.callAgent(
        'vendor-123',
        'orders',
        '/sync/create-order',
        mockPayload,
      );

      expect(result).toEqual(mockResponse);
      expect(circuitBreakerService.execute).toHaveBeenCalled();
    });

    it('should throw BusinessException when AGENT_SECRET is not configured', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);
      configService.get.mockReturnValue(undefined);

      await expect(
        service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload),
      ).rejects.toThrow(BusinessException);

      await expect(
        service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload),
      ).rejects.toThrow('AGENT_SECRET is not configured in environment');

      expect(circuitBreakerService.execute).not.toHaveBeenCalled();
    });

    it('should propagate circuit breaker errors', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);
      const circuitBreakerError = new Error('Circuit breaker is open');
      circuitBreakerService.execute.mockRejectedValue(circuitBreakerError);

      await expect(
        service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload),
      ).rejects.toThrow('Circuit breaker is open');
    });

    it('should propagate HTTP errors and log them', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);

      // Mock circuit breaker to execute the function
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => fn());

      // Mock HTTP error
      const axiosError = new AxiosError('Request failed', 'ECONNREFUSED');
      axiosError.response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: 'Server error' },
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload, 'corr-456'),
      ).rejects.toThrow(AxiosError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Agent call failed',
          vendorId: 'vendor-123',
          apiType: 'orders',
          statusCode: 500,
          correlationId: 'corr-456',
        }),
      );
    });

    it('should log non-Axios errors', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => fn());

      const genericError = new Error('Generic error');
      httpService.post.mockReturnValue(throwError(() => genericError));

      await expect(
        service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload),
      ).rejects.toThrow('Generic error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Agent call failed',
          errorMessage: 'Generic error',
        }),
      );
    });

    it('should use correct timeout in HTTP request', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => fn());

      const axiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(of(axiosResponse));

      await service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 30_000, // 30 seconds
        }),
      );
    });

    it('should build correct URL from agent base URL and endpoint', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => fn());

      const axiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(of(axiosResponse));

      await service.callAgent('vendor-123', 'stock', '/sync/update-stock', mockPayload);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://agent.example.com/sync/update-stock',
        mockPayload,
        expect.any(Object),
      );
    });

    it('should log debug messages on successful call', async () => {
      agentRegistryService.getAgent.mockResolvedValue(mockAgent);
      circuitBreakerService.execute.mockImplementation(async (vendorId, apiType, fn) => fn());

      const axiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValue(of(axiosResponse));

      await service.callAgent('vendor-123', 'orders', '/sync/create-order', mockPayload, 'corr-1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Calling agent',
          vendorId: 'vendor-123',
          apiType: 'orders',
        }),
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Agent call succeeded',
          statusCode: 200,
        }),
      );
    });
  });
});
