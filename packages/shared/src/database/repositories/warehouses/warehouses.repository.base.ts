import { and, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { warehouses } from '../../schema/index.js';
import type { Warehouse, NewWarehouse } from '../../schema/index.js';

/**
 * Warehouses Repository Base
 *
 * Framework-agnostic repository for warehouse management.
 */
export class WarehousesRepositoryBase extends BaseRepository<typeof warehouses> {
  async findByVendorAndErpId(vendorId: string, erpWarehouseId: string): Promise<Warehouse | null> {
    try {
      const [warehouse] = await this.db
        .select()
        .from(warehouses)
        .where(
          and(eq(warehouses.vendorId, vendorId), eq(warehouses.erpWarehouseId, erpWarehouseId)),
        )
        .limit(1);
      return warehouse ?? null;
    } catch (error) {
      this.handleError('FIND_BY_VENDOR_AND_ERP_ID', error, { vendorId, erpWarehouseId });
      return null;
    }
  }

  async findByVendor(
    vendorId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: Warehouse[]; total: number }> {
    try {
      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(warehouses)
          .where(eq(warehouses.vendorId, vendorId))
          .limit(limit)
          .offset((page - 1) * limit),
        this.db
          .select({ value: sql<number>`count(*)` })
          .from(warehouses)
          .where(eq(warehouses.vendorId, vendorId)),
      ]);
      const total = Number(countResult[0]?.value ?? 0);
      return { data, total };
    } catch (error) {
      this.handleError('FIND_BY_VENDOR', error, { vendorId, page, limit });
      return { data: [], total: 0 };
    }
  }

  async upsertBatch(records: NewWarehouse[]): Promise<Warehouse[]> {
    try {
      const result = await this.db
        .insert(warehouses)
        .values(records)
        .onConflictDoUpdate({
          target: [warehouses.vendorId, warehouses.erpWarehouseId],
          set: {
            name: sql`excluded.name`,
            code: sql`excluded.code`,
            address: sql`excluded.address`,
            city: sql`excluded.city`,
            postalCode: sql`excluded.postal_code`,
            country: sql`excluded.country`,
            state: sql`excluded.state`,
            latitude: sql`excluded.latitude`,
            longitude: sql`excluded.longitude`,
            isDefault: sql`excluded.is_default`,
            isMain: sql`excluded.is_main`,
            type: sql`excluded.type`,
            multiLocationEnabled: sql`excluded.multi_location_enabled`,
            lastInventoryDate: sql`excluded.last_inventory_date`,
            isActive: sql`excluded.is_active`,
            contentHash: sql`excluded.content_hash`,
            lastSyncedAt: sql`excluded.last_synced_at`,
            updatedAt: this.getUpdatedTimestamp(),
          },
        })
        .returning();
      return result;
    } catch (error) {
      this.handleError('UPSERT_BATCH', error, { count: records.length });
      return [];
    }
  }
}
