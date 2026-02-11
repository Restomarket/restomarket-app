import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/auth.config';

/**
 * Authentication Proxy (Next.js 16+)
 *
 * This proxy protects routes and handles authentication redirects.
 *
 * Uses Better Auth's getSession() for proper session validation.
 *
 * Route Protection Strategy:
 * - Public routes: Accessible without authentication
 * - Protected routes: Require authentication (redirect to /login)
 * - Auth routes: Redirect to /dashboard if already authenticated
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

  // Validate session using Better Auth
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  const isAuthenticated = !!session?.user;

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
