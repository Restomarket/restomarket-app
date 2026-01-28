import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  id: string;
  email: string;
  roles?: string[];
}

/**
 * Decorator to extract the current user from the request object
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: CurrentUserPayload) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof CurrentUserPayload | undefined,
    ctx: ExecutionContext,
  ): CurrentUserPayload | string | string[] | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserPayload }>();
    const user = request.user;

    return data && user ? user[data] : user;
  },
);
