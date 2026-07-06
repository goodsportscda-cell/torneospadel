-- 1. Create clubes table
CREATE TABLE IF NOT EXISTS public.clubes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create perfiles table
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('super_admin', 'club_admin', 'jugador')),
    club_id UUID REFERENCES public.clubes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Add club_id to existing tables
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubes(id);
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubes(id);

-- 4. Insert Default Club (Goodsports)
INSERT INTO public.clubes (nombre, slug) 
VALUES ('Goodsports', 'goodsports')
ON CONFLICT (slug) DO NOTHING;

-- Assign all existing torneos and categorias to the default club
DO $$ 
DECLARE
    default_club_id UUID;
BEGIN
    SELECT id INTO default_club_id FROM public.clubes WHERE slug = 'goodsports' LIMIT 1;
    
    UPDATE public.torneos SET club_id = default_club_id WHERE club_id IS NULL;
    UPDATE public.categorias SET club_id = default_club_id WHERE club_id IS NULL;

    -- Migrate admins from user_roles to perfiles (as super_admin for the first ones)
    INSERT INTO public.perfiles (id, rol, club_id)
    SELECT user_id, 'super_admin', default_club_id
    FROM public.user_roles
    ON CONFLICT (id) DO NOTHING;
END $$;

-- 5. Enable RLS
ALTER TABLE public.clubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Clubes
CREATE POLICY "Lectura publica de clubes" ON public.clubes FOR SELECT USING (true);

CREATE POLICY "Super admins pueden insertar clubes" ON public.clubes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin')
);

CREATE POLICY "Admins pueden editar su club" ON public.clubes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin') OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'club_admin' AND perfiles.club_id = clubes.id)
);

-- Perfiles
CREATE POLICY "Perfiles publicos para lectura" ON public.perfiles FOR SELECT USING (true);

CREATE POLICY "Usuarios pueden actualizar su perfil" ON public.perfiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Super admins pueden insertar perfiles" ON public.perfiles FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin')
);

-- Torneos RLS Updates
CREATE POLICY "Admins insertan torneos en su club" ON public.torneos FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin') OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'club_admin' AND perfiles.club_id = torneos.club_id)
);

CREATE POLICY "Admins actualizan torneos de su club" ON public.torneos FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin') OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'club_admin' AND perfiles.club_id = torneos.club_id)
);

CREATE POLICY "Admins eliminan torneos de su club" ON public.torneos FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin') OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'club_admin' AND perfiles.club_id = torneos.club_id)
);

-- Categorias RLS Updates
CREATE POLICY "Admins gestionan categorias de su club INSERT" ON public.categorias FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin') OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'club_admin' AND perfiles.club_id = categorias.club_id)
);

CREATE POLICY "Admins gestionan categorias de su club UPDATE" ON public.categorias FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin') OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'club_admin' AND perfiles.club_id = categorias.club_id)
);

CREATE POLICY "Admins gestionan categorias de su club DELETE" ON public.categorias FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin') OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'club_admin' AND perfiles.club_id = categorias.club_id)
);
