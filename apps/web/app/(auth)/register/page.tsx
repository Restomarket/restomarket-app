'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';

import { authClient } from '@/lib/auth/auth.client';
import { signUpSchema, type SignUpInput } from '@repo/shared';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { Checkbox } from '@repo/ui/checkbox';
import { Spinner } from '@repo/ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@repo/ui/form';
import { AuthError } from '@repo/ui/auth/auth-error';
import { OAuthButtons } from '@repo/ui/auth/oauth-buttons';
import { Divider } from '@repo/ui/auth/divider';
import { PasswordStrength } from '@repo/ui/auth/password-strength';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      acceptTerms: false,
    },
  });

  const passwordValue = form.watch('password');

  const onSubmit = async (data: SignUpInput) => {
    setIsLoading(true);
    setError(null);

    try {
      // firstName/lastName are additional fields with input: true in shared config.
      // inferAdditionalFields can't resolve them through the factory return type,
      // so we spread them and widen the type.
      const result = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: `${data.firstName} ${data.lastName}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        callbackURL: callbackUrl,
      } as Record<string, unknown> & { email: string; password: string; name: string });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to create account');
      }

      setShowSuccess(true);
      toast.success('Account created! Check your email to verify.');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create account'));
      toast.error('Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: callbackUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign up with Google'));
      toast.error('Failed to sign up with Google');
    }
  };

  const showGoogleOAuth = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (showSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-green-600">Account created!</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a verification email to your inbox. Please check your email and click
            the verification link to activate your account.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => router.push('/login')}>Continue to sign in</Button>
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/verify-otp?email=${encodeURIComponent(form.getValues('email'))}`)
            }
          >
            Verify with OTP code
          </Button>
          <Button variant="ghost" onClick={() => setShowSuccess(false)}>
            Back to registration
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Create an account</h2>
        <p className="text-sm text-muted-foreground">Get started with RestoMarket today</p>
      </div>

      {error && <AuthError error={error} />}

      {showGoogleOAuth && (
        <>
          <OAuthButtons onGoogleSignIn={handleGoogleSignIn} isLoading={isLoading} />

          <Divider text="Or continue with email" />
        </>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="John" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Doe" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
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
            name="acceptTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <Label htmlFor="acceptTerms" className="text-sm font-normal cursor-pointer">
                    I agree to the{' '}
                    <Link href="/terms" className="underline hover:text-foreground" target="_blank">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      className="underline hover:text-foreground"
                      target="_blank"
                    >
                      Privacy Policy
                    </Link>
                  </Label>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner className="size-4" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium underline hover:text-foreground">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
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
      <RegisterForm />
    </React.Suspense>
  );
}
