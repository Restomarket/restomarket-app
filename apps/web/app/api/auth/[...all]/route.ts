import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth/auth.config';

/**
 * Better Auth API Route Handler
 *
 * This route handles all authentication endpoints:
 * - POST /api/auth/sign-in/email
 * - POST /api/auth/sign-up/email
 * - POST /api/auth/sign-out
 * - GET /api/auth/session
 * - POST /api/auth/forget-password
 * - POST /api/auth/reset-password
 * - GET /api/auth/callback/google (OAuth callback)
 * - POST /api/auth/organization/* (Organization endpoints)
 * - And more...
 *
 * @see https://www.better-auth.com/docs/reference/api
 */
export const { GET, POST } = toNextJsHandler(auth);
