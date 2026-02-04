import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Authentication Proxy (Next.js 16+)
 *
 * This proxy protects routes and handles authentication redirects.
 *
 * ⚠️ SECURITY WARNING:
 * This proxy only checks for the existence of a session cookie - it does NOT validate it.
 * Anyone can manually create a cookie to bypass this check.
 * You MUST always validate the session on your server for any protected actions or pages.
 *
 * Route Protection Strategy:
 * - Public routes: Accessible without authentication
 * - Protected routes: Require authentication (redirect to /login)
 * - Auth routes: Redirect to /dashboard if already authenticated
 *
 * Cookie Configuration:
 * - Using default Better Auth cookie name: 'better-auth.session_token'
 * - Using default cookie prefix: 'better-auth'
 * - If you customize these in auth.config.ts, update getSessionCookie() accordingly:
 *   getSessionCookie(request, { cookieName: 'custom_name', cookiePrefix: 'custom_prefix' })
 *
 * @see https://www.better-auth.com/docs/integrations/next
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */

// ============================================
// Route Configuration
// ============================================

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite', // Organization invitations
  '/api/auth', // Better Auth API routes
];

/**
 * Routes that should redirect to dashboard if authenticated
 */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

/**
 * Protected route patterns (require authentication)
 */
const PROTECTED_PATTERNS = [
  '/dashboard',
  '/organizations',
  '/settings',
  '/products',
  '/orders',
  '/customers',
  '/reports',
  '/billing',
  '/team',
  '/admin',
];

// ============================================
// Helper Functions
// ============================================

/**
 * Check if path matches any of the provided patterns
 */
function matchesPath(pathname: string, patterns: string[]): boolean {
  return patterns.some(
    pattern =>
      pathname === pattern || pathname.startsWith(`${pattern}/`) || pathname.startsWith(pattern),
  );
}

// ============================================
// Proxy Function
// ============================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip proxy for static files and API routes (except auth routes we handle)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Files with extensions
  ) {
    return NextResponse.next();
  }

  // Get session cookie using Better Auth helper
  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = !!sessionCookie;

  // ============================================
  // Public Routes - Always Allow
  // ============================================
  if (matchesPath(pathname, PUBLIC_ROUTES)) {
    // Redirect authenticated users away from auth pages
    if (isAuthenticated && matchesPath(pathname, AUTH_ROUTES)) {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.next();
  }

  // ============================================
  // Protected Routes - Require Authentication
  // ============================================
  if (matchesPath(pathname, PROTECTED_PATTERNS)) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ⚠️ NOTE: This proxy only checks for cookie existence.
    // For critical operations, always validate the session server-side
    // in your page/route using auth.api.getSession()

    return NextResponse.next();
  }

  // ============================================
  // Default - Allow Request
  // ============================================
  return NextResponse.next();
}

// ============================================
// Proxy Matcher Configuration
// ============================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
