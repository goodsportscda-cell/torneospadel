-- Store exact court IDs per tournament. The legacy column stores only a count.
ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS canchas_asignadas INTEGER[];

UPDATE public.torneos
SET canchas_asignadas = ARRAY(
  SELECT generate_series(1, GREATEST(1, COALESCE(canchas_disponibles, 3)))
)
WHERE canchas_asignadas IS NULL;

ALTER TABLE public.torneos
  ALTER COLUMN canchas_asignadas SET DEFAULT ARRAY[1, 2, 3],
  ALTER COLUMN canchas_asignadas SET NOT NULL;

CREATE OR REPLACE FUNCTION public.asignar_horarios_inteligente(p_torneo_id UUID)
RETURNS JSON AS $$
DECLARE
    v_canchas_disponibles INT;
    v_canchas_asignadas INT[];
    v_fecha_inicio DATE;
    v_fecha_fin DATE;
    v_duracion_partido INTERVAL := '1 hour';
    v_partido RECORD;
    v_slot RECORD;
    v_asignados INT := 0;
    v_no_asignados INT := 0;
    v_cancha TEXT;
    v_cancha_id INT;
    v_assigned BOOLEAN;
BEGIN
    SELECT canchas_disponibles, canchas_asignadas, fecha_inicio, fecha_fin
    INTO v_canchas_disponibles, v_canchas_asignadas, v_fecha_inicio, v_fecha_fin
    FROM public.torneos
    WHERE id = p_torneo_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Torneo no encontrado');
    END IF;

    IF v_canchas_asignadas IS NULL OR cardinality(v_canchas_asignadas) = 0 THEN
        v_canchas_asignadas := ARRAY(
          SELECT generate_series(1, GREATEST(1, COALESCE(v_canchas_disponibles, 3)))
        );
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS temp_ocupacion (
        fecha_hora TIMESTAMPTZ,
        cancha TEXT
    ) ON COMMIT DROP;
    TRUNCATE temp_ocupacion;

    INSERT INTO temp_ocupacion (fecha_hora, cancha)
    SELECT fecha_hora, cancha FROM public.partidos_zona
    WHERE fecha_hora IS NOT NULL AND cancha IS NOT NULL;

    INSERT INTO temp_ocupacion (fecha_hora, cancha)
    SELECT fecha_hora, cancha FROM public.partidos_llave
    WHERE fecha_hora IS NOT NULL AND cancha IS NOT NULL;

    CREATE TEMP TABLE IF NOT EXISTS temp_match_slots (
        partido_id UUID,
        slot_dt TIMESTAMPTZ,
        peso_restriccion INT
    ) ON COMMIT DROP;
    TRUNCATE temp_match_slots;

    FOR v_partido IN (
        SELECT p.id, p.pareja_local_id, p.pareja_visitante_id
        FROM public.partidos_zona p
        JOIN public.zonas z ON z.id = p.zona_id
        WHERE z.torneo_id = p_torneo_id AND p.estado = 'pendiente'
          AND (p.fecha_hora IS NULL OR p.cancha IS NULL)
    ) LOOP
        INSERT INTO temp_match_slots (partido_id, slot_dt, peso_restriccion)
        SELECT
            v_partido.id,
            (
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
                )::date + s.slot_time
            )::timestamptz,
            1
        FROM public.torneo_franjas_horarias f
        CROSS JOIN generate_series(f.hora_inicio, f.hora_fin - v_duracion_partido, v_duracion_partido) AS s(slot_time)
        WHERE f.torneo_id = p_torneo_id
          AND (v_partido.pareja_local_id IS NULL OR EXISTS (
              SELECT 1 FROM public.inscripcion_disponibilidades d1
              WHERE d1.inscripcion_id = v_partido.pareja_local_id AND d1.franja_id = f.id
          ))
          AND (v_partido.pareja_visitante_id IS NULL OR EXISTS (
              SELECT 1 FROM public.inscripcion_disponibilidades d2
              WHERE d2.inscripcion_id = v_partido.pareja_visitante_id AND d2.franja_id = f.id
          ));
    END LOOP;

    UPDATE temp_match_slots ms
    SET peso_restriccion = counts.cnt
    FROM (
      SELECT partido_id, COUNT(*) AS cnt
      FROM temp_match_slots
      GROUP BY partido_id
    ) counts
    WHERE ms.partido_id = counts.partido_id;

    FOR v_partido IN (
        SELECT partido_id, MIN(peso_restriccion) AS opciones
        FROM temp_match_slots
        GROUP BY partido_id
        ORDER BY MIN(peso_restriccion) ASC
    ) LOOP
        v_assigned := false;

        FOR v_slot IN (
            SELECT slot_dt FROM temp_match_slots
            WHERE partido_id = v_partido.partido_id
            ORDER BY slot_dt ASC
        ) LOOP
            FOREACH v_cancha_id IN ARRAY v_canchas_asignadas LOOP
                v_cancha := 'Cancha ' || v_cancha_id;

                IF NOT EXISTS (
                    SELECT 1 FROM temp_ocupacion
                    WHERE fecha_hora = v_slot.slot_dt AND cancha = v_cancha
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM public.partidos_zona existing_match
                    WHERE existing_match.fecha_hora = v_slot.slot_dt
                      AND existing_match.id <> v_partido.partido_id
                      AND (
                        existing_match.pareja_local_id IN (
                          SELECT pareja_local_id FROM public.partidos_zona WHERE id = v_partido.partido_id
                          UNION
                          SELECT pareja_visitante_id FROM public.partidos_zona WHERE id = v_partido.partido_id
                        )
                        OR existing_match.pareja_visitante_id IN (
                          SELECT pareja_local_id FROM public.partidos_zona WHERE id = v_partido.partido_id
                          UNION
                          SELECT pareja_visitante_id FROM public.partidos_zona WHERE id = v_partido.partido_id
                        )
                      )
                ) THEN
                    UPDATE public.partidos_zona
                    SET fecha_hora = v_slot.slot_dt, cancha = v_cancha
                    WHERE id = v_partido.partido_id;

                    INSERT INTO temp_ocupacion (fecha_hora, cancha)
                    VALUES (v_slot.slot_dt, v_cancha);
                    v_assigned := true;
                    v_asignados := v_asignados + 1;
                    EXIT;
                END IF;
            END LOOP;

            IF v_assigned THEN EXIT; END IF;
        END LOOP;

        IF NOT v_assigned THEN
            v_no_asignados := v_no_asignados + 1;
        END IF;
    END LOOP;

    RETURN json_build_object('success', true, 'asignados', v_asignados, 'no_asignados', v_no_asignados);
END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp;
