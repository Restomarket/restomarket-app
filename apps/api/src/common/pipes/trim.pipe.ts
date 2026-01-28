import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Pipe to trim string values from request body
 * Recursively trims all string values in objects and arrays
 */
@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body') {
      return value;
    }

    return this.trimValue(value);
  }

  private trimValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value.map(item => this.trimValue(item));
    }

    if (value !== null && typeof value === 'object') {
      const trimmedObject: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        trimmedObject[key] = this.trimValue(val);
      }
      return trimmedObject;
    }

    return value;
  }
}
