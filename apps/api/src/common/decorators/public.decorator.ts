import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark routes as public (bypass authentication)
 * @example
 * @Public()
 * @Get('public')
 * getPublicData() {
 *   return 'This is public data';
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
