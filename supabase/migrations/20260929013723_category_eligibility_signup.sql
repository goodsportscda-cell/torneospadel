-- Compare club-assigned player categories with tournament categories.
-- A numerically higher category is lower-level (e.g. 8va is below 6ta).
CREATE OR REPLACE FUNCTION public.jugador_puede_inscribirse_categoria(
  p_jugador_id UUID,
  p_torneo_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_club_id UUID;
  v_categoria_torneo TEXT;
  v_genero_torneo TEXT;
  v_categoria_jugador TEXT;
  v_genero_jugador TEXT;
  v_nivel_torneo INTEGER;
  v_nivel_jugador INTEGER;
BEGIN
  SELECT t.club_id,
         COALESCE(c.nombre, t.categoria_libre),
         COALESCE(c.genero::TEXT, t.genero::TEXT)
  INTO v_club_id, v_categoria_torneo, v_genero_torneo
  FROM public.torneos t
  LEFT JOIN public.categorias c ON c.id = t.categoria_id
  WHERE t.id = p_torneo_id;

  IF NOT FOUND OR v_club_id IS NULL OR v_categoria_torneo IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('permitido', true, 'requiere_revision', true);
  END IF;

  SELECT cj.nombre, cj.genero::TEXT
  INTO v_categoria_jugador, v_genero_jugador
  FROM public.jugador_categorias_club jcc
  JOIN public.categorias_jugadores cj
    ON cj.id = jcc.categoria_id AND cj.club_id = jcc.club_id
  WHERE jcc.jugador_id = p_jugador_id AND jcc.club_id = v_club_id;

  IF NOT FOUND OR v_categoria_jugador IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'permitido', true,
      'requiere_revision', true,
      'categoria_torneo', v_categoria_torneo
    );
  END IF;

  v_nivel_torneo := (pg_catalog.regexp_match(
    pg_catalog.lower(v_categoria_torneo),
    '(^|[^0-9])([1-8])[[:space:]]*(ra|da|ta|va|ma|º|°)([^a-z0-9]|$)'
  ))[2]::INTEGER;
  v_nivel_jugador := (pg_catalog.regexp_match(
    pg_catalog.lower(v_categoria_jugador),
    '(^|[^0-9])([1-8])[[:space:]]*(ra|da|ta|va|ma|º|°)([^a-z0-9]|$)'
  ))[2]::INTEGER;

  IF v_nivel_torneo IS NULL OR v_nivel_jugador IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'permitido', true,
      'requiere_revision', true,
      'categoria_jugador', v_categoria_jugador,
      'categoria_torneo', v_categoria_torneo
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'permitido', v_nivel_torneo <= v_nivel_jugador,
    'requiere_revision', false,
    'categoria_jugador', v_categoria_jugador,
    'categoria_torneo', v_categoria_torneo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.jugador_puede_inscribirse_categoria(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jugador_puede_inscribirse_categoria(UUID, UUID) TO service_role;

-- The public individual-tournament registration path enforces both the date
-- and the club category rule, including requests sent without the web form.
CREATE OR REPLACE FUNCTION public.inscribir_americano_individual(
  p_torneo_id UUID,
  p_dni TEXT,
  p_nombre TEXT,
  p_apellido TEXT,
  p_telefono TEXT,
  p_email TEXT,
  p_club TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jugador_id UUID;
  v_ext_jugador RECORD;
  v_max_players INTEGER;
  v_current_players INTEGER;
  v_is_waiting_list BOOLEAN;
  v_canchas_count INTEGER;
  v_dni_normalizado TEXT;
  v_eligibilidad JSONB;
BEGIN
  v_dni_normalizado := pg_catalog.regexp_replace(COALESCE(p_dni, ''), '[^0-9]', '', 'g');
  IF pg_catalog.length(v_dni_normalizado) NOT BETWEEN 6 AND 12
     OR pg_catalog.btrim(COALESCE(p_nombre, '')) = ''
     OR pg_catalog.btrim(COALESCE(p_apellido, '')) = '' THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Revisá el DNI, nombre y apellido ingresados');
  END IF;

  SELECT t.canchas_count INTO v_canchas_count
  FROM public.torneos t
  WHERE t.id = p_torneo_id
    AND t.tipo = 'americano_individual'
    AND t.estado = 'inscripciones_abiertas'
    AND (pg_catalog.now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
      <= COALESCE(t.fecha_fin, t.fecha_inicio)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'El torneo no existe, ya pasó o no tiene las inscripciones abiertas');
  END IF;

  SELECT j.id, j.nombre, j.apellido INTO v_ext_jugador
  FROM public.jugadores j
  WHERE pg_catalog.regexp_replace(COALESCE(j.dni, ''), '[^0-9]', '', 'g') = v_dni_normalizado
  LIMIT 1;

  IF FOUND THEN
    IF pg_catalog.lower(pg_catalog.btrim(COALESCE(v_ext_jugador.nombre, ''))) <>
         pg_catalog.lower(pg_catalog.btrim(p_nombre))
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_ext_jugador.apellido, ''))) <>
         pg_catalog.lower(pg_catalog.btrim(p_apellido)) THEN
      RETURN pg_catalog.json_build_object('ok', false, 'error', 'Los datos no coinciden con la ficha existente. Contactá al club para validar la inscripción');
    END IF;
    v_jugador_id := v_ext_jugador.id;

    v_eligibilidad := public.jugador_puede_inscribirse_categoria(v_jugador_id, p_torneo_id);
    IF NOT COALESCE((v_eligibilidad->>'permitido')::BOOLEAN, true) THEN
      RETURN pg_catalog.json_build_object('ok', false, 'error', 'La categoría asignada por el club no permite anotarse en esta categoría. Contactá al club para revisarla.');
    END IF;
  ELSE
    INSERT INTO public.jugadores (dni, nombre, apellido, telefono, email, club)
    VALUES (v_dni_normalizado, pg_catalog.btrim(p_nombre), pg_catalog.btrim(p_apellido),
            NULLIF(pg_catalog.btrim(COALESCE(p_telefono, '')), ''),
            NULLIF(pg_catalog.btrim(COALESCE(p_email, '')), ''),
            NULLIF(pg_catalog.btrim(COALESCE(p_club, '')), ''))
    RETURNING id INTO v_jugador_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.torneo_individual_jugadores tij
    WHERE tij.torneo_id = p_torneo_id AND tij.jugador_id = v_jugador_id
  ) THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Ya estás registrado en este torneo');
  END IF;

  v_max_players := COALESCE(v_canchas_count, 3) * 4;
  SELECT COUNT(*) INTO v_current_players
  FROM public.torneo_individual_jugadores tij
  WHERE tij.torneo_id = p_torneo_id;
  v_is_waiting_list := v_current_players >= v_max_players;

  INSERT INTO public.torneo_individual_jugadores (torneo_id, jugador_id, estado)
  VALUES (p_torneo_id, v_jugador_id,
          CASE WHEN v_is_waiting_list THEN 'lista_espera' ELSE 'pendiente_pago' END);

  RETURN pg_catalog.json_build_object(
    'ok', true,
    'estado', CASE WHEN v_is_waiting_list THEN 'lista_espera' ELSE 'pendiente_pago' END,
    'jugador_id', v_jugador_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.inscribir_americano_individual(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
