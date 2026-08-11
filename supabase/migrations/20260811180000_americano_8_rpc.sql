-- Función para generar fixture automático de 8 jugadores en formato Americano Individual
CREATE OR REPLACE FUNCTION generar_fixture_americano_8(p_torneo_id UUID)
RETURNS void AS $$
DECLARE
  jugadores UUID[];
BEGIN
  -- Obtener los 8 jugadores
  SELECT array_agg(jugador_id) INTO jugadores
  FROM torneo_individual_jugadores
  WHERE torneo_id = p_torneo_id;

  IF array_length(jugadores, 1) != 8 THEN
    RAISE EXCEPTION 'El torneo no tiene exactamente 8 jugadores inscriptos.';
  END IF;

  -- Asegurarnos de que las 7 fechas existan en torneo_individual_fechas
  FOR i IN 1..7 LOOP
    INSERT INTO torneo_individual_fechas (torneo_id, fecha, costo_canchas, estado)
    VALUES (p_torneo_id, i, 44000, 'pendiente')
    ON CONFLICT (torneo_id, fecha) DO NOTHING;
  END LOOP;
  
  -- Insertar los partidos adaptando los nombres a nuestra estructura
  INSERT INTO partidos_individuales (torneo_id, fecha, cancha, jugador1_id, jugador2_id, jugador3_id, jugador4_id, estado)
  VALUES
  (p_torneo_id, 1, 'Cancha 1', jugadores[1], jugadores[2], jugadores[3], jugadores[4], 'pendiente'),
  (p_torneo_id, 1, 'Cancha 2', jugadores[5], jugadores[6], jugadores[7], jugadores[8], 'pendiente'),
  (p_torneo_id, 2, 'Cancha 1', jugadores[1], jugadores[3], jugadores[5], jugadores[7], 'pendiente'),
  (p_torneo_id, 2, 'Cancha 2', jugadores[2], jugadores[4], jugadores[6], jugadores[8], 'pendiente'),
  (p_torneo_id, 3, 'Cancha 1', jugadores[1], jugadores[4], jugadores[6], jugadores[7], 'pendiente'),
  (p_torneo_id, 3, 'Cancha 2', jugadores[2], jugadores[3], jugadores[5], jugadores[8], 'pendiente'),
  (p_torneo_id, 4, 'Cancha 1', jugadores[1], jugadores[5], jugadores[2], jugadores[8], 'pendiente'),
  (p_torneo_id, 4, 'Cancha 2', jugadores[3], jugadores[7], jugadores[4], jugadores[6], 'pendiente'),
  (p_torneo_id, 5, 'Cancha 1', jugadores[1], jugadores[6], jugadores[3], jugadores[8], 'pendiente'),
  (p_torneo_id, 5, 'Cancha 2', jugadores[2], jugadores[7], jugadores[4], jugadores[5], 'pendiente'),
  (p_torneo_id, 6, 'Cancha 1', jugadores[1], jugadores[7], jugadores[4], jugadores[8], 'pendiente'),
  (p_torneo_id, 6, 'Cancha 2', jugadores[2], jugadores[5], jugadores[3], jugadores[6], 'pendiente'),
  (p_torneo_id, 7, 'Cancha 1', jugadores[1], jugadores[8], jugadores[2], jugadores[6], 'pendiente'),
  (p_torneo_id, 7, 'Cancha 2', jugadores[3], jugadores[5], jugadores[4], jugadores[7], 'pendiente');
END;
$$ LANGUAGE plpgsql;
