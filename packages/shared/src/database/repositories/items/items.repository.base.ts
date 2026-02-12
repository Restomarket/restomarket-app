import { and, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { items } from '../../schema/index.js';
import type { Item, NewItem } from '../../schema/index.js';

/**
 * Items Repository Base
 *
 * Framework-agnostic repository for item (product catalog) management.
 */
export class ItemsRepositoryBase extends BaseRepository<typeof items> {
  async findByVendorAndSku(vendorId: string, sku: string): Promise<Item | null> {
    try {
      const [item] = await this.db
        .select()
        .from(items)
        .where(and(eq(items.vendorId, vendorId), eq(items.sku, sku)))
        .limit(1);
      return item ?? null;
    } catch (error) {
      this.handleError('FIND_BY_VENDOR_AND_SKU', error, { vendorId, sku });
      return null;
    }
  }

  async findByVendorAndErpId(vendorId: string, erpId: string): Promise<Item | null> {
    try {
      const [item] = await this.db
        .select()
        .from(items)
        .where(and(eq(items.vendorId, vendorId), eq(items.erpId, erpId)))
        .limit(1);
      return item ?? null;
    } catch (error) {
      this.handleError('FIND_BY_VENDOR_AND_ERP_ID', error, { vendorId, erpId });
      return null;
    }
  }

  async findByVendor(
    vendorId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: Item[]; total: number }> {
    try {
      const [data, countResult] = await Promise.all([
        this.db
          .select()
          .from(items)
          .where(eq(items.vendorId, vendorId))
          .limit(limit)
          .offset((page - 1) * limit),
        this.db
          .select({ value: sql<number>`count(*)` })
          .from(items)
          .where(eq(items.vendorId, vendorId)),
      ]);
      const total = Number(countResult[0]?.value ?? 0);
      return { data, total };
    } catch (error) {
      this.handleError('FIND_BY_VENDOR', error, { vendorId, page, limit });
      return { data: [], total: 0 };
    }
  }

  async upsertBatch(records: NewItem[]): Promise<Item[]> {
    try {
      const result = await this.db
        .insert(items)
        .values(records)
        .onConflictDoUpdate({
          target: [items.vendorId, items.sku],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            unitCode: sql`excluded.unit_code`,
            unitLabel: sql`excluded.unit_label`,
            vatCode: sql`excluded.vat_code`,
            vatRate: sql`excluded.vat_rate`,
            familyCode: sql`excluded.family_code`,
            familyLabel: sql`excluded.family_label`,
            subfamilyCode: sql`excluded.subfamily_code`,
            subfamilyLabel: sql`excluded.subfamily_label`,
            unitPrice: sql`excluded.unit_price`,
            priceExclVat: sql`excluded.price_excl_vat`,
            priceInclVat: sql`excluded.price_incl_vat`,
            vatAmount: sql`excluded.vat_amount`,
            erpId: sql`excluded.erp_id`,
            manageStock: sql`excluded.manage_stock`,
            allowNegativeStock: sql`excluded.allow_negative_stock`,
            barcode: sql`excluded.barcode`,
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
