-- Restore the RPC used by the dashboard to generate the final week of an
-- eight-player individual challenge tournament.
CREATE OR REPLACE FUNCTION public.generar_fixture_final_8(
  p_torneo_id UUID,
  p_jugadores UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_jugadores_distintos integer;
BEGIN
  IF COALESCE(array_length(p_jugadores, 1), 0) <> 8
     OR array_position(p_jugadores, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Se requieren exactamente 8 jugadores clasificados para la final.';
  END IF;

  SELECT count(DISTINCT jugador_id)
  INTO v_jugadores_distintos
  FROM unnest(p_jugadores) AS u(jugador_id);

  IF v_jugadores_distintos <> 8 THEN
    RAISE EXCEPTION 'Los 8 jugadores clasificados deben ser distintos.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.partidos_individuales
    WHERE torneo_id = p_torneo_id AND fecha = 8
  ) THEN
    RAISE EXCEPTION 'Ya hay partidos cargados para la Fecha 8.';
  END IF;

  INSERT INTO public.torneo_individual_fechas (torneo_id, fecha, costo_canchas, estado)
  VALUES (p_torneo_id, 8, 44000, 'pendiente')
  ON CONFLICT (torneo_id, fecha) DO NOTHING;

  INSERT INTO public.partidos_individuales (
    torneo_id, fecha, jugador1_id, jugador2_id, jugador3_id, jugador4_id, cancha, estado
  )
  VALUES
    (p_torneo_id, 8, p_jugadores[1], p_jugadores[4], p_jugadores[2], p_jugadores[3], 'Cancha 1: Gran Final', 'pendiente'),
    (p_torneo_id, 8, p_jugadores[5], p_jugadores[8], p_jugadores[6], p_jugadores[7], 'Cancha 2: Tercer Puesto', 'pendiente');
END;
$$;

REVOKE ALL ON FUNCTION public.generar_fixture_final_8(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_fixture_final_8(UUID, UUID[]) TO authenticated;
