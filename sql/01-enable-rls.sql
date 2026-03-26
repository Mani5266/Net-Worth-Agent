-- ============================================================================
-- 01-enable-rls.sql
-- Enable Row Level Security on all user-data tables and create policies.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--
-- WHAT THIS DOES:
--   - Enables RLS on: clients, certificates, documents
--   - Creates SELECT/INSERT/UPDATE/DELETE policies so users can only
--     access their own rows (matched by auth.uid() = user_id)
--
-- SAFE TO RE-RUN: Uses "IF NOT EXISTS" and "CREATE OR REPLACE" where possible.
--                  Drops existing policies by name before recreating them.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: clients
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Force RLS even for the table owner (prevents bypassing via service role
-- unless explicitly using the service_role key, which is correct behavior)
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe re-run)
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

-- SELECT: Users can only see their own clients
CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can only create clients linked to themselves
CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own clients
CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own clients
CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: certificates
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own certificates" ON certificates;
DROP POLICY IF EXISTS "Users can insert own certificates" ON certificates;
DROP POLICY IF EXISTS "Users can update own certificates" ON certificates;
DROP POLICY IF EXISTS "Users can delete own certificates" ON certificates;

-- SELECT: Users can only see their own certificates
CREATE POLICY "Users can view own certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can only create certificates linked to themselves
CREATE POLICY "Users can insert own certificates"
  ON certificates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own certificates
CREATE POLICY "Users can update own certificates"
  ON certificates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own certificates
CREATE POLICY "Users can delete own certificates"
  ON certificates FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: documents
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;

-- SELECT: Users can only see their own documents
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can only create documents linked to themselves
CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own documents
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own documents
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERY
-- Run this after applying policies to confirm RLS is active:
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT
--   schemaname,
--   tablename,
--   rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('clients', 'certificates', 'documents');
--
-- Expected: rowsecurity = true for all 3 tables.
