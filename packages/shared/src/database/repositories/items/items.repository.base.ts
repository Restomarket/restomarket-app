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
            // Identity & display
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            slug: sql`excluded.slug`,
            erpId: sql`excluded.erp_id`,
            barcode: sql`excluded.barcode`,

            // Classifications & mappings
            unitCode: sql`excluded.unit_code`,
            unitLabel: sql`excluded.unit_label`,
            vatCode: sql`excluded.vat_code`,
            vatRate: sql`excluded.vat_rate`,
            familyCode: sql`excluded.family_code`,
            familyLabel: sql`excluded.family_label`,
            subfamilyCode: sql`excluded.subfamily_code`,
            subfamilyLabel: sql`excluded.subfamily_label`,

            // Pricing
            unitPrice: sql`excluded.unit_price`,
            priceExclVat: sql`excluded.price_excl_vat`,
            priceInclVat: sql`excluded.price_incl_vat`,
            vatAmount: sql`excluded.vat_amount`,
            catalogPrice: sql`excluded.catalog_price`,
            purchasePrice: sql`excluded.purchase_price`,
            minimumOrderQuantity: sql`excluded.minimum_order_quantity`,
            lastSyncedFrom: sql`excluded.last_synced_from`,

            // Stock management flags
            manageStock: sql`excluded.manage_stock`,
            allowNegativeStock: sql`excluded.allow_negative_stock`,
            stockBookingAllowed: sql`excluded.stock_booking_allowed`,
            automaticStockBooking: sql`excluded.automatic_stock_booking`,
            trackingMode: sql`excluded.tracking_mode`,
            pickMovementDisallowedOnTotallyBookedItem: sql`excluded.pick_movement_disallowed_on_totally_booked_item`,

            // Physical attributes
            weight: sql`excluded.weight`,
            weightUnit: sql`excluded.weight_unit`,
            height: sql`excluded.height`,
            width: sql`excluded.width`,
            length: sql`excluded.length`,
            dimensionUnit: sql`excluded.dimension_unit`,
            itemsPerPackage: sql`excluded.items_per_package`,

            // E-commerce metadata
            metaTitle: sql`excluded.meta_title`,
            metaDescription: sql`excluded.meta_description`,
            metaKeywords: sql`excluded.meta_keywords`,
            brand: sql`excluded.brand`,
            daysToShip: sql`excluded.days_to_ship`,
            shipPriceTtc: sql`excluded.ship_price_ttc`,

            // International trade
            originCountryCode: sql`excluded.origin_country_code`,

            // Status
            isActive: sql`excluded.is_active`,
            publishOnWeb: sql`excluded.publish_on_web`,
            currency: sql`excluded.currency`,

            // Sync metadata
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

  /**
   * Update aggregated stock totals for items
   * Mirrors EBP's Item.RealStock/VirtualStock/BookedQuantity (pre-aggregated across warehouses)
   * Called after per-warehouse stock sync to maintain totals for fast availability checks
   */
  async updateAggregatedStock(
    vendorId: string,
    aggregates: Array<{
      itemId: string;
      totalRealStock: number;
      totalVirtualStock: number;
      totalReservedQuantity: number;
    }>,
  ): Promise<void> {
    try {
      // Update each item's aggregated stock totals
      for (const aggregate of aggregates) {
        await this.db
          .update(items)
          .set({
            totalRealStock: aggregate.totalRealStock.toString(),
            totalVirtualStock: aggregate.totalVirtualStock.toString(),
            totalReservedQuantity: aggregate.totalReservedQuantity.toString(),
            updatedAt: this.getUpdatedTimestamp(),
          })
          .where(and(eq(items.vendorId, vendorId), eq(items.id, aggregate.itemId)));
      }
    } catch (error) {
      this.handleError('UPDATE_AGGREGATED_STOCK', error, {
        vendorId,
        count: aggregates.length,
      });
    }
  }
}
