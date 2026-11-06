-- Non-destructive migration to expose player linkage on public.perfiles
-- and allow super_admin and club_admin to inspect registered profiles.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS jugador_id UUID REFERENCES public.jugadores(id) ON DELETE SET NULL;

-- Backfill missing emails on public.perfiles from auth.users
UPDATE public.perfiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR btrim(p.email) = '');

-- Backfill jugador_id from public.profiles if already linked
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'jugador_id'
  ) THEN
    UPDATE public.perfiles p
    SET jugador_id = pr.jugador_id
    FROM public.profiles pr
    WHERE pr.user_id = p.id
      AND pr.jugador_id IS NOT NULL
      AND p.jugador_id IS NULL;
  END IF;
END $$;

-- Backfill jugador_id by matching unique normalized email in public.jugadores
WITH unique_email_players AS (
  SELECT
    lower(btrim(email)) AS norm_email,
    (array_agg(id))[1] AS jugador_id
  FROM public.jugadores
  WHERE email IS NOT NULL AND btrim(email) <> ''
  GROUP BY lower(btrim(email))
  HAVING count(*) = 1
)
UPDATE public.perfiles p
SET jugador_id = uep.jugador_id
FROM unique_email_players uep
WHERE p.jugador_id IS NULL
  AND p.email IS NOT NULL
  AND lower(btrim(p.email)) = uep.norm_email;

-- Keep handle_new_user linking jugador_id automatically if a unique matching player email exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jugador_id UUID;
  v_match_count INTEGER;
BEGIN
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT count(*), (array_agg(id))[1]
    INTO v_match_count, v_jugador_id
    FROM public.jugadores
    WHERE lower(btrim(COALESCE(email, ''))) = lower(btrim(NEW.email));

    IF v_match_count <> 1 THEN
      v_jugador_id := NULL;
    END IF;
  END IF;

  INSERT INTO public.perfiles (id, rol, email, jugador_id)
  VALUES (NEW.id, 'jugador', NEW.email, v_jugador_id)
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(public.perfiles.email, EXCLUDED.email),
        jugador_id = COALESCE(public.perfiles.jugador_id, EXCLUDED.jugador_id);

  RETURN NEW;
END;
$$;

-- Ensure RLS allows super_admin to read all profiles and club_admin to read club/player profiles
DROP POLICY IF EXISTS "Usuarios leen su perfil y admins los perfiles permitidos" ON public.perfiles;
CREATE POLICY "Usuarios leen su perfil y admins los perfiles permitidos"
ON public.perfiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.current_profile_role() = 'super_admin'
  OR (
    public.current_profile_role() = 'club_admin'
    AND (club_id = public.current_profile_club_id() OR club_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Usuarios leen su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios leen su propio perfil"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.current_profile_role() IN ('super_admin', 'club_admin')
);

