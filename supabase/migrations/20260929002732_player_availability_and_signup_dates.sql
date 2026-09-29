-- Let a player read and edit only their own registration availability.
CREATE OR REPLACE FUNCTION public.get_my_inscription_availability(p_jugador_id UUID)
RETURNS TABLE (
  inscripcion_id UUID,
  disponibilidad_horaria TEXT,
  franjas JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.jugador_id = p_jugador_id
  ) THEN
    RAISE EXCEPTION 'No tenés permiso para ver estas disponibilidades' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT i.id,
         i.disponibilidad_horaria,
         COALESCE((
           SELECT pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'id', f.id,
               'label', f.label_franja,
               'seleccionada', d.franja_id IS NOT NULL
             ) ORDER BY f.dia_nombre, f.hora_inicio
           )
           FROM public.torneo_franjas_horarias f
           LEFT JOIN public.inscripcion_disponibilidades d
             ON d.franja_id = f.id AND d.inscripcion_id = i.id
           WHERE f.torneo_id = i.torneo_id
         ), '[]'::JSONB)
  FROM public.inscripciones i
  WHERE (i.jugador1_id = p_jugador_id OR i.jugador2_id = p_jugador_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_inscription_availability(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_inscription_availability(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_inscription_availability(
  p_inscripcion_id UUID,
  p_disponibilidad_horaria TEXT,
  p_franjas_ids UUID[] DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jugador_id UUID;
  v_torneo_id UUID;
  v_today DATE := (pg_catalog.now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
  v_ids UUID[] := COALESCE(p_franjas_ids, '{}');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Iniciá sesión para editar tu disponibilidad');
  END IF;

  SELECT p.jugador_id INTO v_jugador_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.jugador_id IS NOT NULL;

  IF v_jugador_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'La cuenta no tiene una ficha de jugador vinculada');
  END IF;

  IF pg_catalog.length(COALESCE(p_disponibilidad_horaria, '')) > 500 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'La disponibilidad no puede superar los 500 caracteres');
  END IF;

  SELECT i.torneo_id INTO v_torneo_id
  FROM public.inscripciones i
  JOIN public.torneos t ON t.id = i.torneo_id
  WHERE i.id = p_inscripcion_id
    AND (i.jugador1_id = v_jugador_id OR i.jugador2_id = v_jugador_id)
    AND t.estado IN ('proximamente', 'inscripciones_abiertas', 'inscripciones_cerradas')
    AND v_today < t.fecha_inicio
  FOR UPDATE OF i, t;

  IF v_torneo_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'La edición ya cerró o esta inscripción no pertenece a tu ficha');
  END IF;

  IF pg_catalog.cardinality(v_ids) <> (
    SELECT pg_catalog.count(DISTINCT requested.id)::INTEGER
    FROM pg_catalog.unnest(v_ids) AS requested(id)
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.unnest(v_ids) AS requested(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.torneo_franjas_horarias f
      WHERE f.id = requested.id AND f.torneo_id = v_torneo_id
    )
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Una o más franjas no pertenecen a este torneo');
  END IF;

  UPDATE public.inscripciones
  SET disponibilidad_horaria = NULLIF(pg_catalog.btrim(COALESCE(p_disponibilidad_horaria, '')), ''),
      updated_at = pg_catalog.now()
  WHERE id = p_inscripcion_id;

  DELETE FROM public.inscripcion_disponibilidades
  WHERE inscripcion_id = p_inscripcion_id;

  INSERT INTO public.inscripcion_disponibilidades (inscripcion_id, franja_id)
  SELECT p_inscripcion_id, requested.id
  FROM pg_catalog.unnest(v_ids) AS requested(id);

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_inscription_availability(UUID, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_inscription_availability(UUID, TEXT, UUID[]) TO authenticated;

-- Keep the quick-enroll path closed when an event's last day has passed.
CREATE OR REPLACE FUNCTION public.inscribir_mi_americano_individual(p_torneo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_jugador_id UUID;
  v_canchas_count INTEGER;
  v_current_players INTEGER;
  v_estado TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Iniciá sesión para inscribirte');
  END IF;

  SELECT p.jugador_id INTO v_jugador_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id AND p.jugador_id IS NOT NULL;

  IF v_jugador_id IS NULL THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Primero verificá y vinculá tu ficha de jugador');
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

  IF EXISTS (
    SELECT 1 FROM public.torneo_individual_jugadores tij
    WHERE tij.torneo_id = p_torneo_id AND tij.jugador_id = v_jugador_id
  ) THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Ya estás inscrito en este torneo');
  END IF;

  SELECT COUNT(*) INTO v_current_players
  FROM public.torneo_individual_jugadores tij
  WHERE tij.torneo_id = p_torneo_id;

  v_estado := CASE WHEN v_current_players >= COALESCE(v_canchas_count, 3) * 4
    THEN 'lista_espera' ELSE 'confirmada' END;

  INSERT INTO public.torneo_individual_jugadores (torneo_id, jugador_id, estado)
  VALUES (p_torneo_id, v_jugador_id, v_estado);

  RETURN pg_catalog.json_build_object('ok', true, 'estado', v_estado);
END;
$$;

REVOKE ALL ON FUNCTION public.inscribir_mi_americano_individual(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inscribir_mi_americano_individual(UUID) TO authenticated;
