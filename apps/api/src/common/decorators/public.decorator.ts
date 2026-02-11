/**
 * @deprecated Use AllowAnonymous from @thallesp/nestjs-better-auth instead
 *
 * Re-export for backward compatibility
 * @example
 * import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
 * // or
 * import { AllowAnonymous } from './auth';
 *
 * @AllowAnonymous()
 * @Get('public')
 * getPublicData() {
 *   return 'This is public data';
 * }
 */
export { AllowAnonymous as Public } from '@thallesp/nestjs-better-auth';
