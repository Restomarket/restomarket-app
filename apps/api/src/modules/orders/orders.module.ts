import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DatabaseModule } from '@database/database.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => SyncModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
