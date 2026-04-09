-- ============================================================================
-- 06-email-verifications.sql — Net Worth Certificate Agent (Phase 6: Email Verification)
-- ============================================================================
-- Creates the email_verifications table for custom email verification flow.
-- Uses deny-all RLS — ONLY the admin (service role) client can access this table.
--
-- RUN ORDER: 6 of 6 (run AFTER 05-saas-tables.sql)
-- SAFE TO RE-RUN: Uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================================


-- ############################################################################
-- TABLE: email_verifications
-- ############################################################################
-- Stores hashed verification tokens. Raw tokens are NEVER stored.
-- Tokens are single-use: verified via atomic DELETE ... RETURNING.
-- Expired tokens are cleaned up by the verify flow (no background job needed).

CREATE TABLE IF NOT EXISTS email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ############################################################################
-- INDEXES
-- ############################################################################

-- Unique index on token_hash — each hashed token can only exist once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_token_hash
  ON email_verifications(token_hash);

-- Index on user_id — fast cleanup of existing tokens when resending.
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id
  ON email_verifications(user_id);

-- Index on expires_at — supports efficient expired-token filtering.
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at
  ON email_verifications(expires_at);


-- ############################################################################
-- ENABLE RLS
-- ############################################################################

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;


-- ############################################################################
-- POLICY: Deny-all (RESTRICTIVE)
-- ############################################################################
-- No user (anon or authenticated) can read, insert, update, or delete rows.
-- ONLY the service_role (admin client) bypasses RLS and can operate on this table.
-- This is critical: tokens must never be accessible to end users via the API.

DROP POLICY IF EXISTS "Deny all access to email_verifications" ON email_verifications;

CREATE POLICY "Deny all access to email_verifications"
  ON email_verifications
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);


-- ############################################################################
-- VERIFICATION (uncomment to check)
-- ############################################################################

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   AND tablename = 'email_verifications';
