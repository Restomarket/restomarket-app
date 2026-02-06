import { Module, Global } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { APP_GUARD } from '@nestjs/core';
import { auth } from './auth';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  imports: [BetterAuthModule.forRoot({ auth })],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }],
  exports: [BetterAuthModule],
})
export class AuthModule {}
