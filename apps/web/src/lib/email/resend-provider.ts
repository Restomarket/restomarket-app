import { Resend } from 'resend';

/**
 * Resend Email Provider for Better Auth
 *
 * This module provides production-ready email delivery using Resend.
 * Handles all Better Auth email flows: verification, password reset, and invitations.
 *
 * @see https://resend.com/docs
 * @see https://better-auth.com/docs/concepts/email
 */

// Lazy initialize Resend client (only when needed, not at module load time)
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  if (!resend) {
    // Return a mock for build time
    return new Resend('re_mock_key_for_build');
  }
  return resend;
}

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@restomarket.com';
const APP_NAME = 'RestoMarket';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Email template configuration
 */
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using Resend
 * Falls back to console.log in development if API key is not set
 */
async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<void> {
  // Development mode: log to console if no API key
  if (!process.env.RESEND_API_KEY) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 [Email] Would send email in production:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', text || html);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }

  // Production mode: send via Resend
  try {
    await getResend().emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    console.log(`✅ [Email] Sent to ${to}: ${subject}`);
  } catch (error) {
    console.error('❌ [Email] Failed to send:', error);
    throw error;
  }
}

/**
 * Generate email verification template
 */
function getVerificationEmailTemplate(
  url: string,
  userName: string,
): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 24px;">Hi ${userName},</p>
              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 24px;">
                Thanks for signing up! Please verify your email address by clicking the button below:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${url}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Verify Email</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; color: #718096; font-size: 14px; line-height: 20px;">
                Or copy and paste this link into your browser:<br>
                <a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a>
              </p>
              <p style="margin: 30px 0 0; color: #a0aec0; font-size: 14px; line-height: 20px;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f7fafc; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Hi ${userName},\n\nThanks for signing up for ${APP_NAME}!\n\nPlease verify your email address by clicking this link:\n${url}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, you can safely ignore this email.\n\n© ${new Date().getFullYear()} ${APP_NAME}`;

  return { html, text };
}

/**
 * Generate password reset email template
 */
function getPasswordResetTemplate(url: string, userName: string): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">${APP_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 24px;">Hi ${userName},</p>
              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 24px;">
                We received a request to reset your password. Click the button below to choose a new password:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${url}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; color: #718096; font-size: 14px; line-height: 20px;">
                Or copy and paste this link into your browser:<br>
                <a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a>
              </p>
              <p style="margin: 30px 0 0; color: #a0aec0; font-size: 14px; line-height: 20px;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f7fafc; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Hi ${userName},\n\nWe received a request to reset your password for ${APP_NAME}.\n\nReset your password by clicking this link:\n${url}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email.\n\n© ${new Date().getFullYear()} ${APP_NAME}`;

  return { html, text };
}

/**
 * Generate organization invitation email template
 */
function getInvitationTemplate(
  inviteLink: string,
  inviterName: string,
  organizationName: string,
): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">${APP_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 24px;">Hi there,</p>
              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 24px;">
                <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on ${APP_NAME}.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; color: #718096; font-size: 14px; line-height: 20px;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
              </p>
              <p style="margin: 30px 0 0; color: #a0aec0; font-size: 14px; line-height: 20px;">
                This invitation will expire in 48 hours. If you don't want to join this organization, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f7fafc; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Hi,\n\n${inviterName} has invited you to join ${organizationName} on ${APP_NAME}.\n\nAccept the invitation by clicking this link:\n${inviteLink}\n\nThis invitation will expire in 48 hours.\n\nIf you don't want to join, you can safely ignore this email.\n\n© ${new Date().getFullYear()} ${APP_NAME}`;

  return { html, text };
}

// ============================================
// Export Email Handlers for Better Auth
// ============================================

/**
 * Send email verification email
 * Used by Better Auth emailVerification plugin
 */
export async function sendVerificationEmail({
  user,
  url,
}: {
  user: { email: string; name: string };
  url: string;
}): Promise<void> {
  const { html, text } = getVerificationEmailTemplate(url, user.name);

  await sendEmail({
    to: user.email,
    subject: `Verify your ${APP_NAME} email`,
    html,
    text,
  });
}

/**
 * Send password reset email
 * Used by Better Auth emailAndPassword plugin
 */
export async function sendPasswordResetEmail({
  user,
  url,
}: {
  user: { email: string; name: string };
  url: string;
}): Promise<void> {
  const { html, text } = getPasswordResetTemplate(url, user.name);

  await sendEmail({
    to: user.email,
    subject: `Reset your ${APP_NAME} password`,
    html,
    text,
  });
}

/**
 * Send organization invitation email
 * Used by Better Auth organization plugin
 */
export async function sendInvitationEmail(data: {
  id: string;
  email: string;
  organizationId: string;
  organizationName: string;
  inviterId: string;
  inviterName: string;
}): Promise<void> {
  const inviteLink = `${APP_URL}/invite/${data.id}`;
  const { html, text } = getInvitationTemplate(inviteLink, data.inviterName, data.organizationName);

  await sendEmail({
    to: data.email,
    subject: `You've been invited to join ${data.organizationName}`,
    html,
    text,
  });
}
