-- Migración para propagación automática en cascada de zonas de 4 (Ganadores y Perdedores)
-- y función para recálculo dinámico.

-- 1. Función reutilizable para recalcular y sincronizar cruces de Ganadores y Perdedores en una zona de 4
CREATE OR REPLACE FUNCTION public.recalcular_cruces_zona_4(p_zona_id UUID)
RETURNS void AS $$
DECLARE
  v_m1 RECORD;
  v_m2 RECORD;
  v_m1_ganador UUID := NULL;
  v_m1_perdedor UUID := NULL;
  v_m2_ganador UUID := NULL;
  v_m2_perdedor UUID := NULL;
BEGIN
  -- Obtener datos de Partido 1 y Partido 2 de la zona
  SELECT * INTO v_m1 FROM public.partidos_zona WHERE zona_id = p_zona_id AND orden = 1 LIMIT 1;
  SELECT * INTO v_m2 FROM public.partidos_zona WHERE zona_id = p_zona_id AND orden = 2 LIMIT 1;

  -- Ganador y perdedor de Partido 1
  IF v_m1.id IS NOT NULL AND v_m1.estado = 'finalizado' AND v_m1.ganador_id IS NOT NULL THEN
    v_m1_ganador := v_m1.ganador_id;
    v_m1_perdedor := CASE 
      WHEN v_m1.ganador_id = v_m1.pareja_local_id THEN v_m1.pareja_visitante_id 
      ELSE v_m1.pareja_local_id 
    END;
  END IF;

  -- Ganador y perdedor de Partido 2
  IF v_m2.id IS NOT NULL AND v_m2.estado = 'finalizado' AND v_m2.ganador_id IS NOT NULL THEN
    v_m2_ganador := v_m2.ganador_id;
    v_m2_perdedor := CASE 
      WHEN v_m2.ganador_id = v_m2.pareja_local_id THEN v_m2.pareja_visitante_id 
      ELSE v_m2.pareja_local_id 
    END;
  END IF;

  -- Actualizar Partido de Ganadores (orden 3 o tipo = 'ganadores')
  UPDATE public.partidos_zona
  SET pareja_local_id = v_m1_ganador,
      pareja_visitante_id = v_m2_ganador,
      -- Limpiar ganador_id y estado si el ganador anterior ya no pertenece a este partido
      ganador_id = CASE 
        WHEN ganador_id IS NOT NULL AND ganador_id NOT IN (COALESCE(v_m1_ganador, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_m2_ganador, '00000000-0000-0000-0000-000000000000'::uuid)) THEN NULL 
        ELSE ganador_id 
      END,
      estado = CASE 
        WHEN ganador_id IS NOT NULL AND ganador_id NOT IN (COALESCE(v_m1_ganador, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_m2_ganador, '00000000-0000-0000-0000-000000000000'::uuid)) THEN 'pendiente'::public.estado_partido 
        ELSE estado 
      END
  WHERE zona_id = p_zona_id AND (tipo = 'ganadores' OR orden = 3);

  -- Actualizar Partido de Perdedores (orden 4 o tipo = 'perdedores')
  UPDATE public.partidos_zona
  SET pareja_local_id = v_m1_perdedor,
      pareja_visitante_id = v_m2_perdedor,
      -- Limpiar ganador_id y estado si el ganador anterior ya no pertenece a este partido
      ganador_id = CASE 
        WHEN ganador_id IS NOT NULL AND ganador_id NOT IN (COALESCE(v_m1_perdedor, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_m2_perdedor, '00000000-0000-0000-0000-000000000000'::uuid)) THEN NULL 
        ELSE ganador_id 
      END,
      estado = CASE 
        WHEN ganador_id IS NOT NULL AND ganador_id NOT IN (COALESCE(v_m1_perdedor, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_m2_perdedor, '00000000-0000-0000-0000-000000000000'::uuid)) THEN 'pendiente'::public.estado_partido 
        ELSE estado 
      END
  WHERE zona_id = p_zona_id AND (tipo = 'perdedores' OR orden = 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para que la función pueda ser invocada por autenticados y operadores
GRANT EXECUTE ON FUNCTION public.recalcular_cruces_zona_4(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_cruces_zona_4(UUID) TO anon;

-- 2. Función Trigger que vigila cambios en partidos de orden 1 y 2
CREATE OR REPLACE FUNCTION public.propagar_ganadores_perdedores_zona()
RETURNS TRIGGER AS $$
DECLARE
  v_tamanio INTEGER;
BEGIN
  -- Evitar recursión
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Solo actuar si el partido que cambió es de orden 1 o 2
  IF NEW.orden NOT IN (1, 2) THEN
    RETURN NEW;
  END IF;

  -- Verificar si la zona es de tamaño 4
  SELECT tamanio INTO v_tamanio FROM public.zonas WHERE id = NEW.zona_id;
  IF v_tamanio IS DISTINCT FROM 4 THEN
    RETURN NEW;
  END IF;

  PERFORM public.recalcular_cruces_zona_4(NEW.zona_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger en public.partidos_zona
DROP TRIGGER IF EXISTS trg_propagar_ganadores_perdedores_zona ON public.partidos_zona;

CREATE TRIGGER trg_propagar_ganadores_perdedores_zona
AFTER UPDATE OF ganador_id, estado, pareja_local_id, pareja_visitante_id ON public.partidos_zona
FOR EACH ROW
EXECUTE FUNCTION public.propagar_ganadores_perdedores_zona();

-- 4. Auto-reparación inmediata de todas las zonas de 4 existentes en la base de datos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.zonas WHERE tamanio = 4 LOOP
    PERFORM public.recalcular_cruces_zona_4(r.id);
  END LOOP;
END;
$$;
