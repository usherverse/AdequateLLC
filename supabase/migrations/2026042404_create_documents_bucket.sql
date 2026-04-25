-- Create the documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for the documents bucket
-- 1. Allow Authenticated users to view documents
DROP POLICY IF EXISTS "Allow Authenticated View" ON storage.objects;
CREATE POLICY "Allow Authenticated View"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- 2. Allow Authenticated users to upload documents
DROP POLICY IF EXISTS "Allow Authenticated Upload" ON storage.objects;
CREATE POLICY "Allow Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- 3. Allow Admins to Delete documents
DROP POLICY IF EXISTS "Allow Admins to Delete" ON storage.objects;
CREATE POLICY "Allow Admins to Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.workers
    WHERE auth_user_id = auth.uid()
    AND role IN ('Admin', 'Super Admin')
  )
);

-- 4. Allow Admins to Update/Manage documents
DROP POLICY IF EXISTS "Allow Admins to Update" ON storage.objects;
CREATE POLICY "Allow Admins to Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.workers
    WHERE auth_user_id = auth.uid()
    AND role IN ('Admin', 'Super Admin')
  )
);
