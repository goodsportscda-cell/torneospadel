-- Función principal del motor de cálculo que recalcula dinámicamente
-- los puntos de origen y transferidos de los ascensos de un jugador.
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
BEGIN
    -- Recorremos todos los ascensos del jugador en orden cronológico (para manejar ascensos en cadena en un mismo año)
    FOR r_ascenso IN 
        SELECT id, categoria_origen_id, anio 
        FROM public.ascensos 
        WHERE jugador_id = p_jugador_id 
        ORDER BY created_at ASC
    LOOP
        -- 1. Sumamos los puntos puros ganados en la categoría origen ese año
        SELECT COALESCE(SUM(puntos), 0) INTO v_puntos_origen
        FROM public.ranking_jugadores
        WHERE jugador_id = p_jugador_id
          AND categoria_id = r_ascenso.categoria_origen_id
          AND anio = r_ascenso.anio;

        -- 2. Si el jugador tuvo un ascenso PREVIO que transfirió puntos HACIA esta categoría origen, debemos sumarlos.
        SELECT COALESCE(SUM(puntos_transferidos), 0) INTO v_total_puntos_previos
        FROM public.ascensos
        WHERE jugador_id = p_jugador_id
          AND categoria_destino_id = r_ascenso.categoria_origen_id
          AND anio = r_ascenso.anio
          AND created_at < (SELECT created_at FROM public.ascensos WHERE id = r_ascenso.id);

        v_puntos_origen := v_puntos_origen + v_total_puntos_previos;
        v_puntos_transferidos := FLOOR(v_puntos_origen / 2);

        -- 3. Actualizamos el registro de ascenso dinámicamente
        UPDATE public.ascensos
        SET puntos_origen = v_puntos_origen,
            puntos_transferidos = v_puntos_transferidos
        WHERE id = r_ascenso.id;
    END LOOP;
END;
$$;

-- Trigger para ranking_jugadores: cuando insertan, modifican o borran puntos, recalcular.
CREATE OR REPLACE FUNCTION public.trg_ranking_ascensos_calc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.recalcular_ascenso_jugador(OLD.jugador_id);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.recalcular_ascenso_jugador(NEW.jugador_id);
        IF OLD.jugador_id <> NEW.jugador_id THEN
            PERFORM public.recalcular_ascenso_jugador(OLD.jugador_id);
        END IF;
        RETURN NEW;
    ELSE
        PERFORM public.recalcular_ascenso_jugador(NEW.jugador_id);
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS ranking_ascensos_trigger ON public.ranking_jugadores;
CREATE TRIGGER ranking_ascensos_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.ranking_jugadores
FOR EACH ROW
EXECUTE FUNCTION public.trg_ranking_ascensos_calc();

-- Trigger para ascensos: cuando insertan un ascenso, forzar cálculo inicial.
CREATE OR REPLACE FUNCTION public.trg_ascensos_calc_init()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Como la fila se está insertando, deferir la lógica principal podría ser riesgoso en BEFORE.
        -- Lo hacemos aquí en BEFORE calculando manualmente o dejamos que un AFTER trigger lo haga.
        -- Mejor hacer el cálculo al vuelo en BEFORE INSERT:
        
        DECLARE
            v_puntos_origen INT;
            v_puntos_transferidos INT;
            v_total_puntos_previos INT;
        BEGIN
            SELECT COALESCE(SUM(puntos), 0) INTO v_puntos_origen
            FROM public.ranking_jugadores
            WHERE jugador_id = NEW.jugador_id
              AND categoria_id = NEW.categoria_origen_id
              AND anio = NEW.anio;

            SELECT COALESCE(SUM(puntos_transferidos), 0) INTO v_total_puntos_previos
            FROM public.ascensos
            WHERE jugador_id = NEW.jugador_id
              AND categoria_destino_id = NEW.categoria_origen_id
              AND anio = NEW.anio
              -- Solo importan los creados antes (en caso de que sean importados históricamente)
              AND created_at < NOW();

            NEW.puntos_origen := v_puntos_origen + v_total_puntos_previos;
            NEW.puntos_transferidos := FLOOR(NEW.puntos_origen / 2);
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ascensos_calc_init_trigger ON public.ascensos;
CREATE TRIGGER ascensos_calc_init_trigger
BEFORE INSERT ON public.ascensos
FOR EACH ROW
EXECUTE FUNCTION public.trg_ascensos_calc_init();


-- Saneamiento: Recalcular a TODOS los jugadores con ascensos existentes
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
