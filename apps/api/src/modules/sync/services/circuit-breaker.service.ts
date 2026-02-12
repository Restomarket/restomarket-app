import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import CircuitBreaker from 'opossum';
import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,
} from '../interfaces/circuit-breaker.interface';

/**
 * Circuit breaker service for protecting outbound calls to ERP agents
 *
 * Provides per-vendor, per-API-type circuit breakers with:
 * - Automatic failure detection and circuit opening
 * - Half-open state for testing recovery
 * - Manual reset capability for administrative intervention
 * - Comprehensive state monitoring and logging
 */
@Injectable()
export class CircuitBreakerService {
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly defaultConfig: CircuitBreakerConfig = {
    timeout: 30_000, // 30s request timeout
    errorThresholdPercentage: 50, // Open after 50% failures
    resetTimeout: 60_000, // Try half-open after 1min
    volumeThreshold: 5, // Min 5 calls before evaluating
  };

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(CircuitBreakerService.name);
  }

  /**
   * Get or create a circuit breaker for a specific vendor and API type
   *
   * @param vendorId - Vendor identifier
   * @param apiType - API type (e.g., 'items', 'orders', 'stock')
   * @returns Circuit breaker instance
   */
  getBreaker(vendorId: string, apiType: string): CircuitBreaker {
    const key = `${vendorId}:${apiType}`;

    if (!this.breakers.has(key)) {
      this.logger.debug(`Creating circuit breaker for ${key}`);
      const breaker = new CircuitBreaker(this.executeAction, this.defaultConfig);

      // Attach event listeners for state transitions
      breaker.on('open', () => {
        this.logger.warn(`Circuit breaker OPEN for ${key}`, { vendorId, apiType, state: 'open' });
      });

      breaker.on('halfOpen', () => {
        this.logger.info(`Circuit breaker HALF-OPEN for ${key}`, {
          vendorId,
          apiType,
          state: 'halfOpen',
        });
      });

      breaker.on('close', () => {
        this.logger.info(`Circuit breaker CLOSED for ${key}`, {
          vendorId,
          apiType,
          state: 'closed',
        });
      });

      breaker.on('fallback', data => {
        this.logger.warn(`Circuit breaker FALLBACK triggered for ${key}`, {
          vendorId,
          apiType,
          error: data,
        });
      });

      breaker.on('timeout', () => {
        this.logger.warn(`Circuit breaker TIMEOUT for ${key}`, { vendorId, apiType });
      });

      this.breakers.set(key, breaker);
    }

    return this.breakers.get(key)!;
  }

  /**
   * Execute a function through the circuit breaker
   *
   * @param vendorId - Vendor identifier
   * @param apiType - API type
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(vendorId: string, apiType: string, fn: () => Promise<T>): Promise<T> {
    const breaker = this.getBreaker(vendorId, apiType);
    return breaker.fire(fn) as Promise<T>;
  }

  /**
   * Force reset a circuit breaker to closed state
   *
   * Used for manual administrative intervention when a circuit is stuck open
   * or needs to be reset after resolving underlying issues.
   *
   * @param vendorId - Vendor identifier
   * @param apiType - API type
   */
  reset(vendorId: string, apiType: string): void {
    const key = `${vendorId}:${apiType}`;
    const breaker = this.breakers.get(key);

    if (breaker) {
      breaker.close();
      this.logger.info(`Circuit breaker manually reset to CLOSED for ${key}`, {
        vendorId,
        apiType,
      });
    } else {
      this.logger.warn(`Cannot reset circuit breaker - not found for ${key}`, {
        vendorId,
        apiType,
      });
    }
  }

  /**
   * Get status of all circuit breakers
   *
   * @returns Array of circuit breaker statuses with keys, states, and statistics
   */
  getStatus(): CircuitBreakerStatus[] {
    const statuses: CircuitBreakerStatus[] = [];

    for (const [key, breaker] of this.breakers.entries()) {
      statuses.push({
        key,
        state: breaker.opened ? 'open' : breaker.halfOpen ? 'halfOpen' : 'closed',
        stats: {
          failures: breaker.stats.failures,
          successes: breaker.stats.successes,
          rejects: breaker.stats.rejects,
          fires: breaker.stats.fires,
          timeouts: breaker.stats.timeouts,
          cacheHits: breaker.stats.cacheHits,
          cacheMisses: breaker.stats.cacheMisses,
          semaphoreRejections: breaker.stats.semaphoreRejections,
          percentiles: breaker.stats.percentiles,
          latencyMean: breaker.stats.latencyMean,
        },
      });
    }

    return statuses;
  }

  /**
   * Get state of a specific circuit breaker
   *
   * @param vendorId - Vendor identifier
   * @param apiType - API type
   * @returns Circuit breaker state or null if not found
   */
  getState(vendorId: string, apiType: string): CircuitBreakerState | null {
    const key = `${vendorId}:${apiType}`;
    const breaker = this.breakers.get(key);

    if (!breaker) {
      return null;
    }

    if (breaker.opened) return 'open';
    if (breaker.halfOpen) return 'halfOpen';
    return 'closed';
  }

  /**
   * Internal action executor - required by opossum
   * This is a no-op wrapper since we pass the actual function to fire()
   */
  private executeAction = async <T>(fn: () => Promise<T>): Promise<T> => {
    return fn();
  };
}
