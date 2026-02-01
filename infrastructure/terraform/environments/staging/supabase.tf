# ============================================================================
# Supabase Database Configuration
# ============================================================================
#
# Supabase is managed manually via https://app.supabase.com
# Terraform provider not available (as of 2026-02)
#
# Project Configuration:
# - Plan: Free tier (500MB database, 1GB file storage, 2GB bandwidth)
# - Region: Frankfurt (fra1) or closest to DigitalOcean region
# - Connection pooling: Enabled (Supavisor, transaction mode, 25 connections)
# - Row-Level Security: Disabled (using custom NestJS auth)
#
# Connection Strings (stored in GitHub Secrets):
# - STAGING_DATABASE_URL:
#   postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
#   (Pooler connection for application runtime)
#
# - STAGING_DATABASE_DIRECT_URL:
#   postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
#   (Direct connection for migrations)
#
# Cost Comparison:
# - Previous (DigitalOcean): $120/month (2-node HA cluster)
# - Current (Supabase Free): $0/month
# - Savings: $120/month ($1,440/year)
#
# Backup Strategy:
# - Supabase Free: No point-in-time recovery
# - Manual backups: Use pg_dump via DATABASE_DIRECT_URL
# - Backup schedule: Weekly via cron job on droplet
#
# Migration Strategy:
# - Migrations run automatically in CI/CD via Drizzle ORM
# - Pre-deployment step ensures schema is up-to-date
# - No manual SQL needed - all changes via code
#
# Future Enhancements:
# - Upgrade to Pro plan ($25/month) for 7-day point-in-time recovery
# - Enable Supabase Realtime for WebSocket subscriptions
# - Consider Supabase Auth for OAuth integrations
# - Implement automated backup script
#
