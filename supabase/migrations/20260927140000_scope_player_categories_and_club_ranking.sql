-- Keep the player identity shared while making each club's player category and
-- ranking configuration independent.

CREATE OR REPLACE FUNCTION public.can_manage_club(p_club_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND (
        p.rol = 'super_admin'
        OR (p.rol = 'club_admin' AND p.club_id = p_club_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_club_ranking_for_tournament(p_torneo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.torneos t
    JOIN public.perfiles p ON p.id = auth.uid()
    WHERE t.id = p_torneo_id
      AND (
        p.rol = 'super_admin'
        OR (p.rol = 'club_admin' AND p.club_id = t.club_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_club_ranking_entry(p_torneo_id UUID, p_categoria_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_torneo_id IS NOT NULL THEN EXISTS (
      SELECT 1
      FROM public.torneos t
      JOIN public.perfiles p ON p.id = auth.uid()
      LEFT JOIN public.categorias c ON c.id = p_categoria_id
      WHERE t.id = p_torneo_id
        AND (p_categoria_id IS NULL OR c.club_id = t.club_id)
        AND (
          p.rol = 'super_admin'
          OR (p.rol = 'club_admin' AND p.club_id = t.club_id)
        )
    )
    ELSE EXISTS (
      SELECT 1 FROM public.categorias c
      WHERE c.id = p_categoria_id AND public.can_manage_club(c.club_id)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_club(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_club_ranking_for_tournament(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_club_ranking_entry(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_club(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_club_ranking_for_tournament(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_club_ranking_entry(UUID, UUID) TO authenticated;

-- Per-club version of the player's current sports category. The old column
-- remains for compatibility; this relation becomes the source for each club.
ALTER TABLE public.categorias_jugadores
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubes(id) ON DELETE CASCADE;

ALTER TABLE public.categorias_jugadores
  DROP CONSTRAINT IF EXISTS categorias_jugadores_nombre_genero_key;

UPDATE public.categorias_jugadores cj
SET club_id = c.id
FROM public.clubes c
WHERE c.slug = 'goodsports' AND cj.club_id IS NULL;

ALTER TABLE public.categorias_jugadores
  ALTER COLUMN club_id SET NOT NULL;

ALTER TABLE public.categorias_jugadores
  ADD CONSTRAINT categorias_jugadores_club_nombre_genero_key
  UNIQUE (club_id, nombre, genero);

ALTER TABLE public.categorias_jugadores
  ADD CONSTRAINT categorias_jugadores_id_club_key UNIQUE (id, club_id);

-- Seed each existing club with the current Goodsports category list.
INSERT INTO public.categorias_jugadores (nombre, genero, orden, activa, club_id)
SELECT base.nombre, base.genero, base.orden, base.activa, destino.id
FROM public.clubes destino
CROSS JOIN public.clubes origen
JOIN public.categorias_jugadores base ON base.club_id = origen.id
WHERE origen.slug = 'goodsports'
  AND destino.id <> origen.id
ON CONFLICT (club_id, nombre, genero) DO NOTHING;

CREATE TABLE public.jugador_categorias_club (
  jugador_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  categoria_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (jugador_id, club_id),
  CONSTRAINT jugador_categorias_club_categoria_fk
    FOREIGN KEY (categoria_id, club_id)
    REFERENCES public.categorias_jugadores(id, club_id)
    ON DELETE RESTRICT
);

INSERT INTO public.jugador_categorias_club (jugador_id, club_id, categoria_id)
SELECT j.id, c.id, j.categoria_id
FROM public.jugadores j
CROSS JOIN public.clubes c
WHERE c.slug = 'goodsports'
ON CONFLICT (jugador_id, club_id) DO NOTHING;

ALTER TABLE public.jugador_categorias_club ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jugador_categorias_club FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jugador_categorias_club TO authenticated;

CREATE POLICY "Admins leen categorias deportivas del club"
ON public.jugador_categorias_club FOR SELECT TO authenticated
USING (public.can_manage_club(club_id));

CREATE POLICY "Jugadores leen su categoria deportiva"
ON public.jugador_categorias_club FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.jugador_id = jugador_id
));

CREATE POLICY "Admins asignan categorias deportivas"
ON public.jugador_categorias_club FOR INSERT TO authenticated
WITH CHECK (public.can_manage_club(club_id));

CREATE POLICY "Admins actualizan categorias deportivas"
ON public.jugador_categorias_club FOR UPDATE TO authenticated
USING (public.can_manage_club(club_id))
WITH CHECK (public.can_manage_club(club_id));

CREATE POLICY "Admins eliminan categorias deportivas"
ON public.jugador_categorias_club FOR DELETE TO authenticated
USING (public.can_manage_club(club_id));

-- Ranking point values are club-specific; seed existing values into Goodsports.
ALTER TABLE public.puntos_ranking
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubes(id) ON DELETE CASCADE;

UPDATE public.puntos_ranking p
SET club_id = c.id
FROM public.clubes c
WHERE c.slug = 'goodsports' AND p.club_id IS NULL;

ALTER TABLE public.puntos_ranking
  ALTER COLUMN club_id SET NOT NULL;

ALTER TABLE public.puntos_ranking
  DROP CONSTRAINT IF EXISTS puntos_ranking_instancia_key;

ALTER TABLE public.puntos_ranking
  ADD CONSTRAINT puntos_ranking_club_instancia_key UNIQUE (club_id, instancia);

-- New club accounts receive their own category list and ranking points table.
CREATE OR REPLACE FUNCTION public.seed_club_sports_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_default_club_id UUID;
BEGIN
  SELECT id INTO v_default_club_id
  FROM public.clubes
  WHERE slug = 'goodsports';

  IF v_default_club_id IS NULL OR NEW.id = v_default_club_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.categorias_jugadores (nombre, genero, orden, activa, club_id)
  SELECT nombre, genero, orden, activa, NEW.id
  FROM public.categorias_jugadores
  WHERE club_id = v_default_club_id
  ON CONFLICT (club_id, nombre, genero) DO NOTHING;

  INSERT INTO public.puntos_ranking (instancia, puntos, orden, club_id)
  SELECT instancia, puntos, orden, NEW.id
  FROM public.puntos_ranking
  WHERE club_id = v_default_club_id
  ON CONFLICT (club_id, instancia) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_club_sports_settings_after_insert ON public.clubes;
CREATE TRIGGER seed_club_sports_settings_after_insert
AFTER INSERT ON public.clubes
FOR EACH ROW EXECUTE FUNCTION public.seed_club_sports_settings();

CREATE INDEX IF NOT EXISTS idx_jugador_categorias_club_club
  ON public.jugador_categorias_club(club_id, jugador_id);
CREATE INDEX IF NOT EXISTS idx_categorias_jugadores_club
  ON public.categorias_jugadores(club_id, genero, orden);
CREATE INDEX IF NOT EXISTS idx_jugador_categorias_club_categoria
  ON public.jugador_categorias_club(club_id, categoria_id);

-- Retire the old single-category field from public projections.
CREATE OR REPLACE VIEW public.jugadores_publicos
WITH (security_barrier = true)
AS
SELECT id, nombre, apellido, genero, NULL::UUID AS categoria_id, club
FROM public.jugadores;

REVOKE ALL ON public.jugadores_publicos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.jugadores_publicos TO anon, authenticated;

-- A public, non-sensitive projection lets each club show a player's category
-- in that club without putting one global category back on the player record.
CREATE OR REPLACE VIEW public.jugador_categorias_publicas
WITH (security_barrier = true)
AS
SELECT jcc.jugador_id, jcc.club_id, jcc.categoria_id, cj.nombre AS categoria_nombre, cj.genero
FROM public.jugador_categorias_club jcc
JOIN public.categorias_jugadores cj
  ON cj.id = jcc.categoria_id AND cj.club_id = jcc.club_id;

REVOKE ALL ON public.jugador_categorias_publicas FROM PUBLIC, authenticated;
GRANT SELECT ON public.jugador_categorias_publicas TO anon, authenticated;

-- Players are a shared directory: all club admins may maintain identity data.
-- Operators only see personal data for players entered in tournaments they run.
DROP POLICY IF EXISTS "Admins ven todos los jugadores" ON public.jugadores;
DROP POLICY IF EXISTS "Solo admins crean jugadores" ON public.jugadores;
DROP POLICY IF EXISTS "Solo admins actualizan jugadores" ON public.jugadores;
DROP POLICY IF EXISTS "Solo admins eliminan jugadores" ON public.jugadores;

CREATE POLICY "Admins y operadores leen jugadores permitidos"
ON public.jugadores FOR SELECT TO authenticated
USING (
  public.current_profile_role() IN ('super_admin', 'club_admin')
  OR (
    public.current_profile_role() = 'operador'
    AND (
      EXISTS (
        SELECT 1 FROM public.inscripciones i
        WHERE (i.jugador1_id = id OR i.jugador2_id = id)
          AND public.can_manage_tournament(i.torneo_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.torneo_individual_jugadores tij
        WHERE tij.jugador_id = id
          AND public.can_manage_tournament(tij.torneo_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.partidos_individuales pi
        WHERE id IN (pi.jugador1_id, pi.jugador2_id, pi.jugador3_id, pi.jugador4_id)
          AND public.can_manage_tournament(pi.torneo_id)
      )
    )
  )
);

CREATE POLICY "Admins crean fichas de jugadores"
ON public.jugadores FOR INSERT TO authenticated
WITH CHECK (public.current_profile_role() IN ('super_admin', 'club_admin'));

CREATE POLICY "Admins actualizan fichas de jugadores"
ON public.jugadores FOR UPDATE TO authenticated
USING (public.current_profile_role() IN ('super_admin', 'club_admin'))
WITH CHECK (public.current_profile_role() IN ('super_admin', 'club_admin'));

CREATE POLICY "Solo superadmins eliminan fichas de jugadores"
ON public.jugadores FOR DELETE TO authenticated
USING (public.current_profile_role() = 'super_admin');

-- Replace the legacy global-admin fallback with the explicit SaaS role model.
CREATE OR REPLACE FUNCTION public.can_manage_tournament(p_torneo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.torneos t
    JOIN public.perfiles p ON p.id = auth.uid()
    WHERE t.id = p_torneo_id
      AND (
        p.rol = 'super_admin'
        OR (p.rol IN ('club_admin', 'operador') AND p.club_id = t.club_id)
      )
  );
$$;

-- Club admins and superadmins own all rankings and player-category taxonomies
-- for their club. Operators can record matches, but cannot edit ranking data.
DROP POLICY IF EXISTS "Solo admins crean cat jugadores" ON public.categorias_jugadores;
DROP POLICY IF EXISTS "Solo admins actualizan cat jugadores" ON public.categorias_jugadores;
DROP POLICY IF EXISTS "Solo admins eliminan cat jugadores" ON public.categorias_jugadores;

CREATE POLICY "Admins del club crean categorias deportivas"
ON public.categorias_jugadores FOR INSERT TO authenticated
WITH CHECK (public.can_manage_club(club_id));
CREATE POLICY "Admins del club actualizan categorias deportivas"
ON public.categorias_jugadores FOR UPDATE TO authenticated
USING (public.can_manage_club(club_id))
WITH CHECK (public.can_manage_club(club_id));
CREATE POLICY "Admins del club eliminan categorias deportivas"
ON public.categorias_jugadores FOR DELETE TO authenticated
USING (public.can_manage_club(club_id));

DROP POLICY IF EXISTS "Solo admins crean puntos_ranking" ON public.puntos_ranking;
DROP POLICY IF EXISTS "Solo admins actualizan puntos_ranking" ON public.puntos_ranking;
DROP POLICY IF EXISTS "Solo admins eliminan puntos_ranking" ON public.puntos_ranking;
CREATE POLICY "Admins del club crean configuracion de puntos"
ON public.puntos_ranking FOR INSERT TO authenticated
WITH CHECK (public.can_manage_club(club_id));
CREATE POLICY "Admins del club actualizan configuracion de puntos"
ON public.puntos_ranking FOR UPDATE TO authenticated
USING (public.can_manage_club(club_id))
WITH CHECK (public.can_manage_club(club_id));
CREATE POLICY "Admins del club eliminan configuracion de puntos"
ON public.puntos_ranking FOR DELETE TO authenticated
USING (public.can_manage_club(club_id));

DROP POLICY IF EXISTS "Solo admins crean ranking" ON public.ranking_jugadores;
DROP POLICY IF EXISTS "Solo admins actualizan ranking" ON public.ranking_jugadores;
DROP POLICY IF EXISTS "Solo admins eliminan ranking" ON public.ranking_jugadores;
CREATE POLICY "Admins del club crean resultados de ranking"
ON public.ranking_jugadores FOR INSERT TO authenticated
WITH CHECK (public.can_manage_club_ranking_entry(torneo_id, categoria_id));
CREATE POLICY "Admins del club actualizan resultados de ranking"
ON public.ranking_jugadores FOR UPDATE TO authenticated
USING (public.can_manage_club_ranking_entry(torneo_id, categoria_id))
WITH CHECK (public.can_manage_club_ranking_entry(torneo_id, categoria_id));
CREATE POLICY "Admins del club eliminan resultados de ranking"
ON public.ranking_jugadores FOR DELETE TO authenticated
USING (public.can_manage_club_ranking_entry(torneo_id, categoria_id));

DROP POLICY IF EXISTS "Solo admins crean ascensos" ON public.ascensos;
DROP POLICY IF EXISTS "Solo admins actualizan ascensos" ON public.ascensos;
DROP POLICY IF EXISTS "Solo admins eliminan ascensos" ON public.ascensos;
CREATE POLICY "Admins del club crean ascensos"
ON public.ascensos FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.categorias origen
  JOIN public.categorias destino ON destino.club_id = origen.club_id
  WHERE origen.id = categoria_origen_id
    AND destino.id = categoria_destino_id
    AND public.can_manage_club(origen.club_id)
));
CREATE POLICY "Admins del club actualizan ascensos"
ON public.ascensos FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.categorias origen
  JOIN public.categorias destino ON destino.club_id = origen.club_id
  WHERE origen.id = categoria_origen_id
    AND destino.id = categoria_destino_id
    AND public.can_manage_club(origen.club_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.categorias origen
  JOIN public.categorias destino ON destino.club_id = origen.club_id
  WHERE origen.id = categoria_origen_id
    AND destino.id = categoria_destino_id
    AND public.can_manage_club(origen.club_id)
));
CREATE POLICY "Admins del club eliminan ascensos"
ON public.ascensos FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.categorias origen
  JOIN public.categorias destino ON destino.club_id = origen.club_id
  WHERE origen.id = categoria_origen_id
    AND destino.id = categoria_destino_id
    AND public.can_manage_club(origen.club_id)
));

DROP POLICY IF EXISTS "Solo admins crean cupos master" ON public.cupos_master;
DROP POLICY IF EXISTS "Solo admins actualizan cupos master" ON public.cupos_master;
DROP POLICY IF EXISTS "Solo admins eliminan cupos master" ON public.cupos_master;
CREATE POLICY "Admins del club crean cupos master"
ON public.cupos_master FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.categorias c
  WHERE c.id = categoria_id AND public.can_manage_club(c.club_id)
));
CREATE POLICY "Admins del club actualizan cupos master"
ON public.cupos_master FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.categorias c
  WHERE c.id = categoria_id AND public.can_manage_club(c.club_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.categorias c
  WHERE c.id = categoria_id AND public.can_manage_club(c.club_id)
));
CREATE POLICY "Admins del club eliminan cupos master"
ON public.cupos_master FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.categorias c
  WHERE c.id = categoria_id AND public.can_manage_club(c.club_id)
));

-- A player may edit personal identity data only on the ficha linked to their
-- account and only while the account's email remains verified and unchanged.
CREATE OR REPLACE FUNCTION public.update_my_player_profile(
  p_nombre TEXT,
  p_apellido TEXT,
  p_dni TEXT,
  p_telefono TEXT,
  p_ciudad TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_jugador_id UUID;
  v_dni TEXT;
  v_player RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Iniciá sesión para actualizar tu ficha');
  END IF;

  SELECT pg_catalog.lower(pg_catalog.btrim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id = v_user_id AND u.email_confirmed_at IS NOT NULL;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Primero verificá el correo de tu cuenta');
  END IF;

  IF pg_catalog.btrim(COALESCE(p_nombre, '')) = ''
     OR pg_catalog.btrim(COALESCE(p_apellido, '')) = '' THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Nombre y apellido son obligatorios');
  END IF;

  v_dni := pg_catalog.regexp_replace(COALESCE(p_dni, ''), '[^0-9]', '', 'g');
  IF pg_catalog.length(v_dni) NOT BETWEEN 7 AND 9 THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'El DNI debe tener entre 7 y 9 números');
  END IF;

  SELECT p.jugador_id INTO v_jugador_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id AND p.jugador_id IS NOT NULL;
  IF v_jugador_id IS NULL THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Primero verificá y vinculá tu ficha de jugador');
  END IF;

  UPDATE public.jugadores j
  SET nombre = pg_catalog.btrim(p_nombre),
      apellido = pg_catalog.btrim(p_apellido),
      dni = v_dni,
      telefono = NULLIF(pg_catalog.btrim(COALESCE(p_telefono, '')), ''),
      club = NULLIF(pg_catalog.btrim(COALESCE(p_ciudad, '')), '')
  WHERE j.id = v_jugador_id
    AND pg_catalog.lower(pg_catalog.btrim(COALESCE(j.email, ''))) = v_email;

  IF NOT FOUND THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'El correo no coincide con el de tu ficha. Contactá al club para verificar el vínculo');
  END IF;

  SELECT j.id, j.nombre, j.apellido, j.dni, j.telefono, j.club, j.email
  INTO v_player
  FROM public.jugadores j
  WHERE j.id = v_jugador_id;

  RETURN pg_catalog.json_build_object(
    'ok', true,
    'jugador_id', v_player.id,
    'nombre', v_player.nombre,
    'apellido', v_player.apellido,
    'dni', v_player.dni,
    'telefono', v_player.telefono,
    'club', v_player.club,
    'email', v_player.email
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN pg_catalog.json_build_object('ok', false, 'error', 'Ese DNI ya pertenece a otra ficha. Contactá al club para revisarlo');
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_player_profile(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_player_profile(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
