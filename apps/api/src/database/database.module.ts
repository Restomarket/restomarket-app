import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from '@repo/shared';
import type { DatabaseConnection as SharedDatabaseConnection } from '@repo/shared';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const POSTGRES_CLIENT = 'POSTGRES_CLIENT';

export type DatabaseConnection = SharedDatabaseConnection;

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      useFactory: (configService: ConfigService): Sql => {
        const connectionString = configService.get<string>('database.url');

        if (!connectionString) {
          throw new Error('DATABASE_URL is not defined');
        }

        const sslConfig = configService.get<{ rejectUnauthorized?: boolean; ca?: string } | false>(
          'database.ssl',
        );

        return postgres(connectionString, {
          max: configService.get<number>('database.poolMax', 10),
          idle_timeout: configService.get<number>('database.idleTimeout', 20),
          connect_timeout: configService.get<number>('database.connectTimeout', 10),
          // CRITICAL: Disable prepared statements for Supabase transaction mode pooler
          // Supabase pooler in transaction mode does not support prepared statements
          prepare: false,
          ...(sslConfig && typeof sslConfig === 'object' ? { ssl: sslConfig } : {}),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: DATABASE_CONNECTION,
      useFactory: (client: Sql): DatabaseConnection => {
        return drizzle(client, {
          schema,
        });
      },
      inject: [POSTGRES_CLIENT],
    },
  ],
  exports: [DATABASE_CONNECTION, POSTGRES_CLIENT],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: Sql) {}

  async onModuleDestroy() {
    await this.client.end({ timeout: 5 });
  }
}
