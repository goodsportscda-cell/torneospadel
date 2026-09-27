-- Scope tournament mutations to staff assigned to that tournament's club.
-- Also keep individual tournament payment records private.

-- Give public scoreboards a safe player directory without exposing DNI,
-- phone, email, notes, or account-linked fields from the base table.
CREATE OR REPLACE VIEW public.jugadores_publicos
WITH (security_barrier = true)
AS
SELECT id, nombre, apellido, genero, categoria_id, club
FROM public.jugadores;

REVOKE ALL ON public.jugadores_publicos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.jugadores_publicos TO anon, authenticated;

-- Individual tournament payment records must not be exposed to anonymous users.
DROP POLICY IF EXISTS "Torneo ind pagos visibles para todos" ON public.torneo_individual_pagos;
DROP POLICY IF EXISTS "Solo admins pueden insertar torneo_individual_pagos" ON public.torneo_individual_pagos;
DROP POLICY IF EXISTS "Solo admins pueden actualizar torneo_individual_pagos" ON public.torneo_individual_pagos;
DROP POLICY IF EXISTS "Solo admins pueden eliminar torneo_individual_pagos" ON public.torneo_individual_pagos;
DROP POLICY IF EXISTS "Cualquiera puede crear torneo_individual_pagos" ON public.torneo_individual_pagos;
DROP POLICY IF EXISTS "Cualquiera puede actualizar torneo_individual_pagos" ON public.torneo_individual_pagos;
DROP POLICY IF EXISTS "Cualquiera puede eliminar torneo_individual_pagos" ON public.torneo_individual_pagos;

