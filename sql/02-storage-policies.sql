-- ============================================================================
-- 02-storage-policies.sql
-- Secure the 'networth-documents' storage bucket with RLS policies.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--
-- PRE-REQUISITE:
--   The bucket 'networth-documents' must already exist.
--   If not, create it in Dashboard → Storage → New Bucket:
--     - Name: networth-documents
--     - Public: OFF (private)
--     - File size limit: 10MB
--     - Allowed MIME types: application/pdf, image/jpeg, image/jpg, image/png
--
-- FILE PATH CONVENTION (enforced by these policies):
--   All files MUST be stored under: {user_id}/{certificateId}/...
--   e.g. "a1b2c3d4-xxxx/.../file.pdf"
--   The first folder segment is the user's auth.uid().
--
-- SAFE TO RE-RUN: Drops existing policies before recreating.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure the bucket is PRIVATE (not public)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE storage.buckets
SET public = false
WHERE id = 'networth-documents';


-- ─────────────────────────────────────────────────────────────────────────────
-- Drop existing policies (safe re-run)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;


-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT: Users can only upload to their own folder
-- Path must start with their user ID: {auth.uid()}/...
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'networth-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT: Users can only read/download their own files
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'networth-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE: Users can only update metadata of their own files
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'networth-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'networth-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- DELETE: Users can only delete their own files
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'networth-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- Run after applying to confirm policies are in place:
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'objects' AND schemaname = 'storage';
