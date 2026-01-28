import { Global, Module } from '@nestjs/common';
import { DateService } from './services/date.service';
import { ValidationService } from './services/validation.service';

@Global()
@Module({
  providers: [DateService, ValidationService],
  exports: [DateService, ValidationService],
})
export class SharedModule {}