CREATE POLICY "Staff autorizado lee pagos de torneo individual"
ON public.torneo_individual_pagos FOR SELECT TO authenticated
USING (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado crea pagos de torneo individual"
ON public.torneo_individual_pagos FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado actualiza pagos de torneo individual"
ON public.torneo_individual_pagos FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado elimina pagos de torneo individual"
ON public.torneo_individual_pagos FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

-- Registrations in individual tournaments.
DROP POLICY IF EXISTS "Solo admins pueden insertar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Solo admins pueden actualizar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Solo admins pueden eliminar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Operadores pueden insertar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Operadores pueden actualizar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Operadores pueden eliminar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede crear torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede actualizar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede eliminar torneo_individual_jugadores" ON public.torneo_individual_jugadores;

CREATE POLICY "Staff autorizado crea jugadores de torneo individual"
ON public.torneo_individual_jugadores FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado actualiza jugadores de torneo individual"
ON public.torneo_individual_jugadores FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado elimina jugadores de torneo individual"
ON public.torneo_individual_jugadores FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

-- The player dashboard can enroll only the ficha linked to the signed-in user.
-- Keep the existing quick-enroll behavior while removing direct public writes.
CREATE OR REPLACE FUNCTION public.inscribir_mi_americano_individual(p_torneo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_jugador_id UUID;
  v_canchas_count INTEGER;
  v_current_players INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Iniciá sesión para inscribirte');
  END IF;

  SELECT p.jugador_id INTO v_jugador_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id AND p.jugador_id IS NOT NULL;

  IF v_jugador_id IS NULL THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Primero verificá y vinculá tu ficha de jugador');
  END IF;

  SELECT t.canchas_count INTO v_canchas_count
  FROM public.torneos t
  WHERE t.id = p_torneo_id
    AND t.tipo = 'americano_individual'
    AND t.estado = 'inscripciones_abiertas'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'El torneo no existe o no tiene las inscripciones abiertas');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.torneo_individual_jugadores tij
    WHERE tij.torneo_id = p_torneo_id AND tij.jugador_id = v_jugador_id
  ) THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Ya estás inscrito en este torneo');
  END IF;

  SELECT COUNT(*) INTO v_current_players
  FROM public.torneo_individual_jugadores tij
  WHERE tij.torneo_id = p_torneo_id;

  INSERT INTO public.torneo_individual_jugadores (torneo_id, jugador_id, estado)
  VALUES (
    p_torneo_id,
    v_jugador_id,
    CASE WHEN v_current_players >= COALESCE(v_canchas_count, 3) * 4
      THEN 'lista_espera' ELSE 'confirmada' END
  );

  RETURN pg_catalog.json_build_object(
    'ok', true,
    'estado', CASE WHEN v_current_players >= COALESCE(v_canchas_count, 3) * 4
      THEN 'lista_espera' ELSE 'confirmada' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.inscribir_mi_americano_individual(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inscribir_mi_americano_individual(UUID) TO authenticated;

-- Tournament dates and fixed pairs.
DROP POLICY IF EXISTS "Solo admins pueden insertar torneo_individual_fechas" ON public.torneo_individual_fechas;
DROP POLICY IF EXISTS "Solo admins pueden actualizar torneo_individual_fechas" ON public.torneo_individual_fechas;
DROP POLICY IF EXISTS "Solo admins pueden eliminar torneo_individual_fechas" ON public.torneo_individual_fechas;
DROP POLICY IF EXISTS "Cualquiera puede crear torneo_individual_fechas" ON public.torneo_individual_fechas;
DROP POLICY IF EXISTS "Cualquiera puede actualizar torneo_individual_fechas" ON public.torneo_individual_fechas;
DROP POLICY IF EXISTS "Cualquiera puede eliminar torneo_individual_fechas" ON public.torneo_individual_fechas;
CREATE POLICY "Staff autorizado crea fechas de torneo individual"
ON public.torneo_individual_fechas FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado actualiza fechas de torneo individual"
ON public.torneo_individual_fechas FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado elimina fechas de torneo individual"
ON public.torneo_individual_fechas FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

DROP POLICY IF EXISTS "Solo admins pueden insertar torneo_individual_parejas" ON public.torneo_individual_parejas;
DROP POLICY IF EXISTS "Solo admins pueden actualizar torneo_individual_parejas" ON public.torneo_individual_parejas;
DROP POLICY IF EXISTS "Solo admins pueden eliminar torneo_individual_parejas" ON public.torneo_individual_parejas;
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.torneo_individual_parejas;
CREATE POLICY "Staff autorizado crea parejas de torneo individual"
ON public.torneo_individual_parejas FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado actualiza parejas de torneo individual"
ON public.torneo_individual_parejas FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado elimina parejas de torneo individual"
ON public.torneo_individual_parejas FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

-- Tournament-zone and bracket records. Public SELECT policies remain intact.
DROP POLICY IF EXISTS "Solo admins crean zonas" ON public.zonas;
DROP POLICY IF EXISTS "Solo admins actualizan zonas" ON public.zonas;
DROP POLICY IF EXISTS "Solo admins eliminan zonas" ON public.zonas;
DROP POLICY IF EXISTS "Cualquiera puede crear zonas (pre-auth)" ON public.zonas;
DROP POLICY IF EXISTS "Cualquiera puede actualizar zonas (pre-auth)" ON public.zonas;
DROP POLICY IF EXISTS "Cualquiera puede eliminar zonas (pre-auth)" ON public.zonas;
CREATE POLICY "Staff autorizado crea zonas del torneo"
ON public.zonas FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado actualiza zonas del torneo"
ON public.zonas FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado elimina zonas del torneo"
ON public.zonas FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

DROP POLICY IF EXISTS "Solo admins crean zonas_parejas" ON public.zonas_parejas;
DROP POLICY IF EXISTS "Solo admins actualizan zonas_parejas" ON public.zonas_parejas;
DROP POLICY IF EXISTS "Solo admins eliminan zonas_parejas" ON public.zonas_parejas;
DROP POLICY IF EXISTS "Cualquiera puede crear zonas_parejas (pre-auth)" ON public.zonas_parejas;
DROP POLICY IF EXISTS "Cualquiera puede actualizar zonas_parejas (pre-auth)" ON public.zonas_parejas;
DROP POLICY IF EXISTS "Cualquiera puede eliminar zonas_parejas (pre-auth)" ON public.zonas_parejas;
CREATE POLICY "Staff autorizado crea parejas de zona"
ON public.zonas_parejas FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.zonas z
    WHERE z.id = zona_id AND public.can_manage_tournament(z.torneo_id)
  )
  AND EXISTS (
    SELECT 1 FROM public.inscripciones i
    WHERE i.id = inscripcion_id AND public.can_manage_tournament(i.torneo_id)
  )
);
CREATE POLICY "Staff autorizado actualiza parejas de zona"
ON public.zonas_parejas FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.zonas z
  WHERE z.id = zona_id AND public.can_manage_tournament(z.torneo_id)
))
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.zonas z
    WHERE z.id = zona_id AND public.can_manage_tournament(z.torneo_id)
  )
  AND EXISTS (
    SELECT 1 FROM public.inscripciones i
    WHERE i.id = inscripcion_id AND public.can_manage_tournament(i.torneo_id)
  )
);
CREATE POLICY "Staff autorizado elimina parejas de zona"
ON public.zonas_parejas FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.zonas z
  WHERE z.id = zona_id AND public.can_manage_tournament(z.torneo_id)
));

