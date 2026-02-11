'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { emailOtp } from '@/lib/auth/auth.client';
import { otpRequestSchema, type OtpRequestInput } from '@repo/shared';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Spinner } from '@repo/ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@repo/ui/form';
import { AuthError } from '@repo/ui/auth/auth-error';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@repo/ui/input-otp';

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams?.get('email') || '';

  const [step, setStep] = React.useState<'email' | 'otp'>(emailParam ? 'otp' : 'email');
  const [email, setEmail] = React.useState(emailParam);
  const [otp, setOtp] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const [verified, setVerified] = React.useState(false);
  const [redirectCountdown, setRedirectCountdown] = React.useState(5);

  const form = useForm<OtpRequestInput>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { email: '' },
  });

  // Auto-send OTP when email param is present
  const hasSentRef = React.useRef(false);
  React.useEffect(() => {
    if (emailParam && !hasSentRef.current) {
      hasSentRef.current = true;
      sendOtp(emailParam);
    }
  }, [emailParam]);

  // Cooldown timer
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Redirect countdown after verification
  React.useEffect(() => {
    if (!verified) return;
    if (redirectCountdown <= 0) {
      router.push('/login');
      return;
    }
    const timer = setTimeout(() => setRedirectCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [verified, redirectCountdown, router]);

  const sendOtp = async (emailAddress: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await emailOtp.sendVerificationOtp({
        email: emailAddress,
        type: 'email-verification',
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to send OTP');
      }

      setEmail(emailAddress);
      setStep('otp');
      setCooldown(60);
      toast.success('Verification code sent to your email');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send verification code'));
      toast.error('Failed to send verification code');
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
      const result = await emailOtp.verifyEmail({
        email,
        otp,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Invalid verification code');
      }

      setVerified(true);
      toast.success('Email verified successfully!');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Invalid verification code'));
      toast.error('Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    await sendOtp(email);
  };

  if (verified) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-green-600">Email verified!</h2>
          <p className="text-sm text-muted-foreground">
            Your email has been verified successfully. Redirecting to sign in in {redirectCountdown}
            s...
          </p>
        </div>

        <Button className="w-full" onClick={() => router.push('/login')}>
          Continue to sign in
        </Button>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Verify your email</h2>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium">{email}</span>
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
            'Verify email'
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
        <h2 className="text-2xl font-semibold tracking-tight">Verify your email</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email to receive a verification code
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
              'Send verification code'
            )}
          </Button>
        </form>
      </Form>

      <Link href="/login" className="block">
        <Button variant="ghost" className="w-full">
          <ArrowLeft className="mr-2 size-4" />
          Back to sign in
        </Button>
      </Link>
    </div>
  );
}

export default function VerifyOtpPage() {
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
      <VerifyOtpForm />
    </React.Suspense>
  );
}
