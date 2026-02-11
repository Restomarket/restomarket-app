import * as React from 'react';
import { requireAuth } from '@/lib/auth/auth.server';
import { Card } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your RestoMarket dashboard',
};

/**
 * Dashboard Page
 *
 * This is a protected page that requires authentication.
 * The requireAuth() function will automatically redirect
 * unauthenticated users to the login page.
 */
export default async function DashboardPage() {
  // This will redirect to login if not authenticated
  const session = await requireAuth();

  const { user } = session;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user.name || user.email}!</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* User Info Card */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">User Information</h3>
              <p className="text-sm text-muted-foreground">Your account details</p>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">{user.name || 'Not set'}</p>
              </div>

              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              <div>
                <p className="text-sm font-medium">Email Verified</p>
                <Badge variant={user.emailVerified ? 'default' : 'destructive'}>
                  {user.emailVerified ? 'Verified' : 'Not Verified'}
                </Badge>
              </div>

              {user.image && (
                <div>
                  <p className="text-sm font-medium">Profile Image</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.image}
                    alt={user.name || 'Profile'}
                    className="size-12 rounded-full"
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Session Info Card */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Session Information</h3>
              <p className="text-sm text-muted-foreground">Your current session</p>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Session ID</p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {session.session.id}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">User ID</p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {session.session.userId}
                </p>
              </div>

              {session.session.activeOrganizationId && (
                <div>
                  <p className="text-sm font-medium">Active Organization</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {session.session.activeOrganizationId}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Quick Actions Card */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Quick Actions</h3>
              <p className="text-sm text-muted-foreground">Common tasks and features</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                🚀 Complete authentication system is now live!
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Email/password authentication</li>
                <li>OAuth (Google)</li>
                <li>Email verification</li>
                <li>Password reset</li>
                <li>Protected routes</li>
                <li>Session management</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Debug Info (remove in production) */}
      <Card className="p-6 bg-muted/50">
        <details>
          <summary className="cursor-pointer font-semibold">
            Debug: Session Data (Development Only)
          </summary>
          <pre className="mt-4 text-xs overflow-auto">{JSON.stringify(session, null, 2)}</pre>
        </details>
      </Card>
    </div>
  );
}
