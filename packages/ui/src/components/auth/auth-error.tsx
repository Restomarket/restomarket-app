import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

interface AuthErrorProps {
  error: Error | null;
}

const errorMessages: Record<string, string> = {
  // Better Auth error codes
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'No account found with this email',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists',
  INVALID_TOKEN: 'Invalid or expired token. Please try again',
  TOKEN_EXPIRED: 'This link has expired. Please request a new one',
  VERIFICATION_REQUIRED: 'Please verify your email before signing in',
  TOO_MANY_REQUESTS: 'Too many attempts. Please try again later',
  WEAK_PASSWORD: 'Password does not meet security requirements',

  // Generic errors
  NETWORK_ERROR: 'Network error. Please check your connection',
  SERVER_ERROR: 'Something went wrong. Please try again later',
};

function getErrorMessage(error: Error): string {
  // Check if error message matches a known error code
  const errorCode = error.message.toUpperCase().replace(/\s+/g, '_');
  const knownMessage = errorMessages[errorCode];
  if (knownMessage) {
    return knownMessage;
  }

  // Check if the error message contains known keywords
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection';
  }
  if (message.includes('credentials') || message.includes('password')) {
    return 'Invalid email or password';
  }
  if (message.includes('email') && message.includes('exists')) {
    return 'An account with this email already exists';
  }
  if (message.includes('token') && message.includes('expired')) {
    return 'This link has expired. Please request a new one';
  }
  if (message.includes('token') && message.includes('invalid')) {
    return 'Invalid or expired token. Please try again';
  }

  // Return the original error message if no match found
  return error.message || 'Something went wrong. Please try again later';
}

function AuthError({ error }: AuthErrorProps) {
  if (!error) return null;

  const errorMessage = getErrorMessage(error);

  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  );
}

export { AuthError };
