/**
 * Reconciliation Service Interfaces
 *
 * Defines types for drift detection and reconciliation operations
 */

/**
 * Checksum response from agent
 */
export interface AgentChecksumResponse {
  checksum: string;
  itemCount: number;
  rangeStart?: string;
  rangeEnd?: string;
}

/**
 * SKU range for binary search
 */
export interface SkuRange {
  start: string;
  end: string;
}

/**
 * Drift detection result
 */
export interface DriftDetectionResult {
  vendorId: string;
  hasDrift: boolean;
  erpChecksum: string;
  dbChecksum: string;
  itemCount: number;
  driftedItems?: string[];
  detectedAt: Date;
  durationMs: number;
}

/**
 * Reconciliation conflict
 */
export interface ReconciliationConflict {
  sku: string;
  erpData: Record<string, unknown>;
  dbData: Record<string, unknown>;
  resolution: 'erp_wins' | 'db_wins' | 'manual';
}

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  vendorId: string;
  totalItems: number;
  conflictsFound: number;
  conflictsResolved: number;
  durationMs: number;
  startedAt: Date;
  completedAt: Date;
}
