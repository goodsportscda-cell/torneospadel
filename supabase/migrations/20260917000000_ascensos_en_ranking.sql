-- 1. Permitir null en torneo_id e inscripcion_id para los ascensos
ALTER TABLE public.ranking_jugadores ALTER COLUMN torneo_id DROP NOT NULL;
ALTER TABLE public.ranking_jugadores ALTER COLUMN inscripcion_id DROP NOT NULL;

-- 2. Modificar trg_ranking_ascensos_calc para que ignore los inserts/updates de 'ascenso' (evita loop infinito)
CREATE OR REPLACE FUNCTION public.trg_ranking_ascensos_calc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.instancia = 'ascenso' THEN RETURN OLD; END IF;
        PERFORM public.recalcular_ascenso_jugador(OLD.jugador_id);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.instancia = 'ascenso' THEN RETURN NEW; END IF;
        PERFORM public.recalcular_ascenso_jugador(NEW.jugador_id);
        IF OLD.jugador_id <> NEW.jugador_id THEN
            IF OLD.instancia <> 'ascenso' THEN
                PERFORM public.recalcular_ascenso_jugador(OLD.jugador_id);
            END IF;
        END IF;
        RETURN NEW;
    ELSE
        IF NEW.instancia = 'ascenso' THEN RETURN NEW; END IF;
        PERFORM public.recalcular_ascenso_jugador(NEW.jugador_id);
        RETURN NEW;
    END IF;
END;
$$;

-- 3. Modificar recalcular_ascenso_jugador para que inserte en ranking_jugadores
CREATE OR REPLACE FUNCTION public.recalcular_ascenso_jugador(p_jugador_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_ascenso RECORD;
    v_puntos_origen INT;
    v_puntos_transferidos INT;
    v_total_puntos_previos INT;
    v_genero_destino TEXT;
BEGIN
    -- Limpiamos los ascensos materializados actuales de este jugador (los re-crearemos)
    DELETE FROM public.ranking_jugadores 
    WHERE jugador_id = p_jugador_id 
      AND instancia = 'ascenso';

    -- Recorremos todos los ascensos del jugador en orden cronológico
    FOR r_ascenso IN 
        SELECT id, categoria_origen_id, categoria_destino_id, anio, created_at 
        FROM public.ascensos 
        WHERE jugador_id = p_jugador_id 
        ORDER BY created_at ASC
    LOOP
        -- 1. Sumamos los puntos puros ganados en la categoría origen ese año (ignorando los 'ascenso' para no doble-contar si leyeramos directo, 
        -- aunque los acabamos de borrar, es más seguro filtrarlo).
        SELECT COALESCE(SUM(puntos), 0) INTO v_puntos_origen
        FROM public.ranking_jugadores
        WHERE jugador_id = p_jugador_id
          AND categoria_id = r_ascenso.categoria_origen_id
          AND anio = r_ascenso.anio
          AND instancia <> 'ascenso';

        -- 2. Sumar puntos transferidos previamente HACIA esta categoría origen
        SELECT COALESCE(SUM(puntos_transferidos), 0) INTO v_total_puntos_previos
        FROM public.ascensos
        WHERE jugador_id = p_jugador_id
          AND categoria_destino_id = r_ascenso.categoria_origen_id
          AND anio = r_ascenso.anio
          AND created_at < r_ascenso.created_at;

        v_puntos_origen := v_puntos_origen + v_total_puntos_previos;
        v_puntos_transferidos := FLOOR(v_puntos_origen / 2);

        -- 3. Actualizamos el registro de ascenso
        UPDATE public.ascensos
        SET puntos_origen = v_puntos_origen,
            puntos_transferidos = v_puntos_transferidos
        WHERE id = r_ascenso.id;

        -- 4. Inyectamos el ascenso en ranking_jugadores para que el frontend lo trate como puntos naturales
        SELECT genero INTO v_genero_destino FROM public.categorias WHERE id = r_ascenso.categoria_destino_id;
        
        INSERT INTO public.ranking_jugadores (jugador_id, categoria_id, anio, puntos, instancia, genero)
        VALUES (
            p_jugador_id, 
            r_ascenso.categoria_destino_id, 
            r_ascenso.anio, 
            v_puntos_transferidos, 
            'ascenso', 
            v_genero_destino
        );
    END LOOP;
END;
$$;

-- 4. Modificar trg_ascensos_calc_init (opcional, pero lo dejamos coherente para BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.trg_ascensos_calc_init()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_puntos_origen INT;
    v_puntos_transferidos INT;
    v_total_puntos_previos INT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT COALESCE(SUM(puntos), 0) INTO v_puntos_origen
        FROM public.ranking_jugadores
        WHERE jugador_id = NEW.jugador_id
          AND categoria_id = NEW.categoria_origen_id
          AND anio = NEW.anio
          AND instancia <> 'ascenso';

        SELECT COALESCE(SUM(puntos_transferidos), 0) INTO v_total_puntos_previos
        FROM public.ascensos
        WHERE jugador_id = NEW.jugador_id
          AND categoria_destino_id = NEW.categoria_origen_id
          AND anio = NEW.anio
          AND created_at < NOW();

        NEW.puntos_origen := v_puntos_origen + v_total_puntos_previos;
        NEW.puntos_transferidos := FLOOR(NEW.puntos_origen / 2);
    END IF;
    RETURN NEW;
END;
$$;

-- 5. Trigger AFTER INSERT para que se dispare el volcado a ranking_jugadores de inmediato (si es necesario)
CREATE OR REPLACE FUNCTION public.trg_ascensos_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.recalcular_ascenso_jugador(NEW.jugador_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ascensos_after_insert_trigger ON public.ascensos;
CREATE TRIGGER ascensos_after_insert_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.ascensos
FOR EACH ROW
EXECUTE FUNCTION public.trg_ascensos_after_insert();

-- 6. Ejecutar el recálculo masivo para materializar los ascensos existentes
DO $$
DECLARE
    r_jugador RECORD;
BEGIN
    FOR r_jugador IN 
        SELECT DISTINCT jugador_id FROM public.ascensos
    LOOP
        PERFORM public.recalcular_ascenso_jugador(r_jugador.jugador_id);
    END LOOP;
END;
$$;
