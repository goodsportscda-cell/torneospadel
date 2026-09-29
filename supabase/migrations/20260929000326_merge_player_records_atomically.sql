CREATE OR REPLACE FUNCTION public.fusionar_jugadores(p_mantener_id uuid, p_eliminar_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_mantener_id IS NULL OR p_eliminar_id IS NULL OR p_mantener_id = p_eliminar_id THEN
    RAISE EXCEPTION 'IDs de jugadores inválidos' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.jugadores WHERE id = p_mantener_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el jugador que se conserva' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.jugadores WHERE id = p_eliminar_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el jugador duplicado' USING ERRCODE = 'P0002'; END IF;

  -- Conflicts that require a human decision abort the transaction before any writes.
  IF EXISTS (SELECT 1 FROM public.inscripciones WHERE torneo_id IN
       (SELECT torneo_id FROM public.inscripciones WHERE jugador1_id = p_eliminar_id OR jugador2_id = p_eliminar_id)
       AND ((jugador1_id = p_mantener_id AND jugador2_id = p_eliminar_id)
         OR (jugador1_id = p_eliminar_id AND jugador2_id = p_mantener_id))) THEN
    RAISE EXCEPTION 'Ambos registros aparecen como pareja en una misma inscripción; revisá esa inscripción antes de fusionar' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.partidos_individuales p
    WHERE p_mantener_id IN (p.jugador1_id, p.jugador2_id, p.jugador3_id, p.jugador4_id)
      AND p_eliminar_id IN (p.jugador1_id, p.jugador2_id, p.jugador3_id, p.jugador4_id)
  ) THEN
    RAISE EXCEPTION 'Ambos registros aparecen en el mismo partido; revisá el fixture antes de fusionar' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.torneo_individual_jugadores a JOIN public.torneo_individual_jugadores b
    ON a.torneo_id = b.torneo_id WHERE a.jugador_id = p_mantener_id AND b.jugador_id = p_eliminar_id) THEN
    RAISE EXCEPTION 'Ambos registros ya están inscriptos en el mismo torneo individual' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.torneo_individual_pagos a JOIN public.torneo_individual_pagos b
    ON a.torneo_id = b.torneo_id AND a.fecha = b.fecha
    WHERE a.jugador_id = p_mantener_id AND b.jugador_id = p_eliminar_id) THEN
    RAISE EXCEPTION 'Hay pagos duplicados en la misma fecha; revisalos antes de fusionar' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.torneo_individual_parejas a JOIN public.torneo_individual_parejas b
    ON a.torneo_id = b.torneo_id
      AND a.jugador1_id = CASE WHEN b.jugador1_id = p_eliminar_id THEN p_mantener_id ELSE b.jugador1_id END
      AND a.jugador2_id = CASE WHEN b.jugador2_id = p_eliminar_id THEN p_mantener_id ELSE b.jugador2_id END
    WHERE (b.jugador1_id = p_eliminar_id OR b.jugador2_id = p_eliminar_id)
      AND a.id <> b.id) THEN
    RAISE EXCEPTION 'La fusión produciría una pareja duplicada en un torneo individual' USING ERRCODE = '23514';
  END IF;

  UPDATE public.jugadores keep
  SET categoria_id = COALESCE(keep.categoria_id, duplicate.categoria_id),
      updated_at = pg_catalog.now()
  FROM public.jugadores duplicate
  WHERE keep.id = p_mantener_id AND duplicate.id = p_eliminar_id;

  -- Keep the selected player's category per club when both records have one.
  DELETE FROM public.jugador_categorias_club source
  USING public.jugador_categorias_club target
  WHERE source.jugador_id = p_eliminar_id AND target.jugador_id = p_mantener_id
    AND source.club_id = target.club_id;
  UPDATE public.jugador_categorias_club SET jugador_id = p_mantener_id, updated_at = pg_catalog.now()
  WHERE jugador_id = p_eliminar_id;

  -- Retain a single ranking row per tournament and add the duplicate's points.
  UPDATE public.ranking_jugadores target
  SET puntos = COALESCE(target.puntos, 0) + COALESCE(source.puntos, 0)
  FROM public.ranking_jugadores source
  WHERE target.jugador_id = p_mantener_id AND source.jugador_id = p_eliminar_id
    AND target.torneo_id = source.torneo_id;
  DELETE FROM public.ranking_jugadores source
  USING public.ranking_jugadores target
  WHERE source.jugador_id = p_eliminar_id AND target.jugador_id = p_mantener_id
    AND target.torneo_id = source.torneo_id;
  UPDATE public.ranking_jugadores SET jugador_id = p_mantener_id WHERE jugador_id = p_eliminar_id;

  UPDATE public.inscripciones SET jugador1_id = p_mantener_id WHERE jugador1_id = p_eliminar_id;
  UPDATE public.inscripciones SET jugador2_id = p_mantener_id WHERE jugador2_id = p_eliminar_id;
  UPDATE public.ascensos SET jugador_id = p_mantener_id WHERE jugador_id = p_eliminar_id;
  UPDATE public.profiles SET jugador_id = p_mantener_id WHERE jugador_id = p_eliminar_id;
  UPDATE public.partidos_individuales SET jugador1_id = p_mantener_id WHERE jugador1_id = p_eliminar_id;
  UPDATE public.partidos_individuales SET jugador2_id = p_mantener_id WHERE jugador2_id = p_eliminar_id;
  UPDATE public.partidos_individuales SET jugador3_id = p_mantener_id WHERE jugador3_id = p_eliminar_id;
  UPDATE public.partidos_individuales SET jugador4_id = p_mantener_id WHERE jugador4_id = p_eliminar_id;
  UPDATE public.torneo_individual_jugadores SET jugador_id = p_mantener_id WHERE jugador_id = p_eliminar_id;
  UPDATE public.torneo_individual_pagos SET jugador_id = p_mantener_id WHERE jugador_id = p_eliminar_id;
  UPDATE public.torneo_individual_parejas SET jugador1_id = p_mantener_id WHERE jugador1_id = p_eliminar_id;
  UPDATE public.torneo_individual_parejas SET jugador2_id = p_mantener_id WHERE jugador2_id = p_eliminar_id;

  DELETE FROM public.jugadores WHERE id = p_eliminar_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fusionar_jugadores(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fusionar_jugadores(uuid, uuid) TO service_role;
