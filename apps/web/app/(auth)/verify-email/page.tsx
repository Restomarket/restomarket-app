'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { CheckCircle2, XCircle, Mail } from 'lucide-react';

import { authClient } from '@/lib/auth/auth.client';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { Spinner } from '@repo/ui/spinner';
import { Alert, AlertDescription } from '@repo/ui/alert';

type VerificationState = 'verifying' | 'success' | 'error';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  const [state, setState] = React.useState<VerificationState>('verifying');
  const [error, setError] = React.useState<string>('');
  const [countdown, setCountdown] = React.useState(5);
  const [isResending, setIsResending] = React.useState(false);
  const [resendEmail, setResendEmail] = React.useState('');

  // Verify email on mount
  React.useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setState('error');
        setError('Invalid or missing verification token');
        return;
      }

      try {
        const result = await authClient.verifyEmail({
          query: { token },
        });

        if (result.error) {
          throw new Error(result.error.message || 'Verification failed');
        }

        setState('success');
        toast.success('Email verified successfully!');
      } catch (err) {
        setState('error');
        const errorMessage = err instanceof Error ? err.message : 'Failed to verify email';
        setError(errorMessage);
        toast.error('Verification failed');
      }
    };

    verifyToken();
  }, [token]);

  // Auto-redirect countdown on success
  React.useEffect(() => {
    if (state === 'success' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }

    if (state === 'success' && countdown === 0) {
      router.push('/login');
    }
  }, [state, countdown, router]);

  const handleResendEmail = async () => {
    if (!resendEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setIsResending(true);

    try {
      const result = await authClient.sendVerificationEmail({
        email: resendEmail.trim(),
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to resend email');
      }

      toast.success('Verification email sent! Check your inbox.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend email';
      toast.error(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  if (state === 'verifying') {
    return (
      <div className="space-y-6 text-center">
        <Spinner className="mx-auto size-8" />
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Verifying your email</h2>
          <p className="text-sm text-muted-foreground">
            Please wait while we verify your email address...
          </p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 className="mx-auto size-16 text-green-600" />

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-green-600">Email verified!</h2>
          <p className="text-sm text-muted-foreground">
            Your email has been successfully verified. You can now sign in to your account.
          </p>
        </div>

        <Alert>
          <AlertDescription>Redirecting to sign in page in {countdown} seconds...</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Link href="/login" className="block">
            <Button className="w-full">Sign in now</Button>
          </Link>

          <Link href="/" className="block">
            <Button variant="outline" className="w-full">
              Go to home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="space-y-6 text-center">
      <XCircle className="mx-auto size-16 text-destructive" />

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-destructive">
          Verification failed
        </h2>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>

      <Alert variant="destructive">
        <AlertDescription>
          This verification link may have expired or is invalid. Verification links expire after 24
          hours.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2 text-left">
          <Label htmlFor="resend-email">Email address</Label>
          <Input
            id="resend-email"
            type="email"
            placeholder="you@example.com"
            value={resendEmail}
            onChange={e => setResendEmail(e.target.value)}
            disabled={isResending}
          />
        </div>

        <Button
          className="w-full"
          onClick={handleResendEmail}
          disabled={isResending || !resendEmail.trim()}
        >
          {isResending ? (
            <>
              <Spinner />
              Resending...
            </>
          ) : (
            <>
              <Mail className="mr-2 size-4" />
              Resend verification email
            </>
          )}
        </Button>

        <Link href="/login" className="block">
          <Button variant="outline" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 text-center">
          <Spinner className="mx-auto size-8" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </React.Suspense>
  );
}
