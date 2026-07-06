-- Create bucket for club logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'club-logos');

-- Allow authenticated users with admin/super_admin role to upload
CREATE POLICY "Admin Upload Access" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'club-logos' 
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('club_admin', 'super_admin')
    )
  )
);

-- Allow authenticated users with admin/super_admin role to update
CREATE POLICY "Admin Update Access" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'club-logos' 
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('club_admin', 'super_admin')
    )
  )
);

-- Allow authenticated users with admin/super_admin role to delete
CREATE POLICY "Admin Delete Access" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'club-logos' 
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('club_admin', 'super_admin')
    )
  )
);
