-- ============================================================================
-- 04-data-retention.sql
-- Data Retention & Automated Cleanup (DPDP Act Compliance)
--
-- WHAT: Scheduled cleanup of stale data using pg_cron
-- WHY:  DPDP Act requires data minimization — don't retain personal data
--       longer than necessary for the stated purpose.
--
-- RETENTION POLICY:
--   - Audit logs:        365 days (1 year) — required for compliance audits
--   - Abandoned drafts:  90 days  — drafts never completed, likely abandoned
--   - Orphaned clients:  Cleaned after their last certificate is deleted
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. IMPORTANT: pg_cron must be enabled. In Supabase, go to:
--      Database → Extensions → search "pg_cron" → Enable it
--   4. After enabling pg_cron, re-run this file if the cron jobs failed
--
-- NOTE: These jobs run as the database owner (service_role), so they bypass
--       RLS. This is correct — cleanup jobs need to access all rows.
-- ============================================================================

-- ─── 1. Enable pg_cron Extension ─────────────────────────────────────────────
-- (Supabase may require enabling this via Dashboard → Extensions first)

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── 2. Cleanup Function: Purge Old Audit Logs ──────────────────────────────
-- Deletes audit log entries older than 365 days.
-- Audit logs older than 1 year have no compliance value and waste storage.

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as function owner (bypasses RLS)
AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '365 days';
END;
$$;

-- ─── 3. Cleanup Function: Purge Abandoned Draft Certificates ─────────────────
-- Deletes draft certificates (and cascading documents) that haven't been
-- updated in 90 days. If a user hasn't touched a draft in 3 months, it's
-- almost certainly abandoned.
--
-- Also cleans up storage files for those documents.
-- NOTE: Storage cleanup requires a Supabase Edge Function or manual cleanup.
--       This SQL only handles the database rows. See below for storage note.

CREATE OR REPLACE FUNCTION cleanup_abandoned_drafts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  draft_record RECORD;
  doc_paths TEXT[];
BEGIN
  -- Find all abandoned drafts (status = 'draft', not updated in 90 days)
  FOR draft_record IN
    SELECT c.id, c.user_id
    FROM certificates c
    WHERE c.status = 'draft'
      AND c.updated_at < NOW() - INTERVAL '90 days'
  LOOP
    -- Collect storage paths for documents belonging to this certificate
    SELECT ARRAY_AGG(d.file_url)
    INTO doc_paths
    FROM documents d
    WHERE d.certificate_id = draft_record.id;

    -- Log the cleanup action to audit_logs for traceability
    INSERT INTO audit_logs (user_id, action, document_type, document_id, metadata)
    VALUES (
      draft_record.user_id,
      'auto_cleanup',
      'certificate',
      draft_record.id,
      jsonb_build_object(
        'reason', 'abandoned_draft_90_days',
        'storage_paths_to_delete', COALESCE(doc_paths, ARRAY[]::TEXT[])
      )
    );

    -- Delete the certificate (ON DELETE CASCADE handles documents table rows)
    DELETE FROM certificates WHERE id = draft_record.id;
  END LOOP;
END;
$$;

-- ─── 4. Cleanup Function: Remove Orphaned Clients ───────────────────────────
-- Clients with no remaining certificates serve no purpose and should be
-- cleaned up to minimize stored personal data.

CREATE OR REPLACE FUNCTION cleanup_orphaned_clients()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM clients c
  WHERE NOT EXISTS (
    SELECT 1 FROM certificates cert WHERE cert.client_id = c.id
  );
END;
$$;

-- ─── 5. Schedule Cron Jobs ───────────────────────────────────────────────────
-- All jobs run at 3:00 AM UTC daily to minimize impact on users.

-- Remove any existing jobs with the same names (idempotent)
SELECT cron.unschedule('cleanup-audit-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-audit-logs');

SELECT cron.unschedule('cleanup-abandoned-drafts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-abandoned-drafts');

SELECT cron.unschedule('cleanup-orphaned-clients')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphaned-clients');

-- Schedule: every day at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 3 * * *',
  $$SELECT cleanup_old_audit_logs()$$
);

-- Schedule: every day at 3:05 AM UTC (staggered to avoid contention)
SELECT cron.schedule(
  'cleanup-abandoned-drafts',
  '5 3 * * *',
  $$SELECT cleanup_abandoned_drafts()$$
);

-- Schedule: every day at 3:10 AM UTC (runs after draft cleanup)
SELECT cron.schedule(
  'cleanup-orphaned-clients',
  '10 3 * * *',
  $$SELECT cleanup_orphaned_clients()$$
);

-- ─── 6. Manual Storage Cleanup Note ──────────────────────────────────────────
-- The cleanup_abandoned_drafts() function deletes DB rows but cannot directly
-- delete files from Supabase Storage (SQL has no access to the Storage API).
--
-- The storage paths are logged in audit_logs → metadata → storage_paths_to_delete.
--
-- To clean up storage files, you have two options:
--
-- Option A (Recommended): Create a Supabase Edge Function that:
--   1. Queries audit_logs WHERE action = 'auto_cleanup'
--   2. Reads the storage_paths_to_delete from metadata
--   3. Calls supabase.storage.from('networth-documents').remove(paths)
--   4. Marks the audit log entry as processed
--   Schedule it via pg_cron or Supabase Cron.
--
-- Option B (Manual): Periodically review the audit_logs for 'auto_cleanup'
--   entries and manually delete the listed storage files from the dashboard.
--
-- For now, storage files from abandoned drafts are orphaned but harmless
-- (they're in user-scoped folders and can't be accessed without a signed URL).
