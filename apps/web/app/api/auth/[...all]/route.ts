import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth/auth.config';
import { NextResponse } from 'next/server';

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

/**
 * Handle CORS preflight requests (OPTIONS)
 *
 * This is required for cross-origin requests to the auth API.
 * Returns appropriate CORS headers to allow the actual request to proceed.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}
