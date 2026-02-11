# Vercel Environment Variables Setup

## Required Environment Variables for Web App

Add these environment variables to your Vercel project:

### 1. Resend Email Service

```bash
RESEND_API_KEY=re_Ww4AtorZ_6PttRcQMSqLrhfGxmHiayDbD
EMAIL_FROM=noreply@restomarket.com
```

### 2. Database Configuration

```bash
DATABASE_URL=<your-supabase-pooler-url>
DATABASE_DIRECT_URL=<your-supabase-direct-url>
```

### 3. Better Auth Configuration

```bash
BETTER_AUTH_SECRET=<your-secret-from-.env>
BETTER_AUTH_URL=https://your-domain.vercel.app
```

### 4. OAuth Providers (Optional)

```bash
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
```

### 5. Public URLs

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_API_URL=http://157.245.21.33/v1
```

## How to Add via Vercel CLI

```bash
# Navigate to web app
cd apps/web

# Add environment variables
vercel env add RESEND_API_KEY
# Paste: re_Ww4AtorZ_6PttRcQMSqLrhfGxmHiayDbD

vercel env add EMAIL_FROM
# Paste: noreply@restomarket.com

# Redeploy
vercel --prod
```

## How to Add via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter variable name and value
6. Select environments (Production, Preview, Development)
7. Click **Save**
8. Redeploy your application

## Verify Setup

After adding the variables and redeploying:

1. Test email verification on sign-up
2. Test password reset flow
3. Check Vercel deployment logs for any errors

## Security Notes

- ✅ Never commit `.env` files with real secrets
- ✅ Use different API keys for staging/production if possible
- ✅ Rotate secrets periodically
- ✅ Monitor Resend dashboard for usage/errors
