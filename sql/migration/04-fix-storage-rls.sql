-- ============================================================================
-- 04-fix-storage-rls.sql — Net Worth Certificate Agent
-- ============================================================================
-- SECURITY FIX: Replaces permissive storage RLS policies with owner-scoped ones.
--
-- PROBLEM: The original policies allowed any authenticated user to read/delete
-- any other user's files in the networth-documents bucket.
--
-- FIX: SELECT and DELETE now require owner_id = auth.uid() with NULL safety.
-- Supabase automatically sets owner_id to the uploading user's ID on INSERT.
--
-- RUN ORDER: 4 (run AFTER 03-storage.sql, or standalone on existing DB)
-- SAFE TO RE-RUN: Uses DROP POLICY IF EXISTS before CREATE.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste and execute.
-- ============================================================================


-- ############################################################################
-- STEP 1: DROP old permissive policies by exact name
-- ############################################################################
-- IMPORTANT: Must match the exact policy names from 03-storage.sql.
-- If names don't match, old policies remain and security is an illusion.

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;


-- ############################################################################
-- STEP 2: CREATE new owner-scoped policies
-- ############################################################################

-- INSERT: Any authenticated user can upload (owner_id auto-set by Supabase)
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'networth-documents');

-- SELECT: Only the file owner can read their files
-- NULL safety: prevents exposure from malformed rows where owner_id is NULL
CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'networth-documents'
    AND owner_id IS NOT NULL
    AND owner_id = auth.uid()::text
  );

-- DELETE: Only the file owner can delete their files
CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'networth-documents'
    AND owner_id IS NOT NULL
    AND owner_id = auth.uid()::text
  );


-- ############################################################################
-- VERIFICATION (uncomment to check)
-- ############################################################################

-- SELECT policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname LIKE '%documents%';
