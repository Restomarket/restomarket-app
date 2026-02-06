# 🚀 Database Migration - Ready to Run!

## ✅ What's Configured

Your Supabase database setup is complete with:

- **Database:** `postgres.hpxpildvywmgzzlbxzkj` (EU Central 1)
- **Pooled URL:** Port 6543 (for app runtime)
- **Direct URL:** Port 5432 (for migrations)
- **Better Auth Secret:** Generated and set

## 🔐 STEP 1: Add Your Password

Open `.env` in the project root and replace `[YOUR-PASSWORD]` with your actual Supabase database password:

```bash
# Find your password in:
# Supabase Dashboard → Project Settings → Database → Database password

# Update BOTH lines:
DATABASE_URL="postgresql://postgres.hpxpildvywmgzzlbxzkj:YOUR_ACTUAL_PASSWORD@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"
DATABASE_DIRECT_URL="postgresql://postgres.hpxpildvywmgzzlbxzkj:YOUR_ACTUAL_PASSWORD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
```

## 🧪 STEP 2: Test Connection

```bash
./scripts/test-db-connection.sh
```

Expected output:

```
✅ Connection successful!
Database: postgres
User: postgres
PostgreSQL version: PostgreSQL 15.x
```

## 🗄️ STEP 3: Run Migrations

```bash
./scripts/run-migrations.sh
```

This will:

1. ✅ Verify environment variables
2. ✅ Build shared package
3. ✅ Show 4 pending migrations
4. ✅ Ask for confirmation
5. ✅ Apply all migrations
6. ✅ Create 10 database tables

## 📊 Expected Tables

After migration, you'll have:

**Auth Tables:**

- `user` - Better Auth users + business fields
- `account` - OAuth providers
- `session` - User sessions
- `verification` - Email verification

**Organization Tables:**

- `organization` - Companies/orgs
- `member` - Memberships
- `invitation` - Pending invites
- `team` - Teams
- `team_member` - Team memberships
- `organization_role` - Custom RBAC roles

## 🎨 STEP 4: View Your Database

```bash
cd packages/shared
pnpm db:studio
```

Open http://localhost:4983 to browse your database.

## ❓ Troubleshooting

### "Connection failed"

- Check password is correct in .env
- Verify Supabase project is active (not paused)
- Check you're on the right network (VPN might block)

### "relation already exists"

- Tables were already created
- Run in Drizzle Studio: `SELECT * FROM __drizzle_migrations__;`
- If needed, drop all tables and re-run

### "prepared statement already exists"

- Make sure using direct connection (port 5432)
- Check DATABASE_DIRECT_URL is set correctly

## 📚 Documentation

- **Quick Start:** `docs/MIGRATION_QUICKSTART.md`
- **Full Guide:** `docs/DATABASE_MIGRATION_GUIDE.md`
- **Better Auth Fixes:** `docs/BETTER_AUTH_FIXES_APPLIED.md`

---

**You're all set! Just add your password and run the scripts.** 🎉
