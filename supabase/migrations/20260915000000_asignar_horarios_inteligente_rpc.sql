CREATE OR REPLACE FUNCTION asignar_horarios_inteligente(p_torneo_id UUID)
RETURNS JSON AS $$
DECLARE
    v_canchas_disponibles INT;
    v_fecha_inicio DATE;
    v_fecha_fin DATE;
    v_duracion_partido INTERVAL := '1 hour';
    
    -- Temp structures
    v_partido RECORD;
    v_slot RECORD;
    
    v_asignados INT := 0;
    v_no_asignados INT := 0;
    v_cancha TEXT;
    v_assigned BOOLEAN;
BEGIN
    -- 1. Obtener config del torneo
    SELECT canchas_disponibles, fecha_inicio, fecha_fin
    INTO v_canchas_disponibles, v_fecha_inicio, v_fecha_fin
    FROM torneos WHERE id = p_torneo_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Torneo no encontrado');
    END IF;

    IF v_canchas_disponibles IS NULL THEN
        v_canchas_disponibles := 3;
    END IF;

    -- Crear tabla temporal para slots ocupados a nivel GLOBAL
    CREATE TEMP TABLE IF NOT EXISTS temp_ocupacion (
        fecha_hora TEXT,
        cancha_asignada TEXT
    ) ON COMMIT DROP;
    TRUNCATE temp_ocupacion;

    -- Cargar ocupación actual (de todos los torneos)
    INSERT INTO temp_ocupacion (fecha_hora, cancha_asignada)
    SELECT fecha_hora, cancha_asignada FROM partidos_zona 
    WHERE fecha_hora IS NOT NULL AND cancha_asignada IS NOT NULL;
    
    INSERT INTO temp_ocupacion (fecha_hora, cancha_asignada)
    SELECT fecha_hora, cancha_asignada FROM llaves_partidos 
    WHERE fecha_hora IS NOT NULL AND cancha_asignada IS NOT NULL;

    -- Crear tabla temporal para posibles slots por partido
    CREATE TEMP TABLE IF NOT EXISTS temp_match_slots (
        partido_id UUID,
        slot_dt TEXT,
        peso_restriccion INT
    ) ON COMMIT DROP;
    TRUNCATE temp_match_slots;

    -- 2. Calcular los slots posibles para cada partido del torneo (en base a la intersección de disponibilidades)
    FOR v_partido IN (
        SELECT p.id, p.pareja_local_id, p.pareja_visitante_id 
        FROM partidos_zona p
        JOIN zonas z ON z.id = p.zona_id
        WHERE z.torneo_id = p_torneo_id AND p.estado = 'pendiente'
          AND (p.fecha_hora IS NULL OR p.cancha_asignada IS NULL)
    ) LOOP
        -- Insertar todos los sub-slots de franjas que AMBOS pueden jugar
        INSERT INTO temp_match_slots (partido_id, slot_dt, peso_restriccion)
        SELECT 
            v_partido.id,
            to_char(
                (v_fecha_inicio + (
                    CASE lower(f.dia_nombre)
                        WHEN 'lunes' THEN 0 WHEN 'martes' THEN 1 WHEN 'miércoles' THEN 2 WHEN 'jueves' THEN 3
                        WHEN 'viernes' THEN 4 WHEN 'sábado' THEN 5 WHEN 'domingo' THEN 6
                        ELSE 0
                    END
                ) - extract(isodow from v_fecha_inicio)::int + 1 + 
                CASE 
                    WHEN (CASE lower(f.dia_nombre) WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miércoles' THEN 3 WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sábado' THEN 6 WHEN 'domingo' THEN 7 END) < extract(isodow from v_fecha_inicio)::int 
                    THEN 7 ELSE 0 
                END
                )::date + s.slot_time, 
                'YYYY-MM-DD"T"HH24:MI:SS'
            ),
            1
        FROM torneo_franjas_horarias f
        CROSS JOIN generate_series(f.hora_inicio, f.hora_fin - v_duracion_partido, v_duracion_partido) AS s(slot_time)
        WHERE f.torneo_id = p_torneo_id
          AND (v_partido.pareja_local_id IS NULL OR EXISTS (SELECT 1 FROM inscripcion_disponibilidades id1 WHERE id1.inscripcion_id = v_partido.pareja_local_id AND id1.franja_id = f.id))
          AND (v_partido.pareja_visitante_id IS NULL OR EXISTS (SELECT 1 FROM inscripcion_disponibilidades id2 WHERE id2.inscripcion_id = v_partido.pareja_visitante_id AND id2.franja_id = f.id));
    END LOOP;

    -- Actualizar pesos: menos opciones -> peso más bajo (mayor prioridad)
    UPDATE temp_match_slots ms
    SET peso_restriccion = c.cnt
    FROM (SELECT partido_id, COUNT(*) as cnt FROM temp_match_slots GROUP BY partido_id) c
    WHERE ms.partido_id = c.partido_id;

    -- 3. Algoritmo Greedy: iterar partidos ordenados por prioridad (los más restringidos primero)
    FOR v_partido IN (
        SELECT partido_id, MIN(peso_restriccion) as opciones
        FROM temp_match_slots
        GROUP BY partido_id
        ORDER BY MIN(peso_restriccion) ASC
    ) LOOP
        v_assigned := false;

        -- Iterar sobre los slots posibles de este partido ordenados por fecha
        FOR v_slot IN (
            SELECT slot_dt FROM temp_match_slots WHERE partido_id = v_partido.partido_id ORDER BY slot_dt ASC
        ) LOOP
            -- Encontrar una cancha libre
            FOR c IN 1..v_canchas_disponibles LOOP
                v_cancha := 'Cancha ' || c;
                IF NOT EXISTS (SELECT 1 FROM temp_ocupacion WHERE fecha_hora = v_slot.slot_dt AND cancha_asignada = v_cancha) THEN
                    -- Cancha encontrada! Asignar y salir del loop de canchas
                    
                    -- Also check if any of the pairs is already playing at this exact time
                    IF NOT EXISTS (
                        SELECT 1 FROM partidos_zona pz WHERE pz.fecha_hora = v_slot.slot_dt 
                        AND (pz.pareja_local_id IN (SELECT pareja_local_id FROM partidos_zona WHERE id = v_partido.partido_id UNION SELECT pareja_visitante_id FROM partidos_zona WHERE id = v_partido.partido_id)
                             OR pz.pareja_visitante_id IN (SELECT pareja_local_id FROM partidos_zona WHERE id = v_partido.partido_id UNION SELECT pareja_visitante_id FROM partidos_zona WHERE id = v_partido.partido_id))
                    ) THEN
                        UPDATE partidos_zona 
                        SET fecha_hora = v_slot.slot_dt, cancha_asignada = v_cancha 
                        WHERE id = v_partido.partido_id;

                        INSERT INTO temp_ocupacion (fecha_hora, cancha_asignada) VALUES (v_slot.slot_dt, v_cancha);
                        v_assigned := true;
                        v_asignados := v_asignados + 1;
                        EXIT; -- salir del loop de canchas
                    END IF;
                END IF;
            END LOOP;
            
            IF v_assigned THEN
                EXIT; -- salir del loop de slots
            END IF;
        END LOOP;

        IF NOT v_assigned THEN
            v_no_asignados := v_no_asignados + 1;
        END IF;
    END LOOP;

    RETURN json_build_object('success', true, 'asignados', v_asignados, 'no_asignados', v_no_asignados);
END;
$$ LANGUAGE plpgsql;
