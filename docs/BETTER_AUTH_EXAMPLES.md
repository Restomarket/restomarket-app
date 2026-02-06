/\*\*

- Example: Complete Authentication Flow
-
- This file demonstrates how to implement authentication
- in your Next.js 16 app with Better Auth.
  \*/

// ============================================
// 1. PROXY (proxy.ts) - Optimistic Protection
// ============================================

/\*\*

- The proxy only checks if a session cookie exists.
- It does NOT validate the session.
-
- Purpose: Fast redirects for better UX
- Security: ⚠️ NOT SECURE - can be bypassed
  \*/

import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export async function proxy(request: NextRequest) {
const { pathname } = request.nextUrl;

// Get session cookie (doesn't validate it!)
const sessionCookie = getSessionCookie(request);

// Redirect to login if no cookie (optimistic check)
if (pathname.startsWith('/dashboard') && !sessionCookie) {
return NextResponse.redirect(new URL('/login', request.url));
}

return NextResponse.next();
}

// ============================================
// 2. PROTECTED PAGE - Real Validation
// ============================================

/\*\*

- Server Component that requires authentication
- This is where REAL security happens
  \*/

// app/dashboard/page.tsx
import { requireAuth } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
// ✅ SECURE: Validates session against database
const session = await requireAuth();

return (
<div>
<h1>Dashboard</h1>
<p>Welcome, {session.user.name}!</p>
<UserOrganizations userId={session.user.id} />
</div>
);
}

// ============================================
// 3. SERVER ACTION - Protected Mutation
// ============================================

/\*\*

- Server Action that modifies data
- Must validate session at the start
  \*/

'use server';

import { requireAuth } from '@/lib/auth/session';
import { db } from '@/lib/database';
import { revalidatePath } from 'next/cache';

export async function createOrganization(formData: FormData) {
// ✅ SECURE: Validate session first
const session = await requireAuth();

const name = formData.get('name') as string;

// Use Better Auth's organization creation
const org = await auth.api.createOrganization({
body: {
name,
slug: name.toLowerCase().replace(/\s+/g, '-'),
},
headers: {
// Pass session for auth context
authorization: `Bearer ${session.session.token}`,
},
});

revalidatePath('/organizations');
redirect(`/organizations/${org.id}`);
}

// ============================================
// 4. CLIENT COMPONENT - Interactive UI
// ============================================

/\*\*

- Client component with auth state
- Uses Better Auth React hooks
  \*/

'use client';

import { useSession, signOut } from '@/lib/auth/auth-client';

export function UserMenu() {
const { data: session, isPending } = useSession();

if (isPending) {
return <div>Loading...</div>;
}

if (!session) {
return (
<a href="/login" className="btn">
Sign In
</a>
);
}

return (
<div className="user-menu">
<img src={session.user.image} alt={session.user.name} />
<span>{session.user.name}</span>
<button onClick={() => signOut()}>Sign Out</button>
</div>
);
}

// ============================================
// 5. SIGN IN FORM - Client Authentication
// ============================================

/\*\*

- Client-side sign in form
- Uses Better Auth client actions
  \*/

'use client';

import { signIn } from '@/lib/auth/auth-client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SignInForm() {
const router = useRouter();
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);

async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();
setLoading(true);
setError('');

    const formData = new FormData(e.currentTarget);

    try {
      const result = await signIn.email({
        email: formData.get('email') as string,
        password: formData.get('password') as string,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      // Success - redirect to dashboard
      router.push('/dashboard');
      router.refresh(); // Refresh server components
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }

}

return (
<form onSubmit={handleSubmit} className="space-y-4">
{error && (
<div className="bg-red-50 text-red-600 p-3 rounded">
{error}
</div>
)}

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <p>
        Don't have an account? <a href="/register">Sign up</a>
      </p>
    </form>

);
}

// ============================================
// 6. API ROUTE - Server-Side API
// ============================================

/\*\*

- API Route Handler with authentication
  \*/

