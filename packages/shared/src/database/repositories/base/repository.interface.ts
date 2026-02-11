import type { DatabaseConnection } from '../../../types/database.types.js';

export interface IRepository {
  transaction<T>(callback: (tx: DatabaseConnection) => Promise<T>): Promise<T>;
}

export interface ILogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export class ConsoleLogger implements ILogger {
  constructor(private context?: string) {}

  info(message: string, ctx?: Record<string, unknown>): void {
    console.log(`[${this.context ?? 'DB'}] ${message}`, ctx ?? '');
  }

  error(message: string, ctx?: Record<string, unknown>): void {
    console.error(`[${this.context ?? 'DB'}] ${message}`, ctx ?? '');
  }

  warn(message: string, ctx?: Record<string, unknown>): void {
    console.warn(`[${this.context ?? 'DB'}] ${message}`, ctx ?? '');
  }

  debug(message: string, ctx?: Record<string, unknown>): void {
    console.debug(`[${this.context ?? 'DB'}] ${message}`, ctx ?? '');
  }
}
