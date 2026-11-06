-- Non-destructive migration to expose player linkage on public.perfiles
-- and allow super_admin and club_admin to link/unlink registered profiles and players.
-- Golden Rule: Unlinking (jugador_id = NULL) NEVER deletes the player record in public.jugadores
-- nor their points, inscriptions, or match history.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS jugador_id UUID REFERENCES public.jugadores(id) ON DELETE SET NULL;

-- Prevent two distinct profiles from linking to the same jugador_id simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS perfiles_jugador_id_unique_idx
  ON public.perfiles (jugador_id)
  WHERE jugador_id IS NOT NULL;

-- Backfill missing emails on public.perfiles from auth.users
UPDATE public.perfiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR btrim(p.email) = '');

-- Backfill jugador_id from public.profiles if already linked (and not colliding)
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
      AND p.jugador_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.perfiles p2
        WHERE p2.jugador_id = pr.jugador_id AND p2.id <> p.id
      );
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
  AND lower(btrim(p.email)) = uep.norm_email
  AND NOT EXISTS (
    SELECT 1 FROM public.perfiles p2
    WHERE p2.jugador_id = uep.jugador_id AND p2.id <> p.id
  );

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

    IF v_match_count <> 1 OR EXISTS (
      SELECT 1 FROM public.perfiles WHERE jugador_id = v_jugador_id
    ) THEN
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

-- Grant column-level UPDATE on jugador_id as well as rol and club_id
GRANT UPDATE (rol, club_id, jugador_id) ON public.perfiles TO authenticated;

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

DROP POLICY IF EXISTS "Admins asignan operadores de su club" ON public.perfiles;
CREATE POLICY "Admins asignan operadores y vinculan jugadores de su club"
ON public.perfiles FOR UPDATE TO authenticated
USING (
  public.current_profile_role() = 'club_admin'
  AND rol IN ('jugador', 'operador', 'club_admin')
  AND (club_id = public.current_profile_club_id() OR club_id IS NULL)
)
WITH CHECK (
  public.current_profile_role() = 'club_admin'
  AND (
    (rol = 'operador' AND club_id = public.current_profile_club_id())
    OR (rol = 'jugador' AND club_id IS NULL)
    OR (rol = 'club_admin' AND club_id = public.current_profile_club_id())
  )
);

DROP POLICY IF EXISTS "Usuarios leen su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios leen su propio perfil"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.current_profile_role() IN ('super_admin', 'club_admin')
);

-- RPC for super_admin and club_admin to link or unlink a profile and a player ficha safely
CREATE OR REPLACE FUNCTION public.admin_set_perfil_jugador_link(
  p_perfil_id UUID,
  p_jugador_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role TEXT;
  v_perfil RECORD;
  v_jugador RECORD;
  v_existing_perfil RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión.');
  END IF;

  SELECT p.rol::TEXT INTO v_actor_role
  FROM public.perfiles p
  WHERE p.id = auth.uid();

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'club_admin') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Solo administradores pueden vincular o desvincular perfiles.');
  END IF;

  IF p_perfil_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Falta indicar el perfil de usuario.');
  END IF;

  SELECT p.id, p.email, p.jugador_id
  INTO v_perfil
  FROM public.perfiles p
  WHERE p.id = p_perfil_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'No se encontró el perfil de usuario.');
  END IF;

  -- Case 1: Unlink (p_jugador_id IS NULL)
  -- Golden Rule: Never delete the player record in public.jugadores nor any historical data.
  IF p_jugador_id IS NULL THEN
    UPDATE public.perfiles
    SET jugador_id = NULL
    WHERE id = p_perfil_id;

    UPDATE public.profiles
    SET jugador_id = NULL
    WHERE user_id = p_perfil_id;

    IF v_perfil.jugador_id IS NOT NULL AND v_perfil.email IS NOT NULL THEN
      UPDATE public.jugadores
      SET email = NULL
      WHERE id = v_perfil.jugador_id
        AND pg_catalog.lower(pg_catalog.btrim(COALESCE(email, ''))) = pg_catalog.lower(pg_catalog.btrim(v_perfil.email));
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'action', 'unlinked',
      'perfil_id', p_perfil_id,
      'jugador_id', NULL
    );
  END IF;

  -- Case 2: Link to p_jugador_id
  SELECT j.id, j.nombre, j.apellido, j.email
  INTO v_jugador
  FROM public.jugadores j
  WHERE j.id = p_jugador_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'No se encontró la ficha del jugador seleccionado.');
  END IF;

  -- Check if another profile is already linked to this jugador_id
  SELECT p.id, p.email
  INTO v_existing_perfil
  FROM public.perfiles p
  WHERE p.jugador_id = p_jugador_id
    AND p.id <> p_perfil_id
  LIMIT 1;

  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'error', pg_catalog.format('Este jugador ya está vinculado a otra cuenta (%s). Desvinculá esa cuenta primero.', COALESCE(v_existing_perfil.email, v_existing_perfil.id::TEXT))
    );
  END IF;

  -- Update public.perfiles
  UPDATE public.perfiles
  SET jugador_id = p_jugador_id
  WHERE id = p_perfil_id;

  -- Sync public.profiles if row exists
  UPDATE public.profiles
  SET jugador_id = p_jugador_id
  WHERE user_id = p_perfil_id;

  -- Sync jugador email if profile has an email
  IF v_perfil.email IS NOT NULL AND pg_catalog.btrim(v_perfil.email) <> '' THEN
    UPDATE public.jugadores
    SET email = v_perfil.email
    WHERE id = p_jugador_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'action', 'linked',
    'perfil_id', p_perfil_id,
    'jugador_id', p_jugador_id,
    'jugador_nombre', v_jugador.nombre,
    'jugador_apellido', v_jugador.apellido
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_perfil_jugador_link(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_perfil_jugador_link(UUID, UUID) TO authenticated;
