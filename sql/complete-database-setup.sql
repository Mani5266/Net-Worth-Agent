-- ============================================================================
-- COMPLETE DATABASE SETUP — Net Worth Certificate Agent
-- ============================================================================
-- This single file contains ALL SQL queries needed to set up the entire
-- database for the Net Worth Agent project.
--
-- NO AUTHENTICATION — This setup has no user scoping, no RLS policies,
-- and no audit logging. All data is accessible without login.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--
-- SAFE TO RE-RUN: Uses IF NOT EXISTS throughout.
-- ============================================================================


-- ############################################################################
-- SECTION 1: CREATE TABLES
-- ############################################################################

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: clients
-- Stores client/applicant information (one per passport number)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  salutation TEXT NOT NULL,
  pan_number TEXT NOT NULL,  -- Actually stores Passport Number (legacy column name)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pan_number)
);

CREATE INDEX IF NOT EXISTS idx_clients_pan_number ON clients(pan_number);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: certificates
-- Stores net worth certificate drafts and completed certificates
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  country TEXT,
  cert_date DATE,
  udin TEXT,
  nickname TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  form_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_client_id ON certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: documents
-- Stores metadata for uploaded supporting documents (files in Storage)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  annexure_type TEXT NOT NULL,
  category TEXT NOT NULL,
  file_url TEXT NOT NULL,       -- Storage path: {cert_id}/{annexure}/{category}/{filename}
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_certificate_id ON documents(certificate_id);


-- ############################################################################
-- SECTION 2: STORAGE BUCKET
-- ############################################################################
-- NOTE: Buckets cannot be created via SQL. Create the bucket manually:
--   Dashboard → Storage → New Bucket
--     - Name: networth-documents
--     - Public: ON (no auth, so public access needed)
--     - File size limit: 10MB
--     - Allowed MIME types: application/pdf, image/jpeg, image/jpg, image/png


-- ############################################################################
-- VERIFICATION QUERIES (uncomment and run to verify setup)
-- ############################################################################

-- Check all tables exist:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   AND tablename IN ('clients', 'certificates', 'documents');

-- Check table columns:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('clients', 'certificates', 'documents')
-- ORDER BY table_name, ordinal_position;
