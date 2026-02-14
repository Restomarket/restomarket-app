import { eq } from 'drizzle-orm';
import { BaseRepository } from '../base/base.repository.js';
import { vatRates } from '../../schema/index.js';
import type { VatRate, NewVatRate } from '../../schema/index.js';

export class VatRatesRepositoryBase extends BaseRepository<typeof vatRates> {
  async findByVendorAndCode(vendorId: string, code: string): Promise<VatRate | null> {
    try {
      const [rate] = await this.db
        .select()
        .from(vatRates)
        .where(eq(vatRates.vendorId, vendorId) && eq(vatRates.code, code))
        .limit(1);
      return rate ?? null;
    } catch (error) {
      this.handleError('FIND_BY_VENDOR_CODE', error, { vendorId, code });
      return null;
    }
  }

  async findById(id: string): Promise<VatRate | null> {
    try {
      const [rate] = await this.db.select().from(vatRates).where(eq(vatRates.id, id)).limit(1);
      return rate ?? null;
    } catch (error) {
      this.handleError('FIND_BY_ID', error, { id });
      return null;
    }
  }
}
