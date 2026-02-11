'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { authClient, emailOtp } from '@/lib/auth/auth.client';
import { otpRequestSchema, type OtpRequestInput } from '@repo/shared';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Spinner } from '@repo/ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@repo/ui/form';
import { AuthError } from '@repo/ui/auth/auth-error';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@repo/ui/input-otp';

function OtpLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';

  const [step, setStep] = React.useState<'email' | 'otp'>('email');
  const [email, setEmail] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  const form = useForm<OtpRequestInput>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { email: '' },
  });

  // Cooldown timer
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendOtp = async (emailAddress: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await emailOtp.sendVerificationOtp({
        email: emailAddress,
        type: 'sign-in',
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to send OTP');
      }

      setEmail(emailAddress);
      setStep('otp');
      setCooldown(60);
      toast.success('OTP sent to your email');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send OTP'));
      toast.error('Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitEmail = async (data: OtpRequestInput) => {
    await sendOtp(data.email);
  };

  const onSubmitOtp = async () => {
    if (otp.length !== 6) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Invalid OTP');
      }

      toast.success('Welcome back!');
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Invalid OTP'));
      toast.error('Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    await sendOtp(email);
  };

  if (step === 'otp') {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Enter verification code</h2>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="font-medium">{email}</span>
          </p>
        </div>

        {error && <AuthError error={error} />}

        <div className="flex justify-center">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button className="w-full" onClick={onSubmitOtp} disabled={isLoading || otp.length !== 6}>
          {isLoading ? (
            <>
              <Spinner className="size-4" />
              Verifying...
            </>
          ) : (
            'Sign in'
          )}
        </Button>

        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleResend}
            disabled={cooldown > 0 || isLoading}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep('email');
              setOtp('');
              setError(null);
            }}
          >
            <ArrowLeft className="mr-2 size-4" />
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in with OTP</h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll send a one-time code to your email
        </p>
      </div>

      {error && <AuthError error={error} />}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitEmail)} className="space-y-4">
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

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner className="size-4" />
                Sending code...
              </>
            ) : (
              'Send code'
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Prefer using a password?{' '}
        <Link href="/login" className="font-medium underline hover:text-foreground">
          Sign in with password
        </Link>
      </p>
    </div>
  );
}

export default function OtpLoginPage() {
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
      <OtpLoginForm />
    </React.Suspense>
  );
}