DROP POLICY IF EXISTS "Solo admins crean llaves" ON public.llaves;
DROP POLICY IF EXISTS "Solo admins actualizan llaves" ON public.llaves;
DROP POLICY IF EXISTS "Solo admins eliminan llaves" ON public.llaves;
DROP POLICY IF EXISTS "Cualquiera puede crear llaves (pre-auth)" ON public.llaves;
DROP POLICY IF EXISTS "Cualquiera puede actualizar llaves (pre-auth)" ON public.llaves;
DROP POLICY IF EXISTS "Cualquiera puede eliminar llaves (pre-auth)" ON public.llaves;
CREATE POLICY "Staff autorizado crea llaves"
ON public.llaves FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado actualiza llaves"
ON public.llaves FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado elimina llaves"
ON public.llaves FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

DROP POLICY IF EXISTS "Solo admins crean partidos_zona" ON public.partidos_zona;
DROP POLICY IF EXISTS "Solo admins actualizan partidos_zona" ON public.partidos_zona;
DROP POLICY IF EXISTS "Solo admins eliminan partidos_zona" ON public.partidos_zona;
DROP POLICY IF EXISTS "Cualquiera puede crear partidos_zona (pre-auth)" ON public.partidos_zona;
DROP POLICY IF EXISTS "Cualquiera puede actualizar partidos_zona (pre-auth)" ON public.partidos_zona;
DROP POLICY IF EXISTS "Cualquiera puede eliminar partidos_zona (pre-auth)" ON public.partidos_zona;
DROP POLICY IF EXISTS "Operadores pueden actualizar partidos_zona" ON public.partidos_zona;
CREATE POLICY "Staff autorizado crea partidos de zona"
ON public.partidos_zona FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.zonas z
  WHERE z.id = zona_id AND public.can_manage_tournament(z.torneo_id)
));
CREATE POLICY "Staff autorizado actualiza partidos de zona"
ON public.partidos_zona FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.zonas z
  WHERE z.id = zona_id AND public.can_manage_tournament(z.torneo_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.zonas z
  WHERE z.id = zona_id AND public.can_manage_tournament(z.torneo_id)
));
CREATE POLICY "Staff autorizado elimina partidos de zona"
ON public.partidos_zona FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.zonas z
  WHERE z.id = zona_id AND public.can_manage_tournament(z.torneo_id)
));

DROP POLICY IF EXISTS "Solo admins crean partidos_llave" ON public.partidos_llave;
DROP POLICY IF EXISTS "Solo admins actualizan partidos_llave" ON public.partidos_llave;
DROP POLICY IF EXISTS "Solo admins eliminan partidos_llave" ON public.partidos_llave;
DROP POLICY IF EXISTS "Cualquiera puede crear partidos_llave (pre-auth)" ON public.partidos_llave;
DROP POLICY IF EXISTS "Cualquiera puede actualizar partidos_llave (pre-auth)" ON public.partidos_llave;
DROP POLICY IF EXISTS "Cualquiera puede eliminar partidos_llave (pre-auth)" ON public.partidos_llave;
DROP POLICY IF EXISTS "Operadores pueden actualizar partidos_llave" ON public.partidos_llave;
CREATE POLICY "Staff autorizado crea partidos de llave"
ON public.partidos_llave FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.llaves l
  WHERE l.id = llave_id AND public.can_manage_tournament(l.torneo_id)
));
CREATE POLICY "Staff autorizado actualiza partidos de llave"
ON public.partidos_llave FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.llaves l
  WHERE l.id = llave_id AND public.can_manage_tournament(l.torneo_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.llaves l
  WHERE l.id = llave_id AND public.can_manage_tournament(l.torneo_id)
));
CREATE POLICY "Staff autorizado elimina partidos de llave"
ON public.partidos_llave FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.llaves l
  WHERE l.id = llave_id AND public.can_manage_tournament(l.torneo_id)
));

