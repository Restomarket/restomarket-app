/**
 * Circuit breaker interface definitions for ERP agent communication protection
 */

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'open' | 'halfOpen' | 'closed';

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  failures: number;
  successes: number;
  rejects: number;
  fires: number;
  timeouts: number;
  cacheHits: number;
  cacheMisses: number;
  semaphoreRejections: number;
  percentiles: Record<string, number>;
  latencyMean: number;
}

/**
 * Circuit breaker status for monitoring
 */
export interface CircuitBreakerStatus {
  key: string;
  state: CircuitBreakerState;
  stats: CircuitBreakerStats;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  volumeThreshold: number;
}
