-- Agrega campo photo_url a master_matches para almacenar únicamente la URL de Supabase Storage
ALTER TABLE public.master_matches
ADD COLUMN IF NOT EXISTS photo_url TEXT;
