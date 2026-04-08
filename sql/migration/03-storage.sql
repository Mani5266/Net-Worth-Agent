  -- ============================================================================
  -- 03-storage.sql — Net Worth Certificate Agent
  -- ============================================================================
  -- Creates the storage bucket and RLS policies for file uploads.
  --
  -- RUN ORDER: 3 of 3 (run AFTER 02-rls-policies.sql)
  -- SAFE TO RE-RUN: Uses IF NOT EXISTS / DROP POLICY IF EXISTS.
  --
  -- IMPORTANT: After running this SQL, you MUST also configure the bucket
  -- settings in the Supabase Dashboard (see README.md for details).
  -- ============================================================================


  -- ############################################################################
  -- CREATE BUCKET
  -- ############################################################################
  -- This creates the bucket via SQL. If it already exists, it silently skips.

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'networth-documents',
    'networth-documents',
    false,                -- Private bucket (access controlled via RLS policies below)
    10485760,             -- 10 MB in bytes
    ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
  )
  ON CONFLICT (id) DO NOTHING;


  -- ############################################################################
  -- STORAGE RLS POLICIES
  -- ############################################################################
  -- File path pattern: {userId}/{certificateId}/{annexureType}/{category}/{timestamp}-{fileName}
  --
  -- Strategy: owner_id-based isolation. Supabase automatically sets owner_id
  -- to auth.uid() on upload. SELECT and DELETE check owner_id = auth.uid()
  -- with NULL safety to prevent exposure from malformed rows.
  -- ############################################################################

  -- Allow authenticated users to upload files (owner_id auto-set by Supabase)
  DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
  CREATE POLICY "Authenticated users can upload documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'networth-documents');

  -- Only file owner can read their files
  DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
  CREATE POLICY "Authenticated users can read documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'networth-documents'
      AND owner_id IS NOT NULL
      AND owner_id = auth.uid()::text
    );

  -- Only file owner can delete their files
  DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
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

  -- SELECT id, name, public, file_size_limit, allowed_mime_types
  --   FROM storage.buckets
  --   WHERE id = 'networth-documents';

  -- SELECT policyname, permissive, roles, cmd
  --   FROM pg_policies
  --   WHERE schemaname = 'storage' AND tablename = 'objects';
