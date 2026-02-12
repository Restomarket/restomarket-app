import { and, count, desc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { erpCodeMappings } from '../../schema/index.js';
import type { ErpCodeMapping, NewErpCodeMapping } from '../../../types/database.types.js';

/**
 * ERP Code Mappings Repository Base
 *
 * Framework-agnostic repository for ERP code translation.
 * Handles mapping resolution, CRUD operations, and bulk seeding.
 */
export class ErpCodeMappingsRepositoryBase extends BaseRepository<typeof erpCodeMappings> {
  /**
   * Find mapping by vendor ID, type, and ERP code
   */
  async findByVendorTypeCode(
    vendorId: string,
    mappingType: string,
    erpCode: string,
  ): Promise<ErpCodeMapping | null> {
    try {
      const [mapping] = await this.db
        .select()
        .from(erpCodeMappings)
        .where(
          and(
            eq(erpCodeMappings.vendorId, vendorId),
            eq(erpCodeMappings.mappingType, mappingType),
            eq(erpCodeMappings.erpCode, erpCode),
            eq(erpCodeMappings.isActive, true),
          ),
        )
        .limit(1);

      return mapping ?? null;
    } catch (error) {
      this.handleError('FIND_BY_VENDOR_TYPE_CODE', error, { vendorId, mappingType, erpCode });
      return null;
    }
  }

  /**
   * Find all mappings by vendor ID and type (optionally include inactive)
   */
  async findByVendorAndType(
    vendorId: string,
    mappingType: string,
    includeInactive = false,
  ): Promise<ErpCodeMapping[]> {
    try {
      const conditions = [
        eq(erpCodeMappings.vendorId, vendorId),
        eq(erpCodeMappings.mappingType, mappingType),
      ];

      if (!includeInactive) {
        conditions.push(eq(erpCodeMappings.isActive, true));
      }

      const mappings = await this.db
        .select()
        .from(erpCodeMappings)
        .where(and(...conditions))
        .orderBy(erpCodeMappings.erpCode);

      return mappings;
    } catch (error) {
      this.handleError('FIND_BY_VENDOR_AND_TYPE', error, { vendorId, mappingType });
      return [];
    }
  }

  /**
   * Upsert mapping (insert or update on conflict)
   */
  async upsert(data: NewErpCodeMapping): Promise<ErpCodeMapping | null> {
    try {
      const [mapping] = await this.db
        .insert(erpCodeMappings)
        .values(data)
        .onConflictDoUpdate({
          target: [erpCodeMappings.vendorId, erpCodeMappings.mappingType, erpCodeMappings.erpCode],
          set: {
            restoCode: data.restoCode,
            restoLabel: data.restoLabel,
            isActive: data.isActive ?? true,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      if (!mapping) {
        this.logger.error('Failed to upsert mapping - no row returned', {
          vendorId: data.vendorId,
          mappingType: data.mappingType,
          erpCode: data.erpCode,
        });
        return null;
      }

      this.logger.info('Mapping upserted successfully', {
        mappingId: mapping.id,
        vendorId: mapping.vendorId,
        mappingType: mapping.mappingType,
        erpCode: mapping.erpCode,
      });
      return mapping;
    } catch (error) {
      this.handleError('UPSERT', error, {
        vendorId: data.vendorId,
        mappingType: data.mappingType,
        erpCode: data.erpCode,
      });
      return null;
    }
  }

  /**
   * Bulk insert mappings (for seeding)
   */
  async bulkInsert(mappings: NewErpCodeMapping[]): Promise<ErpCodeMapping[]> {
    try {
      if (mappings.length === 0) {
        return [];
      }

      const inserted = await this.db
        .insert(erpCodeMappings)
        .values(mappings)
        .onConflictDoUpdate({
          target: [erpCodeMappings.vendorId, erpCodeMappings.mappingType, erpCodeMappings.erpCode],
          set: {
            restoCode: sql`excluded.resto_code`,
            restoLabel: sql`excluded.resto_label`,
            isActive: sql`excluded.is_active`,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      this.logger.info('Mappings bulk inserted', { count: inserted.length });
      return inserted;
    } catch (error) {
      this.handleError('BULK_INSERT', error, { count: mappings.length });
      return [];
    }
  }

  /**
   * Deactivate mapping (soft delete)
   */
  async deactivate(id: string): Promise<ErpCodeMapping | null> {
    try {
      const [mapping] = await this.db
        .update(erpCodeMappings)
        .set({
          isActive: false,
          updatedAt: sql`now()`,
        })
        .where(eq(erpCodeMappings.id, id))
        .returning();

      if (!mapping) {
        this.logger.warn('Mapping not found for deactivation', { id });
        return null;
      }

      this.logger.info('Mapping deactivated', { mappingId: id });
      return mapping;
    } catch (error) {
      this.handleError('DEACTIVATE', error, { id });
      return null;
    }
  }

  /**
   * Find all mappings with pagination and filtering
   */
  async findAll(
    vendorId?: string,
    mappingType?: string,
    includeInactive = false,
    page = 1,
    limit = 50,
  ): Promise<{ data: ErpCodeMapping[]; total: number }> {
    try {
      const conditions: any[] = [];

      if (vendorId) {
        conditions.push(eq(erpCodeMappings.vendorId, vendorId));
      }

      if (mappingType) {
        conditions.push(eq(erpCodeMappings.mappingType, mappingType));
      }

      if (!includeInactive) {
        conditions.push(eq(erpCodeMappings.isActive, true));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(erpCodeMappings)
          .where(whereClause)
          .orderBy(desc(erpCodeMappings.createdAt))
          .limit(limit)
          .offset((page - 1) * limit),

        this.db.select({ value: count() }).from(erpCodeMappings).where(whereClause),
      ]);

      const total = Number(countResult[0]?.value ?? 0);

      return { data, total };
    } catch (error) {
      this.handleError('FIND_ALL', error, { vendorId, mappingType, page, limit });
      return { data: [], total: 0 };
    }
  }

  /**
   * Count mappings by vendor
   */
  async countByVendor(vendorId: string): Promise<number> {
    try {
      const [result] = await this.db
        .select({ value: count() })
        .from(erpCodeMappings)
        .where(and(eq(erpCodeMappings.vendorId, vendorId), eq(erpCodeMappings.isActive, true)));

      return Number(result?.value ?? 0);
    } catch (error) {
      this.handleError('COUNT_BY_VENDOR', error, { vendorId });
      return 0;
    }
  }

  /**
   * Find mapping by ID
   */
  async findById(id: string): Promise<ErpCodeMapping | null> {
    try {
      const [mapping] = await this.db
        .select()
        .from(erpCodeMappings)
        .where(eq(erpCodeMappings.id, id))
        .limit(1);

      return mapping ?? null;
    } catch (error) {
      this.handleError('FIND_BY_ID', error, { id });
      return null;
    }
  }

  /**
   * Update mapping
   */
  async update(id: string, data: Partial<NewErpCodeMapping>): Promise<ErpCodeMapping | null> {
    try {
      const [mapping] = await this.db
        .update(erpCodeMappings)
        .set({
          ...data,
          updatedAt: sql`now()`,
        })
        .where(eq(erpCodeMappings.id, id))
        .returning();

      if (!mapping) {
        this.logger.warn('Mapping not found for update', { id });
        return null;
      }

      this.logger.info('Mapping updated', { mappingId: id });
      return mapping;
    } catch (error) {
      this.handleError('UPDATE', error, { id });
      return null;
    }
  }
}
