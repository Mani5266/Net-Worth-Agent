-- ============================================================================
-- 03-audit-logs.sql
-- Create an audit_logs table for tracking sensitive actions.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--
-- WHAT THIS DOES:
--   - Creates the audit_logs table
--   - Enables RLS so users can only READ their own logs
--   - No INSERT policy for authenticated users — only service_role can write
--     (the logAction utility uses SUPABASE_SERVICE_ROLE_KEY)
--   - Creates an index on user_id + created_at for fast lookups
--
-- SAFE TO RE-RUN: Uses IF NOT EXISTS.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: audit_logs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  document_type TEXT,
  document_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast user-scoped queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON audit_logs (user_id, created_at DESC);

-- Create index for action-type filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

-- SELECT: Users can only read their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- Only the service_role key (used by logAction server utility) can write.
-- This prevents users from tampering with their own audit trail.


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- Run after applying to confirm the table and policies exist:
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'audit_logs';
--
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'audit_logs';
