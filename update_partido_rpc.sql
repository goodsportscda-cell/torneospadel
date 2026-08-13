CREATE OR REPLACE FUNCTION guardar_resultado_partido_transaction(
  p_partido_id UUID,
  p_tabla TEXT,
  p_ganador_id UUID,
  p_estado TEXT,
  p_sets JSONB
) RETURNS void AS $$
DECLARE
  v_set JSONB;
BEGIN
  IF p_tabla = 'partidos_zona' THEN
    UPDATE partidos_zona 
    SET ganador_id = p_ganador_id, estado = p_estado
    WHERE id = p_partido_id;
  ELSIF p_tabla = 'partidos_llave' THEN
    UPDATE partidos_llave 
    SET ganador_id = p_ganador_id, estado = p_estado
    WHERE id = p_partido_id;
  ELSIF p_tabla = 'partidos_individuales' THEN
    UPDATE partidos_individuales
    SET ganador_id = p_ganador_id, estado = p_estado
    WHERE id = p_partido_id;
  ELSE
    RAISE EXCEPTION 'Tabla no soportada: %', p_tabla;
  END IF;

  FOR v_set IN SELECT * FROM jsonb_array_elements(p_sets)
  LOOP
    IF v_set->>'id' IS NOT NULL THEN
      UPDATE sets_partido
      SET games_local = (v_set->>'games_local')::integer,
          games_visitante = (v_set->>'games_visitante')::integer
      WHERE id = (v_set->>'id')::uuid;
    ELSE
      IF p_tabla = 'partidos_zona' THEN
        INSERT INTO sets_partido (partido_id, numero_set, games_local, games_visitante)
        VALUES (
          p_partido_id, 
          (v_set->>'numero_set')::integer, 
          (v_set->>'games_local')::integer, 
          (v_set->>'games_visitante')::integer
        );
      ELSIF p_tabla = 'partidos_llave' THEN
        INSERT INTO sets_partido (partido_llave_id, numero_set, games_local, games_visitante)
        VALUES (
          p_partido_id, 
          (v_set->>'numero_set')::integer, 
          (v_set->>'games_local')::integer, 
          (v_set->>'games_visitante')::integer
        );
      ELSIF p_tabla = 'partidos_individuales' THEN
        INSERT INTO sets_partido (partido_individual_id, numero_set, games_local, games_visitante)
        VALUES (
          p_partido_id, 
          (v_set->>'numero_set')::integer, 
          (v_set->>'games_local')::integer, 
          (v_set->>'games_visitante')::integer
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
