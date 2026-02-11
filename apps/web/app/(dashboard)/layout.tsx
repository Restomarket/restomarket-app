import * as React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/auth.server';
import { DashboardHeader } from './_components/dashboard-header';

/**
 * Dashboard Layout
 *
 * Provides a consistent layout for all dashboard pages with:
 * - Header with navigation
 * - User menu with sign out
 * - Main content area
 */

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader userEmail={session.user.email} />

      {/* Main content */}
      <main className="container py-6">{children}</main>
    </div>
  );
}
