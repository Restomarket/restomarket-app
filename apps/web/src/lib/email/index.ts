/**
 * Email Module
 *
 * Centralized email handling for the application.
 * Uses Resend for production email delivery.
 */

export {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendVerificationOTP,
  sendInvitationEmail,
} from './resend-provider';
