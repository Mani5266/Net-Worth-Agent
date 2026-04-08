# Supabase Migration Guide — Net Worth Certificate Agent

Fresh setup for a **dedicated** Supabase project with proper RLS (Row Level Security).

---

## Prerequisites

- A Supabase account at [supabase.com](https://supabase.com)
- Your `.env.local` file ready to update

---

## Step 1: Create a New Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name:** `networth-agent` (or any name you prefer)
   - **Database Password:** set and **save it somewhere safe**
   - **Region:** pick closest to your users (e.g. `South Asia (Mumbai)` for India)
4. Click **"Create new project"**
5. Wait 1-2 minutes for the project to be ready

---

## Step 2: Get Your API Credentials

1. In your new project, go to **Project Settings** (gear icon) → **API**
2. Copy these two values:

| Dashboard Label | .env.local Variable |
|----------------|---------------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

3. Update your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

## Step 3: Run SQL Scripts (in order)

Go to **SQL Editor** in the Supabase Dashboard. Run each file **one at a time, in order**:

### 3a. Create Tables

1. Open `sql/migration/01-tables.sql`
2. Copy the entire file contents
3. Paste into SQL Editor
4. Click **"Run"**
5. You should see: `Success. No rows returned`

**What this creates:**
- `clients` table (applicant info, passport number)
- `certificates` table (drafts, form data as JSONB)
- `documents` table (uploaded file metadata)
- All with `user_id` column referencing `auth.users(id)`
- Proper indexes for performance

### 3b. Enable Row Level Security

1. Open `sql/migration/02-rls-policies.sql`
2. Copy → Paste → Run
3. You should see: `Success. No rows returned`

**What this creates:**
- RLS enabled on all 3 tables
- Each user can only SELECT/INSERT/UPDATE/DELETE their own rows
- Scoped by `auth.uid() = user_id`

### 3c. Create Storage Bucket + Policies

1. Open `sql/migration/03-storage.sql`
2. Copy → Paste → Run
3. You should see: `Success. No rows returned`

**What this creates:**
- `networth-documents` storage bucket (private, 10MB limit)
- Storage RLS policies for authenticated users

---

## Step 4: Verify Setup

Run these verification queries in SQL Editor:

### Check tables exist:
```sql
SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('clients', 'certificates', 'documents');
```
Expected: 3 rows

### Check RLS is enabled:
```sql
SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('clients', 'certificates', 'documents');
```
Expected: all 3 show `rowsecurity = true`

### Check storage bucket:
```sql
SELECT id, name, public, file_size_limit
  FROM storage.buckets
  WHERE id = 'networth-documents';
```
Expected: 1 row, `public = false`, `file_size_limit = 10485760`

### Check policies:
```sql
SELECT tablename, policyname, cmd
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, cmd;
```
Expected: 11 policies (4 for clients + 4 for certificates + 3 for documents)

---

## Step 5: Test the App

1. Start your dev server: `npm run dev`
2. Go to the login page and **sign up a new user** (old users won't exist in the new project)
3. Create a certificate → fill in Purpose + Applicant
4. Navigate to a step with FileUpload (e.g. Annexure I)
5. Upload a test PDF or JPG
6. Check in Supabase Dashboard:
   - **Table Editor → documents**: should have 1 row with your `user_id`
   - **Storage → networth-documents**: should have the file at the expected path

---

## Rollback

If something goes wrong and you want to start fresh:

```sql
-- WARNING: This deletes ALL data
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DELETE FROM storage.buckets WHERE id = 'networth-documents';
```

Then re-run the 3 scripts from Step 3.

---

## Differences from Old Schema

| Item | Old (complete-database-setup.sql) | New (migration/) |
|------|----------------------------------|-------------------|
| `user_id` column | Missing from SQL | Present on all 3 tables, FK to `auth.users` |
| RLS | None | Full RLS on all tables + storage |
| Storage bucket | Manual creation (public) | Created via SQL (private, RLS-controlled) |
| Unique constraint on clients | `UNIQUE(pan_number)` globally | `UNIQUE(user_id, pan_number)` per-user |
| Cascade deletes | Only on certificates → documents | On all FKs including user deletion |

---

## File Reference

```
sql/migration/
  01-tables.sql         ← Tables + indexes + user_id columns
  02-rls-policies.sql   ← Row Level Security policies
  03-storage.sql        ← Storage bucket + storage policies
  README.md             ← This file (you are here)
```
