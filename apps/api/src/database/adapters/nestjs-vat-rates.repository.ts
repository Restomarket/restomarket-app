import { Injectable, Inject } from '@nestjs/common';
import { VatRatesRepositoryBase, vatRates, type DatabaseConnection } from '@repo/shared';
import { DATABASE_CONNECTION } from '../database.constants';

@Injectable()
export class VatRatesRepository extends VatRatesRepositoryBase {
  constructor(@Inject(DATABASE_CONNECTION) db: DatabaseConnection) {
    super(db, vatRates);
  }
}
