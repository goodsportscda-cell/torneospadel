-- Migración para generar los cruces de la Fecha 8 (Gran Final) para Americano Individual 8 jugadores.
-- Dado que el ranking (posiciones) se calcula dinámicamente en el frontend (TorneoIndividualDashboard.tsx),
-- la función recibe el array de 8 jugadores ya ordenados (del 1ro al 8vo) para garantizar el 100%
-- de fidelidad con los criterios de desempate de la aplicación.

CREATE OR REPLACE FUNCTION generar_fixture_final_8(p_torneo_id UUID, p_jugadores UUID[])
RETURNS void AS $$
BEGIN
  IF array_length(p_jugadores, 1) != 8 THEN
    RAISE EXCEPTION 'Se requieren exactamente 8 jugadores clasificados para la final.';
  END IF;

  -- Asegurar que la Fecha 8 exista en la tabla de fechas
  INSERT INTO torneo_individual_fechas (torneo_id, fecha, costo_canchas, estado)
  VALUES (p_torneo_id, 8, 44000, 'pendiente')
  ON CONFLICT (torneo_id, fecha) DO NOTHING;
  
  -- Insertamos la Fecha 8 con los cruces matemáticos (1 y 4 vs 2 y 3) y (5 y 8 vs 6 y 7)
  INSERT INTO partidos_individuales (torneo_id, fecha, jugador1_id, jugador2_id, jugador3_id, jugador4_id, cancha, estado)
  VALUES
  (p_torneo_id, 8, p_jugadores[1], p_jugadores[4], p_jugadores[2], p_jugadores[3], 'Cancha 1: Gran Final', 'pendiente'),
  (p_torneo_id, 8, p_jugadores[5], p_jugadores[8], p_jugadores[6], p_jugadores[7], 'Cancha 2: Tercer Puesto', 'pendiente');
END;
$$ LANGUAGE plpgsql;
