-- ============================================================================
-- 01-tables.sql — Net Worth Certificate Agent
-- ============================================================================
-- Creates all database tables with proper user_id columns and foreign keys.
--
-- RUN ORDER: 1 of 3 (run this FIRST)
-- SAFE TO RE-RUN: Uses IF NOT EXISTS / DROP ... IF EXISTS throughout.
-- ============================================================================


-- ############################################################################
-- TABLE 1: clients
-- Stores client/applicant information (one per passport number per user)
-- ############################################################################

CREATE TABLE IF NOT EXISTS clients (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL,
  salutation  TEXT        NOT NULL,
  pan_number  TEXT        NOT NULL,  -- Actually stores Passport Number (legacy column name)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  -- Same user cannot have duplicate passport numbers, but different users can
  UNIQUE(user_id, pan_number)
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id    ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_pan_number ON clients(pan_number);


-- ############################################################################
-- TABLE 2: certificates
-- Stores net worth certificate drafts and completed certificates
-- ############################################################################

CREATE TABLE IF NOT EXISTS certificates (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose     TEXT        NOT NULL,
  country     TEXT,
  cert_date   DATE,
  udin        TEXT,
  nickname    TEXT,
  status      TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  form_data   JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_client_id ON certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id   ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status    ON certificates(status);


-- ############################################################################
-- TABLE 3: documents
-- Stores metadata for uploaded supporting documents (files live in Storage)
-- ############################################################################

CREATE TABLE IF NOT EXISTS documents (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id  UUID        NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annexure_type   TEXT        NOT NULL,
  category        TEXT        NOT NULL,
  file_url        TEXT        NOT NULL,   -- Storage path: {cert_id}/{annexure}/{category}/{filename}
  file_name       TEXT        NOT NULL,
  file_type       TEXT        NOT NULL,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_certificate_id ON documents(certificate_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id        ON documents(user_id);


-- ############################################################################
-- VERIFICATION (uncomment to check)
-- ############################################################################

-- SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public'
--   AND tablename IN ('clients', 'certificates', 'documents');

-- SELECT table_name, column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--   AND table_name IN ('clients', 'certificates', 'documents')
--   ORDER BY table_name, ordinal_position;