DROP POLICY IF EXISTS "Solo admins crean partidos_individuales" ON public.partidos_individuales;
DROP POLICY IF EXISTS "Solo admins actualizan partidos_individuales" ON public.partidos_individuales;
DROP POLICY IF EXISTS "Solo admins eliminan partidos_individuales" ON public.partidos_individuales;
DROP POLICY IF EXISTS "Cualquiera puede crear partidos_individuales" ON public.partidos_individuales;
DROP POLICY IF EXISTS "Cualquiera puede actualizar partidos_individuales" ON public.partidos_individuales;
DROP POLICY IF EXISTS "Cualquiera puede eliminar partidos_individuales" ON public.partidos_individuales;
DROP POLICY IF EXISTS "Operadores pueden actualizar partidos_individuales" ON public.partidos_individuales;
CREATE POLICY "Staff autorizado crea partidos individuales"
ON public.partidos_individuales FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado actualiza partidos individuales"
ON public.partidos_individuales FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));
CREATE POLICY "Staff autorizado elimina partidos individuales"
ON public.partidos_individuales FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

DROP POLICY IF EXISTS "Solo admins crean sets" ON public.sets_partido;
DROP POLICY IF EXISTS "Solo admins actualizan sets" ON public.sets_partido;
DROP POLICY IF EXISTS "Solo admins eliminan sets" ON public.sets_partido;
DROP POLICY IF EXISTS "Cualquiera puede crear sets (pre-auth)" ON public.sets_partido;
DROP POLICY IF EXISTS "Cualquiera puede actualizar sets (pre-auth)" ON public.sets_partido;
DROP POLICY IF EXISTS "Cualquiera puede eliminar sets (pre-auth)" ON public.sets_partido;
DROP POLICY IF EXISTS "Operadores pueden insertar sets_partido" ON public.sets_partido;
DROP POLICY IF EXISTS "Operadores pueden actualizar sets_partido" ON public.sets_partido;
DROP POLICY IF EXISTS "Operadores pueden eliminar sets_partido" ON public.sets_partido;
CREATE POLICY "Staff autorizado crea sets de zona"
ON public.sets_partido FOR INSERT TO authenticated
WITH CHECK (
  (partido_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partidos_zona p
    JOIN public.zonas z ON z.id = p.zona_id
    WHERE p.id = partido_id AND public.can_manage_tournament(z.torneo_id)
  ))
  OR (partido_llave_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partidos_llave p
    JOIN public.llaves l ON l.id = p.llave_id
    WHERE p.id = partido_llave_id AND public.can_manage_tournament(l.torneo_id)
  ))
);
CREATE POLICY "Staff autorizado actualiza sets de zona"
ON public.sets_partido FOR UPDATE TO authenticated
USING (
  (partido_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partidos_zona p
    JOIN public.zonas z ON z.id = p.zona_id
    WHERE p.id = partido_id AND public.can_manage_tournament(z.torneo_id)
  ))
  OR (partido_llave_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partidos_llave p
    JOIN public.llaves l ON l.id = p.llave_id
    WHERE p.id = partido_llave_id AND public.can_manage_tournament(l.torneo_id)
  ))
)
WITH CHECK (
  (partido_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partidos_zona p
    JOIN public.zonas z ON z.id = p.zona_id
    WHERE p.id = partido_id AND public.can_manage_tournament(z.torneo_id)
  ))
  OR (partido_llave_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partidos_llave p
    JOIN public.llaves l ON l.id = p.llave_id
    WHERE p.id = partido_llave_id AND public.can_manage_tournament(l.torneo_id)
  ))
);
CREATE POLICY "Staff autorizado elimina sets de zona"
ON public.sets_partido FOR DELETE TO authenticated
USING (
  (partido_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partidos_zona p
    JOIN public.zonas z ON z.id = p.zona_id
    WHERE p.id = partido_id AND public.can_manage_tournament(z.torneo_id)
  ))
  OR (partido_llave_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partidos_llave p
    JOIN public.llaves l ON l.id = p.llave_id
    WHERE p.id = partido_llave_id AND public.can_manage_tournament(l.torneo_id)
  ))
);

DROP POLICY IF EXISTS "Solo admins pueden insertar sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Solo admins pueden actualizar sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Solo admins pueden eliminar sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Cualquiera puede crear sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Cualquiera puede actualizar sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Cualquiera puede eliminar sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Operadores pueden insertar sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Operadores pueden actualizar sets_partido_individual" ON public.sets_partido_individual;
DROP POLICY IF EXISTS "Operadores pueden eliminar sets_partido_individual" ON public.sets_partido_individual;
CREATE POLICY "Staff autorizado crea sets individuales"
ON public.sets_partido_individual FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.partidos_individuales p
  WHERE p.id = partido_individual_id AND public.can_manage_tournament(p.torneo_id)
));
CREATE POLICY "Staff autorizado actualiza sets individuales"
ON public.sets_partido_individual FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.partidos_individuales p
  WHERE p.id = partido_individual_id AND public.can_manage_tournament(p.torneo_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.partidos_individuales p
  WHERE p.id = partido_individual_id AND public.can_manage_tournament(p.torneo_id)
));
CREATE POLICY "Staff autorizado elimina sets individuales"
ON public.sets_partido_individual FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.partidos_individuales p
  WHERE p.id = partido_individual_id AND public.can_manage_tournament(p.torneo_id)
));

