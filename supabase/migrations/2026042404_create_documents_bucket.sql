-- Create the DOCUMENTS storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('DOCUMENTS', 'DOCUMENTS', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for the DOCUMENTS bucket
-- 1. Allow Authenticated users to view documents
CREATE POLICY "Allow Authenticated View"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'DOCUMENTS');

-- 2. Allow Authenticated users to upload documents
CREATE POLICY "Allow Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'DOCUMENTS');

-- 3. Allow Admins to Delete documents
-- Note: Checking the 'workers' table for Admin/Super Admin role
CREATE POLICY "Allow Admins to Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'DOCUMENTS' AND
  EXISTS (
    SELECT 1 FROM public.workers
    WHERE auth_user_id = auth.uid()
    AND role IN ('Admin', 'Super Admin')
  )
);

-- 4. Allow Admins to Update/Manage documents
CREATE POLICY "Allow Admins to Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'DOCUMENTS' AND
  EXISTS (
    SELECT 1 FROM public.workers
    WHERE auth_user_id = auth.uid()
    AND role IN ('Admin', 'Super Admin')
  )
);
