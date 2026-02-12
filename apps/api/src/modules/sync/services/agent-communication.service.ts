import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PinoLogger } from 'nestjs-pino';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import type { Configuration } from '../../../config/config.types';
import { AgentRegistryService } from './agent-registry.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { BusinessException } from '../../../common/exceptions/business.exception';

/**
 * Service for communicating with vendor ERP agents.
 * Wraps all HTTP calls to agents with circuit breaker protection.
 */
@Injectable()
export class AgentCommunicationService {
  constructor(
    private readonly agentRegistryService: AgentRegistryService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AgentCommunicationService.name);
  }

  /**
   * Call a vendor agent's API endpoint.
   *
   * @param vendorId - Unique vendor identifier
   * @param apiType - Type of API call (e.g., 'items', 'orders', 'stock')
   * @param endpoint - API endpoint path (e.g., '/sync/create-order')
   * @param payload - Request payload
   * @param correlationId - Optional correlation ID for tracing
   * @returns Response data from agent
   * @throws BusinessException if agent is offline or not found
   * @throws Error if circuit breaker is open or request fails
   */
  async callAgent<T = unknown>(
    vendorId: string,
    apiType: string,
    endpoint: string,
    payload: unknown,
    correlationId?: string,
  ): Promise<T> {
    // 1. Get agent from registry
    const agent = await this.agentRegistryService.getAgent(vendorId);

    if (!agent) {
      this.logger.error({
        msg: 'Agent not found',
        vendorId,
        endpoint,
        correlationId,
      });
      throw new BusinessException('AGENT_NOT_FOUND', `Agent not found for vendor: ${vendorId}`, {
        vendorId,
      });
    }

    // 2. Validate agent is online or degraded (not offline)
    if (agent.status === 'offline') {
      this.logger.warn({
        msg: 'Agent is offline, rejecting call',
        vendorId,
        agentStatus: agent.status,
        endpoint,
        correlationId,
      });
      throw new BusinessException(
        'AGENT_OFFLINE',
        `Agent for vendor ${vendorId} is offline. Last heartbeat: ${agent.lastHeartbeat?.toISOString() || 'never'}`,
        { vendorId, lastHeartbeat: agent.lastHeartbeat?.toISOString() || 'never' },
      );
    }

    // 3. Build URL
    const url = `${agent.agentUrl}${endpoint}`;
    const agentSecret = this.configService.get('sync.agentSecret', { infer: true });

    if (!agentSecret) {
      this.logger.error({
        msg: 'AGENT_SECRET not configured',
        vendorId,
        correlationId,
      });
      throw new BusinessException(
        'AGENT_SECRET_NOT_CONFIGURED',
        'AGENT_SECRET is not configured in environment',
      );
    }

    // 4. Execute through circuit breaker
    try {
      this.logger.debug({
        msg: 'Calling agent',
        vendorId,
        apiType,
        endpoint,
        url,
        agentStatus: agent.status,
        correlationId,
      });

      const result = await this.circuitBreakerService.execute<T>(vendorId, apiType, async () => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${agentSecret}`,
          'Content-Type': 'application/json',
        };

        // Add correlation ID if provided
        if (correlationId) {
          headers['X-Correlation-ID'] = correlationId;
        }

        const response = await firstValueFrom(
          this.httpService.post<T>(url, payload, {
            headers,
            timeout: 30_000, // 30s timeout (matches circuit breaker config)
          }),
        );

        this.logger.debug({
          msg: 'Agent call succeeded',
          vendorId,
          apiType,
          endpoint,
          statusCode: response.status,
          correlationId,
        });

        return response.data;
      });

      return result;
    } catch (error) {
      // Log failure with context
      const errorContext: Record<string, unknown> = {
        msg: 'Agent call failed',
        vendorId,
        apiType,
        endpoint,
        url,
        correlationId,
      };

      if (error instanceof AxiosError) {
        errorContext.statusCode = error.response?.status;
        errorContext.errorMessage = error.message;
        errorContext.errorCode = error.code;
      } else if (error instanceof Error) {
        errorContext.errorMessage = error.message;
      }

      this.logger.error(errorContext);

      throw error;
    }
  }
}
