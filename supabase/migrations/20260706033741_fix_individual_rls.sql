-- Fix RLS para torneos americanos y asegurar la tabla jugadores

-- 1. torneo_individual_jugadores
DROP POLICY IF EXISTS "Cualquiera puede crear torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede actualizar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede eliminar torneo_individual_jugadores" ON public.torneo_individual_jugadores;

CREATE POLICY "Solo admins pueden insertar torneo_individual_jugadores" ON public.torneo_individual_jugadores
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden actualizar torneo_individual_jugadores" ON public.torneo_individual_jugadores
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden eliminar torneo_individual_jugadores" ON public.torneo_individual_jugadores
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. torneo_individual_fechas
DROP POLICY IF EXISTS "Cualquiera puede crear torneo_individual_fechas" ON public.torneo_individual_fechas;
DROP POLICY IF EXISTS "Cualquiera puede actualizar torneo_individual_fechas" ON public.torneo_individual_fechas;
DROP POLICY IF EXISTS "Cualquiera puede eliminar torneo_individual_fechas" ON public.torneo_individual_fechas;

CREATE POLICY "Solo admins pueden insertar torneo_individual_fechas" ON public.torneo_individual_fechas
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden actualizar torneo_individual_fechas" ON public.torneo_individual_fechas
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden eliminar torneo_individual_fechas" ON public.torneo_individual_fechas
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. torneo_individual_pagos
DROP POLICY IF EXISTS "Cualquiera puede crear torneo_individual_pagos" ON public.torneo_individual_pagos;
DROP POLICY IF EXISTS "Cualquiera puede actualizar torneo_individual_pagos" ON public.torneo_individual_pagos;
DROP POLICY IF EXISTS "Cualquiera puede eliminar torneo_individual_pagos" ON public.torneo_individual_pagos;

CREATE POLICY "Solo admins pueden insertar torneo_individual_pagos" ON public.torneo_individual_pagos
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden actualizar torneo_individual_pagos" ON public.torneo_individual_pagos
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden eliminar torneo_individual_pagos" ON public.torneo_individual_pagos
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. partidos_individuales
DROP POLICY IF EXISTS "Cualquiera puede crear partidos_individuales" ON public.partidos_individuales;
DROP POLICY IF EXISTS "Cualquiera puede actualizar partidos_individuales" ON public.partidos_individuales;
DROP POLICY IF EXISTS "Cualquiera puede eliminar partidos_individuales" ON public.partidos_individuales;

CREATE POLICY "Solo admins pueden insertar partidos_individuales" ON public.partidos_individuales
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden actualizar partidos_individuales" ON public.partidos_individuales
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden eliminar partidos_individuales" ON public.partidos_individuales
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. sets_partido_individual
DROP POLICY IF EXISTS "Cualquiera puede crear sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Cualquiera puede actualizar sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Cualquiera puede eliminar sets_partido_individual" ON public.sets_partido_individual;

CREATE POLICY "Solo admins pueden insertar sets_partido_individual" ON public.sets_partido_individual
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden actualizar sets_partido_individual" ON public.sets_partido_individual
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden eliminar sets_partido_individual" ON public.sets_partido_individual
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. torneo_individual_parejas
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.torneo_individual_parejas;

CREATE POLICY "Solo admins pueden insertar torneo_individual_parejas" ON public.torneo_individual_parejas
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden actualizar torneo_individual_parejas" ON public.torneo_individual_parejas
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admins pueden eliminar torneo_individual_parejas" ON public.torneo_individual_parejas
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Proteger la tabla jugadores (Evitar que usuarios auth vean mails/telefonos)
-- Modificamos la politica de SELECT
DROP POLICY IF EXISTS "Jugadores visibles para todos" ON public.jugadores;
CREATE POLICY "Admins ven todos los jugadores" ON public.jugadores
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Habilitamos tambien para que los anonimos puedan ver la vista de abajo.
-- Pero para que la vista funcione si el usuario no es admin, necesitamos que la vista sea SECURITY DEFINER.
-- Mejor aún, en vez de una vista, permitimos que el publico solo vea el nombre y apellido.
-- (Restricción de tabla jugadores pospuesta para otra iteración para no romper las vistas públicas)

-- 8. Función RPC para permitir la inscripción pública a torneos americanos saltando RLS (Security Definer)
CREATE OR REPLACE FUNCTION public.inscribir_americano_individual(
  p_torneo_id UUID,
  p_dni TEXT,
  p_nombre TEXT,
  p_apellido TEXT,
  p_telefono TEXT,
  p_email TEXT,
  p_club TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jugador_id UUID;
  v_ext_jugador RECORD;
  v_check_reg BOOLEAN;
  v_max_players INTEGER;
  v_current_players INTEGER;
  v_is_waiting_list BOOLEAN;
  v_canchas_count INTEGER;
BEGIN
  -- Buscar jugador por DNI
  SELECT * INTO v_ext_jugador FROM public.jugadores WHERE dni = p_dni LIMIT 1;
  
  IF FOUND THEN
    v_jugador_id := v_ext_jugador.id;
    -- Actualizar datos si cambiaron
    IF p_telefono != COALESCE(v_ext_jugador.telefono, '') OR 
       p_email != COALESCE(v_ext_jugador.email, '') OR 
       p_club != COALESCE(v_ext_jugador.club, '') THEN
       
       UPDATE public.jugadores 
       SET telefono = p_telefono, email = p_email, club = p_club
       WHERE id = v_jugador_id;
    END IF;
  ELSE
    -- Crear jugador nuevo
    INSERT INTO public.jugadores (dni, nombre, apellido, telefono, email, club)
    VALUES (p_dni, p_nombre, p_apellido, p_telefono, p_email, p_club)
    RETURNING id INTO v_jugador_id;
  END IF;

  -- Comprobar si ya está inscripto
  SELECT EXISTS(
    SELECT 1 FROM public.torneo_individual_jugadores 
    WHERE torneo_id = p_torneo_id AND jugador_id = v_jugador_id
  ) INTO v_check_reg;

  IF v_check_reg THEN
    RETURN json_build_object('ok', false, 'error', 'Ya estás registrado en este torneo');
  END IF;

  -- Determinar lista de espera
  SELECT canchas_count INTO v_canchas_count FROM public.torneos WHERE id = p_torneo_id;
  v_max_players := COALESCE(v_canchas_count, 3) * 4;
  
  SELECT COUNT(*) INTO v_current_players FROM public.torneo_individual_jugadores WHERE torneo_id = p_torneo_id;
  v_is_waiting_list := v_current_players >= v_max_players;

  -- Inscribir
  INSERT INTO public.torneo_individual_jugadores (torneo_id, jugador_id, estado)
  VALUES (p_torneo_id, v_jugador_id, CASE WHEN v_is_waiting_list THEN 'lista_espera' ELSE 'pendiente_pago' END);

  RETURN json_build_object(
    'ok', true, 
    'estado', CASE WHEN v_is_waiting_list THEN 'lista_espera' ELSE 'pendiente_pago' END,
    'jugador_id', v_jugador_id
  );
END;
$$;