// app/api/profile/route.ts
import { auth } from '@/lib/auth/auth.config';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
// Validate session in API route
const session = await auth.api.getSession({
headers: await headers(),
});

if (!session) {
return NextResponse.json(
{ error: 'Unauthorized' },
{ status: 401 }
);
}

return NextResponse.json({
user: session.user,
});
}

export async function PATCH(request: Request) {
// Validate session
const session = await auth.api.getSession({
headers: await headers(),
});

if (!session) {
return NextResponse.json(
{ error: 'Unauthorized' },
{ status: 401 }
);
}

const body = await request.json();

// Update user profile
// ... your update logic

return NextResponse.json({ success: true });
}

// ============================================
// 7. ORGANIZATION-SPECIFIC PAGE
// ============================================

/\*\*

- Page that requires organization membership
  \*/

// app/organizations/[id]/settings/page.tsx
import { requireAuth } from '@/lib/auth/session';
import { db } from '@/lib/database';
import { members } from '@repo/shared';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

interface Props {
params: { id: string };
}

export default async function OrganizationSettingsPage({ params }: Props) {
// First: Validate session
const session = await requireAuth();

// Second: Check organization membership and permissions
const member = await db.query.members.findFirst({
where: and(
eq(members.organizationId, params.id),
eq(members.userId, session.user.id)
),
});

if (!member) {
redirect('/organizations'); // Not a member
}

// Third: Check role permissions
if (member.role !== 'owner' && member.role !== 'admin') {
redirect(`/organizations/${params.id}`); // No permission
}

// ✅ User is authenticated AND authorized
return (
<div>
<h1>Organization Settings</h1>
{/_ Settings form _/}
</div>
);
}

// ============================================
// 8. CONDITIONAL RENDERING
// ============================================

/\*\*

- Server component with conditional rendering
- based on authentication status
  \*/

// app/page.tsx
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function HomePage() {
const session = await getSession();

// If authenticated, redirect to dashboard
if (session) {
redirect('/dashboard');
}

// If not authenticated, show landing page
return (
<div>
<h1>Welcome to Our App</h1>
<a href="/login">Sign In</a>
<a href="/register">Sign Up</a>
</div>
);
}

// ============================================
// 9. PARALLEL DATA FETCHING
// ============================================

/\*\*

- Fetch multiple resources with auth in parallel
  \*/

// app/dashboard/overview/page.tsx
import { requireAuth } from '@/lib/auth/session';
import { db } from '@/lib/database';

export default async function DashboardOverviewPage() {
const session = await requireAuth();

// Fetch multiple resources in parallel
const [organizations, activeOrg, userProfile] = await Promise.all([
// User's organizations
db.query.members.findMany({
where: eq(members.userId, session.user.id),
with: { organization: true },
}),

    // Active organization details
    session.session.activeOrganizationId
      ? db.query.organizations.findFirst({
          where: eq(organizations.id, session.session.activeOrganizationId),
        })
      : null,

    // User profile data
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    }),

]);

return (
<div>
<h1>Dashboard Overview</h1>
{/_ Render data _/}
</div>
);
}

// ============================================
// 10. ERROR HANDLING
// ============================================

/\*\*

- Proper error handling in auth flows
  \*/

'use client';

import { signUp } from '@/lib/auth/auth-client';
import { useState } from 'react';

export function SignUpForm() {
const [error, setError] = useState<string | null>(null);

async function handleSignUp(formData: FormData) {
try {
const result = await signUp.email({
email: formData.get('email') as string,
password: formData.get('password') as string,
name: formData.get('name') as string,
});

      if (result.error) {
        // Handle specific error types
        switch (result.error.status) {
          case 400:
            setError('Invalid email or password');
            break;
          case 409:
            setError('An account with this email already exists');
            break;
          default:
            setError('Something went wrong. Please try again.');
        }
        return;
      }

      // Success
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Network error. Please check your connection.');
    }

}

return (
<form action={handleSignUp}>
{error && <div className="error">{error}</div>}
{/_ Form fields _/}
</form>
);
}
