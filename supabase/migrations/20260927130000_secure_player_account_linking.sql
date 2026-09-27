-- A player's private ficha may only be linked to the authenticated account
-- whose verified email matches the email already stored on that ficha.

DROP POLICY IF EXISTS "Profiles visibles para usuarios autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Usuarios leen su propio perfil"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_or_link_my_player()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_linked_player_id UUID;
  v_has_profile BOOLEAN := false;
  v_match_count INTEGER;
  v_player RECORD;
  v_rows_updated INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Iniciá sesión para vincular tu ficha');
  END IF;

  SELECT pg_catalog.lower(pg_catalog.btrim(u.email)) INTO v_email
  FROM auth.users AS u
  WHERE u.id = v_user_id AND u.email_confirmed_at IS NOT NULL;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Primero verificá el correo de tu cuenta');
  END IF;

  SELECT p.jugador_id INTO v_linked_player_id
  FROM public.profiles AS p
  WHERE p.user_id = v_user_id
  FOR UPDATE;
  v_has_profile := FOUND;

  IF v_linked_player_id IS NOT NULL THEN
    SELECT j.id, j.nombre, j.apellido, j.club, j.categoria_id, j.dni, j.telefono, j.email
    INTO v_player
    FROM public.jugadores AS j
    WHERE j.id = v_linked_player_id
      AND pg_catalog.lower(pg_catalog.btrim(COALESCE(j.email, ''))) = v_email
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN pg_catalog.json_build_object('ok', false, 'error', 'El correo verificado no coincide con el de la ficha. Contactá al club para revisar el vínculo');
    END IF;
  ELSE
    SELECT pg_catalog.count(*) INTO v_match_count
    FROM public.jugadores AS j
    WHERE pg_catalog.lower(pg_catalog.btrim(COALESCE(j.email, ''))) = v_email;

    IF v_match_count = 0 THEN
      RETURN pg_catalog.json_build_object('ok', false, 'error', 'No encontramos una ficha con ese correo. Pedile al club que agregue o corrija el correo de tu ficha');
    ELSIF v_match_count > 1 THEN
      RETURN pg_catalog.json_build_object('ok', false, 'error', 'Hay más de una ficha con ese correo. Contactá al club para revisarlas');
    END IF;

    SELECT j.id, j.nombre, j.apellido, j.club, j.categoria_id, j.dni, j.telefono, j.email
    INTO v_player
    FROM public.jugadores AS j
    WHERE pg_catalog.lower(pg_catalog.btrim(COALESCE(j.email, ''))) = v_email
    FOR UPDATE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.jugador_id = v_player.id AND p.user_id <> v_user_id
  ) THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Esa ficha ya está vinculada a otra cuenta. Contactá al club para verificarla');
  END IF;

  IF v_has_profile THEN
    UPDATE public.profiles SET jugador_id = v_player.id WHERE user_id = v_user_id;
  ELSE
    INSERT INTO public.profiles (user_id, display_name, email, jugador_id)
    VALUES (v_user_id, v_email, v_email, v_player.id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.profiles
    SET jugador_id = v_player.id
    WHERE user_id = v_user_id AND jugador_id IS NULL;
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      RETURN pg_catalog.json_build_object('ok', false, 'error', 'No se pudo vincular la ficha. Actualizá la página e intentá de nuevo');
    END IF;
  END IF;

  RETURN pg_catalog.json_build_object(
    'ok', true,
    'jugador_id', v_player.id,
    'nombre', v_player.nombre,
    'apellido', v_player.apellido,
    'club', v_player.club,
    'categoria_id', v_player.categoria_id,
    'dni', v_player.dni,
    'telefono', v_player.telefono,
    'email', v_player.email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_link_my_player() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_link_my_player() TO authenticated;
