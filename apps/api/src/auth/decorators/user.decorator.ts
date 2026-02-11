import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from '../guards/permissions.guard';

/** Extract authenticated user from session */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<AuthRequest>().session?.user;
    return user && data ? user[data] : user;
  },
);

/** Extract active organization ID from session */
export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<AuthRequest>().session?.session?.activeOrganizationId ?? null,
);

/** Extract active team ID from session */
export const CurrentTeam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<AuthRequest>().session?.session?.activeTeamId ?? null,
);
