import { Test, type TestingModule } from '@nestjs/testing';
import {
  type INestApplication,
  ValidationPipe,
  type Type,
  type ModuleMetadata,
} from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from '@repo/shared';
import { DatabaseCleaner } from './database-cleaner';
import { UserFactory } from '../factories';

/**
 * E2E Test Setup Builder - Provides a fluent API for configuring E2E tests
 *
 * Inspired by the article's approach, this class handles:
 * - Test module configuration
 * - Database connection management
 * - Factory initialization
 * - Automatic cleanup
 * - Flexible test scenarios (full app, specific modules, with mocks)
 *
 * Usage:
 *   // Full E2E test
 *   const setup = await new E2ETestSetup()
 *     .withAppModule()
 *     .setupApp();
 *
 *   // Integration test with specific modules
 *   const setup = await new E2ETestSetup()
 *     .withCustomModule()
 *     .withImports(DatabaseModule, UsersModule)
 *     .setupApp();
 *
 *   // E2E with mocked service
 *   const setup = await new E2ETestSetup()
 *     .withAppModule()
 *     .overrideProvider(EmailService, mockEmailService)
 *     .setupApp();
 */
export class E2ETestSetup {
  private moduleMetadata: ModuleMetadata = {};
  private app?: INestApplication;
  private connection?: Sql;
  private db?: PostgresJsDatabase<typeof schema>;
  private cleaner?: DatabaseCleaner;
  private factories = new Map<string, any>();
  private providerOverrides: { token: any; value: any }[] = [];
  private useAppModule = false;
  private globalPipes: any[] = [];

  /**
   * Use the full AppModule for complete E2E testing
   * This boots the entire application
   */
  withAppModule(): this {
    this.useAppModule = true;
    return this;
  }

  /**
   * Use custom module configuration for integration testing
   * Allows testing specific modules in isolation
   */
  withCustomModule(): this {
    this.useAppModule = false;
    return this;
  }

  /**
   * Add imports to the test module
   * Use with withCustomModule() for integration tests
   */
  withImports(...imports: any[]): this {
    this.moduleMetadata.imports = [...(this.moduleMetadata.imports ?? []), ...imports];
    return this;
  }

  /**
   * Add providers to the test module
   */
  withProviders(...providers: any[]): this {
    this.moduleMetadata.providers = [...(this.moduleMetadata.providers ?? []), ...providers];
    return this;
  }

  /**
   * Add controllers to the test module
   */
  withControllers(...controllers: any[]): this {
    this.moduleMetadata.controllers = [...(this.moduleMetadata.controllers ?? []), ...controllers];
    return this;
  }

  /**
   * Override a provider with a mock or different implementation
   * Useful for mocking external services in E2E tests
   */
  overrideProvider(token: Type<any> | string | symbol, value: any): this {
    this.providerOverrides.push({ token, value });
    return this;
  }

  /**
   * Add global pipes to the application
   * By default, adds ValidationPipe with sensible defaults
   */
  withGlobalPipes(...pipes: any[]): this {
    this.globalPipes.push(...pipes);
    return this;
  }

  /**
   * Setup and initialize the test application
   * This is the final step in the builder chain
   */
  async setupApp(): Promise<E2ETestSetup> {
    // Setup database connection
    await this.setupDatabase();

    // Create test module
    const moduleBuilder = await this.createTestModule();

    // CRITICAL: Override database providers to use test connection
    // This ensures the app and tests share the same database connection
    // Create a proxy for the connection that prevents the DatabaseModule from closing it
    const connectionProxy = new Proxy(this.connection!, {
      get: (target, prop) => {
        // Prevent DatabaseModule.onModuleDestroy from closing our test connection
        if (prop === 'end') {
          return async () => {
            // No-op - we'll close it ourselves in teardown()
          };
        }
        return target[prop as keyof typeof target];
      },
    });

    const { DATABASE_CONNECTION, POSTGRES_CLIENT } =
      await import('../../src/database/database.module');
    moduleBuilder.overrideProvider(POSTGRES_CLIENT).useValue(connectionProxy);
    moduleBuilder.overrideProvider(DATABASE_CONNECTION).useValue(this.db);

    // Apply provider overrides
    for (const override of this.providerOverrides) {
      moduleBuilder.overrideProvider(override.token).useValue(override.value);
    }

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    // Create and configure app
    this.app = moduleFixture.createNestApplication();

    // Apply global pipes (default ValidationPipe if none specified)
    if (this.globalPipes.length > 0) {
      this.globalPipes.forEach(pipe => this.app!.useGlobalPipes(pipe));
    } else {
      this.app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true,
          forbidNonWhitelisted: true,
        }),
      );
    }

    await this.app.init();

    // Initialize factories
    this.initializeFactories();

    return this;
  }

  /**
   * Get the initialized NestJS application
   */
  get nestApp(): INestApplication {
    if (!this.app) {
      throw new Error('App not initialized. Call setupApp() first.');
    }
    return this.app;
  }

  /**
   * Get the HTTP server for supertest
   */
  get serverHttp(): any {
    return this.nestApp.getHttpServer();
  }

  /**
   * Get the database instance
   */
  get database(): PostgresJsDatabase<typeof schema> {
    if (!this.db) {
      throw new Error('Database not initialized. Call setupApp() first.');
    }
    return this.db;
  }

  /**
   * Get a factory by name
   */
  getFactory(name: 'user'): UserFactory;
  getFactory(name: string): any {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(
        `Factory '${name}' not found. Available factories: ${Array.from(this.factories.keys()).join(', ')}`,
      );
    }
    return factory;
  }

  /**
   * Clean the database (call this in beforeEach for test isolation)
   */
  async cleanup(): Promise<void> {
    if (!this.cleaner) {
      throw new Error('Database cleaner not initialized. Call setupApp() first.');
    }

    try {
      await this.cleaner.cleanAll();
      // Reset factory sequences for predictable test data
      UserFactory.resetSequence();
    } catch (error) {
      console.error('Failed to cleanup database:', error);
      throw error;
    }
  }

  /**
   * Teardown and close all connections
   * Call this in afterAll
   */
  async teardown(): Promise<void> {
    try {
      if (this.app) {
        await this.app.close();
      }
    } catch (error) {
      console.error('Failed to close app:', error);
    }

    try {
      if (this.connection) {
        await this.connection.end({ timeout: 5 });
      }
    } catch (error) {
      console.error('Failed to close database connection:', error);
    }
  }

  /**
   * Setup database connection
   */
  private async setupDatabase(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined in test environment');
    }

    this.connection = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      // Match production config - disable prepared statements
      // This ensures compatibility with pooled connections and test environments
      prepare: false,
    });

    this.db = drizzle(this.connection, { schema });
    this.cleaner = new DatabaseCleaner(this.db);
  }

  /**
   * Create the test module
   */
  private async createTestModule(): Promise<any> {
    if (this.useAppModule) {
      // Dynamic import to avoid circular dependencies
      const { AppModule } = await import('../../src/app.module');
      return Test.createTestingModule({
        imports: [AppModule],
      });
    }

    return Test.createTestingModule(this.moduleMetadata);
  }

  /**
   * Initialize all factories
   */
  private initializeFactories(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.factories.set('user', new UserFactory(this.db));
    // Add more factories here as needed
    // this.factories.set('post', new PostFactory(this.db));
  }
}
