-- ============================================================================
-- 05-saas-tables.sql — Net Worth Certificate Agent (Phase 5: SaaS Readiness)
-- ============================================================================
-- Creates tables for usage tracking, audit logging, and certificate versioning.
--
-- RUN ORDER: 5 of 5 (run AFTER 04-fix-storage-rls.sql)
-- SAFE TO RE-RUN: Uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================================


-- ############################################################################
-- TABLE: usage_logs
-- ############################################################################
-- Tracks per-user feature usage (ai_intake, ocr, stt calls).
-- Used for cost monitoring and future billing/quota enforcement.

CREATE TABLE IF NOT EXISTS usage_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,          -- 'ai_intake' | 'ocr' | 'stt'
  units       INTEGER NOT NULL DEFAULT 1,
  metadata    JSONB DEFAULT '{}',     -- feature-specific context (messageCount, documentType, etc.)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id    ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_feature    ON usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);


-- ############################################################################
-- TABLE: audit_logs
-- ############################################################################
-- Captures before/after snapshots for certificate mutations.
-- Actions: create, update, rename, delete.

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,          -- 'create' | 'update' | 'rename' | 'delete'
  entity      TEXT NOT NULL,          -- 'certificate' (extensible to 'document' etc.)
  entity_id   UUID NOT NULL,          -- the certificate ID (or other entity ID)
  before_data JSONB,                  -- snapshot before the mutation (NULL for create)
  after_data  JSONB,                  -- snapshot after the mutation (NULL for delete)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id  ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);


-- ############################################################################
-- TABLE: certificate_versions
-- ############################################################################
-- Stores form_data snapshots before each update/rename.
-- Enables "undo" and version history for certificates.

CREATE TABLE IF NOT EXISTS certificate_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id  UUID NOT NULL,      -- no FK — certificate may be deleted, versions survive
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot        JSONB NOT NULL,      -- full form_data at the time of the snapshot
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_versions_cert_id    ON certificate_versions(certificate_id);
CREATE INDEX IF NOT EXISTS idx_cert_versions_user_id    ON certificate_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_versions_created_at ON certificate_versions(created_at);


-- ############################################################################
-- ENABLE RLS
-- ############################################################################

ALTER TABLE usage_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_versions  ENABLE ROW LEVEL SECURITY;


-- ############################################################################
-- POLICIES: usage_logs
-- ############################################################################
-- Users can INSERT their own usage rows (fire-and-forget from API routes).
-- Users can SELECT their own usage (for future dashboard).
-- No UPDATE/DELETE — usage logs are immutable.

DROP POLICY IF EXISTS "Users can insert own usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Users can view own usage logs"   ON usage_logs;

CREATE POLICY "Users can insert own usage logs"
  ON usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own usage logs"
  ON usage_logs FOR SELECT
  USING (auth.uid() = user_id);


-- ############################################################################
-- POLICIES: audit_logs
-- ############################################################################
-- Users can INSERT their own audit rows.
-- Users can SELECT their own audit history.
-- No UPDATE/DELETE — audit logs are immutable.

DROP POLICY IF EXISTS "Users can insert own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view own audit logs"   ON audit_logs;

CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);


-- ############################################################################
-- POLICIES: certificate_versions
-- ############################################################################
-- Users can INSERT their own version snapshots.
-- Users can SELECT their own version history.
-- No UPDATE/DELETE — versions are immutable.

DROP POLICY IF EXISTS "Users can insert own certificate versions" ON certificate_versions;
DROP POLICY IF EXISTS "Users can view own certificate versions"   ON certificate_versions;

CREATE POLICY "Users can insert own certificate versions"
  ON certificate_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own certificate versions"
  ON certificate_versions FOR SELECT
  USING (auth.uid() = user_id);


-- ############################################################################
-- VERIFICATION (uncomment to check)
-- ############################################################################

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   AND tablename IN ('usage_logs', 'audit_logs', 'certificate_versions');
