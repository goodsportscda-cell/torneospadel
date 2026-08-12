-- Fix the case for 'estado' to match the allowed values in TS and DB constraints ('pendiente' instead of 'Pendiente')
CREATE OR REPLACE FUNCTION generar_fixture_americano_12(p_torneo_id UUID)
RETURNS void AS $$
DECLARE
  jugadores UUID[];
  r INT;
  p0 INT; p1 INT; m1 INT;
  p2 INT; m2 INT; p3 INT; m3 INT;
  p4 INT; m4 INT; p5 INT; m5 INT;
BEGIN
  SELECT array_agg(jugador_id) INTO jugadores
  FROM torneo_individual_jugadores
  WHERE torneo_id = p_torneo_id;

  IF array_length(jugadores, 1) != 12 THEN
    RAISE EXCEPTION 'El torneo no tiene exactamente 12 jugadores inscriptos.';
  END IF;

  -- Algoritmo cíclico: el jugador[12] queda fijo, los demás 11 rotan en cada fecha (r)
  FOR r IN 0..10 LOOP
    p0 := (r % 11) + 1;
    p1 := ((r + 1) % 11) + 1;
    m1 := ((r - 1 + 11) % 11) + 1;
    p2 := ((r + 2) % 11) + 1;
    m2 := ((r - 2 + 11) % 11) + 1;
    p3 := ((r + 3) % 11) + 1;
    m3 := ((r - 3 + 11) % 11) + 1;
    p4 := ((r + 4) % 11) + 1;
    m4 := ((r - 4 + 11) % 11) + 1;
    p5 := ((r + 5) % 11) + 1;
    m5 := ((r - 5 + 11) % 11) + 1;

    INSERT INTO partidos_individuales (torneo_id, fecha, jugador1_id, jugador2_id, jugador3_id, jugador4_id, cancha, estado)
    VALUES
    (p_torneo_id, r + 1, jugadores[12], jugadores[p0], jugadores[p1], jugadores[m1], 'Cancha 1', 'pendiente'),
    (p_torneo_id, r + 1, jugadores[p2], jugadores[m2], jugadores[p3], jugadores[m3], 'Cancha 2', 'pendiente'),
    (p_torneo_id, r + 1, jugadores[p4], jugadores[m4], jugadores[p5], jugadores[m5], 'Cancha 3', 'pendiente');
  END LOOP;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION generar_fixture_final_12(p_torneo_id UUID, p_jugadores UUID[])
RETURNS void AS $$
BEGIN
  IF array_length(p_jugadores, 1) != 12 THEN
    RAISE EXCEPTION 'Se requieren exactamente 12 jugadores clasificados para la final.';
  END IF;
  
  -- Insertamos la Fecha 12 con las 3 finales usando los IDs ya ordenados por React
  INSERT INTO partidos_individuales (torneo_id, fecha, jugador1_id, jugador2_id, jugador3_id, jugador4_id, cancha, estado)
  VALUES
  (p_torneo_id, 12, p_jugadores[1], p_jugadores[4], p_jugadores[2], p_jugadores[3], 'Cancha 1', 'pendiente'), -- Oro
  (p_torneo_id, 12, p_jugadores[5], p_jugadores[8], p_jugadores[6], p_jugadores[7], 'Cancha 2', 'pendiente'), -- Plata
  (p_torneo_id, 12, p_jugadores[9], p_jugadores[12], p_jugadores[10], p_jugadores[11], 'Cancha 3', 'pendiente'); -- Bronce
END;
$$ LANGUAGE plpgsql;
