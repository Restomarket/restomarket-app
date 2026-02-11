'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { forgotPassword } from '@/lib/auth/auth.client';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@repo/shared';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Spinner } from '@repo/ui/spinner';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@repo/ui/form';
import { AuthError } from '@repo/ui/auth/auth-error';
import { Alert, AlertDescription } from '@repo/ui/alert';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState('');

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    setError(null);

    try {
      // Better Auth forgot password
      const result = await forgotPassword({
        email: data.email,
        redirectTo: '/reset-password',
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to send reset email');
      }

      setSubmittedEmail(data.email);
      setShowSuccess(true);
      toast.success('Password reset email sent');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send reset email'));
      toast.error('Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent password reset instructions to:
          </p>
          <p className="text-sm font-medium">{submittedEmail}</p>
        </div>

        <Alert>
          <AlertDescription>
            If an account exists with this email, you will receive a password reset link shortly.
            The link will expire in 1 hour.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => setShowSuccess(false)}>
            Try a different email
          </Button>

          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="mr-2 size-4" />
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
        <h2 className="text-2xl font-semibold tracking-tight">Forgot your password?</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {error && <AuthError error={error} />}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>Enter the email associated with your account</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner className="size-4" />
                Sending reset link...
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      </Form>

      <div className="space-y-2">
        <Link href="/reset-password-otp" className="block">
          <Button variant="outline" className="w-full">
            Reset with OTP code instead
          </Button>
        </Link>

        <Link href="/login" className="block">
          <Button variant="ghost" className="w-full">
            <ArrowLeft className="mr-2 size-4" />
            Back to sign in
          </Button>
        </Link>
      </div>
    </div>
  );
}
