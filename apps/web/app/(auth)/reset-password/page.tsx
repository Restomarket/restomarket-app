'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';

import { authClient } from '@/lib/auth/auth.client';
import { resetPasswordSchema, type ResetPasswordInput } from '@repo/shared';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Spinner } from '@repo/ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@repo/ui/form';
import { AuthError } from '@repo/ui/auth/auth-error';
import { PasswordStrength } from '@repo/ui/auth/password-strength';
import { Alert, AlertDescription } from '@repo/ui/alert';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [isValidating, setIsValidating] = React.useState(true);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = form.watch('password');

  // Validate token on mount
  React.useEffect(() => {
    if (!token) {
      setError(new Error('Invalid or missing reset token'));
      setIsValidating(false);
      return;
    }

    // Token validation is done during the reset call
    setIsValidating(false);
  }, [token]);

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      setError(new Error('Invalid or missing reset token'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.resetPassword({
        newPassword: data.password,
        token,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to reset password');
      }

      toast.success('Password reset successfully');

      // Redirect to login
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reset password'));
      toast.error('Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="space-y-6 text-center">
        <Spinner className="mx-auto" />
        <p className="text-sm text-muted-foreground">Validating reset token...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-destructive">
            Invalid Reset Link
          </h2>
          <p className="text-sm text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertDescription>
            Password reset links expire after 1 hour. Please request a new reset link.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Link href="/forgot-password" className="block">
            <Button className="w-full">Request new reset link</Button>
          </Link>

          <Link href="/login" className="block">
            <Button variant="outline" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
        <p className="text-sm text-muted-foreground">Enter your new password below</p>
      </div>

      {error && <AuthError error={error} />}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" disabled={isLoading} {...field} />
                </FormControl>
                <FormMessage />
                <PasswordStrength password={passwordValue} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" disabled={isLoading} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner />
                Resetting password...
              </>
            ) : (
              'Reset password'
            )}
          </Button>
        </form>
      </Form>

      <Link href="/login" className="block">
        <Button variant="ghost" className="w-full">
          Back to sign in
        </Button>
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
        </div>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
