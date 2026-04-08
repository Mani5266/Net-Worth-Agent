-- ============================================================================
-- 02-rls-policies.sql — Net Worth Certificate Agent
-- ============================================================================
-- Enables Row Level Security on all tables and creates per-user policies.
-- Each user can only see/edit their OWN data.
--
-- RUN ORDER: 2 of 3 (run AFTER 01-tables.sql)
-- SAFE TO RE-RUN: Uses DROP POLICY IF EXISTS before CREATE.
-- ============================================================================


-- ############################################################################
-- ENABLE RLS
-- ############################################################################

ALTER TABLE clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents    ENABLE ROW LEVEL SECURITY;


-- ############################################################################
-- POLICIES: clients
-- ############################################################################

DROP POLICY IF EXISTS "Users can view own clients"   ON clients;
DROP POLICY IF EXISTS "Users can insert own clients"  ON clients;
DROP POLICY IF EXISTS "Users can update own clients"  ON clients;
DROP POLICY IF EXISTS "Users can delete own clients"  ON clients;

CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  USING (auth.uid() = user_id);


-- ############################################################################
-- POLICIES: certificates
-- ############################################################################

DROP POLICY IF EXISTS "Users can view own certificates"   ON certificates;
DROP POLICY IF EXISTS "Users can insert own certificates"  ON certificates;
DROP POLICY IF EXISTS "Users can update own certificates"  ON certificates;
DROP POLICY IF EXISTS "Users can delete own certificates"  ON certificates;

CREATE POLICY "Users can view own certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certificates"
  ON certificates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own certificates"
  ON certificates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own certificates"
  ON certificates FOR DELETE
  USING (auth.uid() = user_id);


-- ############################################################################
-- POLICIES: documents
-- ############################################################################

DROP POLICY IF EXISTS "Users can view own documents"   ON documents;
DROP POLICY IF EXISTS "Users can insert own documents"  ON documents;
DROP POLICY IF EXISTS "Users can delete own documents"  ON documents;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy for documents — they are immutable (upload once, delete to replace)

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);


-- ############################################################################
-- VERIFICATION (uncomment to check)
-- ############################################################################

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   AND tablename IN ('clients', 'certificates', 'documents');