-- Public registration must not let a caller overwrite an existing player's
-- contact details by supplying that player's DNI, and must honor tournament state.
CREATE OR REPLACE FUNCTION public.inscribir_americano_individual(
  p_torneo_id UUID,
  p_dni TEXT,
  p_nombre TEXT,
  p_apellido TEXT,
  p_telefono TEXT,
  p_email TEXT,
  p_club TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jugador_id UUID;
  v_ext_jugador RECORD;
  v_max_players INTEGER;
  v_current_players INTEGER;
  v_is_waiting_list BOOLEAN;
  v_canchas_count INTEGER;
  v_dni_normalizado TEXT;
BEGIN
  v_dni_normalizado := pg_catalog.regexp_replace(COALESCE(p_dni, ''), '[^0-9]', '', 'g');
  IF pg_catalog.length(v_dni_normalizado) NOT BETWEEN 6 AND 12
     OR pg_catalog.btrim(COALESCE(p_nombre, '')) = ''
     OR pg_catalog.btrim(COALESCE(p_apellido, '')) = '' THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Revisá el DNI, nombre y apellido ingresados');
  END IF;

  -- Lock the tournament row so concurrent registrations cannot overfill it.
  SELECT t.canchas_count INTO v_canchas_count
  FROM public.torneos AS t
  WHERE t.id = p_torneo_id
    AND t.tipo = 'americano_individual'
    AND t.estado = 'inscripciones_abiertas'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'El torneo no existe o no tiene las inscripciones abiertas');
  END IF;

  SELECT j.id, j.nombre, j.apellido INTO v_ext_jugador
  FROM public.jugadores AS j
  WHERE pg_catalog.regexp_replace(COALESCE(j.dni, ''), '[^0-9]', '', 'g') = v_dni_normalizado
  LIMIT 1;

  IF FOUND THEN
    -- A public form is not proof of identity. Keep existing personal data intact.
    IF pg_catalog.lower(pg_catalog.btrim(COALESCE(v_ext_jugador.nombre, ''))) <>
         pg_catalog.lower(pg_catalog.btrim(p_nombre))
       OR pg_catalog.lower(pg_catalog.btrim(COALESCE(v_ext_jugador.apellido, ''))) <>
         pg_catalog.lower(pg_catalog.btrim(p_apellido)) THEN
      RETURN pg_catalog.json_build_object('ok', false, 'error', 'Los datos no coinciden con la ficha existente. Contactá al club para validar la inscripción');
    END IF;
    v_jugador_id := v_ext_jugador.id;
  ELSE
    INSERT INTO public.jugadores (dni, nombre, apellido, telefono, email, club)
    VALUES (v_dni_normalizado, pg_catalog.btrim(p_nombre), pg_catalog.btrim(p_apellido),
            NULLIF(pg_catalog.btrim(COALESCE(p_telefono, '')), ''),
            NULLIF(pg_catalog.btrim(COALESCE(p_email, '')), ''),
            NULLIF(pg_catalog.btrim(COALESCE(p_club, '')), ''))
    RETURNING id INTO v_jugador_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.torneo_individual_jugadores AS tij
    WHERE tij.torneo_id = p_torneo_id AND tij.jugador_id = v_jugador_id
  ) THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Ya estás registrado en este torneo');
  END IF;

  v_max_players := COALESCE(v_canchas_count, 3) * 4;
  SELECT COUNT(*) INTO v_current_players
  FROM public.torneo_individual_jugadores AS tij
  WHERE tij.torneo_id = p_torneo_id;
  v_is_waiting_list := v_current_players >= v_max_players;

  INSERT INTO public.torneo_individual_jugadores (torneo_id, jugador_id, estado)
  VALUES (p_torneo_id, v_jugador_id,
          CASE WHEN v_is_waiting_list THEN 'lista_espera' ELSE 'pendiente_pago' END);

  RETURN pg_catalog.json_build_object(
    'ok', true,
    'estado', CASE WHEN v_is_waiting_list THEN 'lista_espera' ELSE 'pendiente_pago' END,
    'jugador_id', v_jugador_id
  );
END;
$$;
