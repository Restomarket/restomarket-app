import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type PgTableWithColumns } from 'drizzle-orm/pg-core';
import type * as schema from '@repo/shared';

/**
 * Base Factory class for generating test data
 * Provides a fluent API for creating database records with sensible defaults
 */
export abstract class BaseFactory<
  TTable extends PgTableWithColumns<any>,
  TInsert extends Record<string, any>,
  TSelect extends Record<string, any>,
> {
  constructor(
    protected readonly db: PostgresJsDatabase<typeof schema>,
    protected readonly table: TTable,
  ) {}

  /**
   * Generate default attributes for the entity
   * Must be implemented by child factories
   */
  protected abstract getDefaults(): Partial<TInsert>;

  /**
   * Build entity attributes without persisting to database
   * Useful for testing validation or preparing data
   */
  build(overrides: Partial<TInsert> = {}): TInsert {
    return {
      ...this.getDefaults(),
      ...overrides,
    } as TInsert;
  }

  /**
   * Create a single record in the database
   * Returns the created entity with all database-generated fields
   */
  async create(overrides: Partial<TInsert> = {}): Promise<TSelect> {
    const attributes = this.build(overrides);

    const [result] = await this.db.insert(this.table).values(attributes).returning();

    if (!result) {
      throw new Error(`Failed to create entity in factory`);
    }

    return result as TSelect;
  }

  /**
   * Create multiple records in the database
   * More efficient than calling create() multiple times
   *
   * @param count - Number of records to create
   * @param overrides - Attributes to override for ALL records
   */
  async createMany(count: number, overrides: Partial<TInsert> = {}): Promise<TSelect[]> {
    if (count <= 0) {
      return [];
    }

    const records = Array.from({ length: count }, () => this.build(overrides));

    const results = await this.db.insert(this.table).values(records).returning();

    return results as TSelect[];
  }

  /**
   * Create multiple records with individual overrides
   * Allows custom data for each record
   *
   * @param overridesArray - Array of overrides, one per record
   */
  async createBatch(overridesArray: Partial<TInsert>[]): Promise<TSelect[]> {
    if (overridesArray.length === 0) {
      return [];
    }

    const records = overridesArray.map(overrides => this.build(overrides));

    const results = await this.db.insert(this.table).values(records).returning();

    return results as TSelect[];
  }
}
