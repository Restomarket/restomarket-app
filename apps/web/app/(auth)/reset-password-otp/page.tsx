'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { emailOtp } from '@/lib/auth/auth.client';
import {
  otpRequestSchema,
  resetPasswordSchema,
  type OtpRequestInput,
  type ResetPasswordInput,
} from '@repo/shared';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Spinner } from '@repo/ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@repo/ui/form';
import { AuthError } from '@repo/ui/auth/auth-error';
import { PasswordStrength } from '@repo/ui/auth/password-strength';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@repo/ui/input-otp';

function ResetPasswordOtpForm() {
  const router = useRouter();

  const [step, setStep] = React.useState<'email' | 'otp' | 'password'>('email');
  const [email, setEmail] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  const emailForm = useForm<OtpRequestInput>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { email: '' },
  });

  const passwordForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = passwordForm.watch('password');

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
        type: 'forget-password',
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to send OTP');
      }

      setEmail(emailAddress);
      setStep('otp');
      setCooldown(60);
      toast.success('Reset code sent to your email');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send reset code'));
      toast.error('Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitEmail = async (data: OtpRequestInput) => {
    await sendOtp(data.email);
  };

  const onSubmitOtp = async () => {
    if (otp.length !== 6) return;
    setError(null);
    setStep('password');
  };

  const onSubmitPassword = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await emailOtp.resetPassword({
        email,
        otp,
        password: data.password,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to reset password');
      }

      toast.success('Password reset successfully!');
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reset password'));
      toast.error('Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    await sendOtp(email);
  };

  // Step 3: New password form
  if (step === 'password') {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Set new password</h2>
          <p className="text-sm text-muted-foreground">Enter your new password below</p>
        </div>

        {error && <AuthError error={error} />}

        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
            <FormField
              control={passwordForm.control}
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
              control={passwordForm.control}
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
                  <Spinner className="size-4" />
                  Resetting password...
                </>
              ) : (
                'Reset password'
              )}
            </Button>
          </form>
        </Form>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            setStep('otp');
            setError(null);
          }}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to code entry
        </Button>
      </div>
    );
  }

  // Step 2: OTP input
  if (step === 'otp') {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Enter reset code</h2>
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

        <Button className="w-full" onClick={onSubmitOtp} disabled={otp.length !== 6}>
          Continue
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

  // Step 1: Email input
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Reset password with OTP</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset code
        </p>
      </div>

      {error && <AuthError error={error} />}

      <Form {...emailForm}>
        <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4">
          <FormField
            control={emailForm.control}
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
              'Send reset code'
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

export default function ResetPasswordOtpPage() {
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
      <ResetPasswordOtpForm />
    </React.Suspense>
  );
}
