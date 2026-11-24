-- Módulo Integral: Good Padel Master Diciembre 2026
-- Tablas completamente aisladas de los datos históricos del club.

CREATE TABLE IF NOT EXISTS public.master_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  anio INTEGER NOT NULL DEFAULT 2026,
  nombre TEXT NOT NULL DEFAULT 'Good Padel Master 2026',
  fecha_inicio DATE NOT NULL DEFAULT '2026-12-03',
  fecha_fin DATE NOT NULL DEFAULT '2026-12-06',
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('borrador', 'activo', 'finalizado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, anio)
);

CREATE TABLE IF NOT EXISTS public.master_qualifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID NOT NULL REFERENCES public.master_editions(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  jugador_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
  ranking_posicion_original INTEGER NOT NULL,
  puntos_anuales INTEGER NOT NULL DEFAULT 0,
  torneos_jugados INTEGER NOT NULL DEFAULT 0,
  torneos_categoria_anterior INTEGER NOT NULL DEFAULT 0,
  ascenso_validado BOOLEAN NOT NULL DEFAULT false,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('confirmado', 'pendiente', 'baja')),
  orden_manual INTEGER,
  posicion_final INTEGER,
  es_suplente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition_id, categoria_id, jugador_id)
);

CREATE TABLE IF NOT EXISTS public.master_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID NOT NULL REFERENCES public.master_editions(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  seed INTEGER NOT NULL CHECK (seed BETWEEN 1 AND 8),
  cruce_label TEXT NOT NULL DEFAULT '',
  jugador1_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
  jugador2_id UUID REFERENCES public.jugadores(id) ON DELETE SET NULL,
  jugador2_nombre_manual TEXT,
  jugador2_categoria_nivel INTEGER,
  puntos_combinados INTEGER NOT NULL DEFAULT 0,
  mejor_ranking_individual INTEGER NOT NULL DEFAULT 999,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition_id, categoria_id, seed)
);

CREATE TABLE IF NOT EXISTS public.master_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID NOT NULL REFERENCES public.master_editions(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  ronda TEXT NOT NULL CHECK (ronda IN ('cuartos', 'semifinal', 'final')),
  numero_partido INTEGER NOT NULL CHECK (numero_partido BETWEEN 1 AND 7),
  team_local_id UUID REFERENCES public.master_teams(id) ON DELETE SET NULL,
  team_visitante_id UUID REFERENCES public.master_teams(id) ON DELETE SET NULL,
  ref_local TEXT,
  ref_visitante TEXT,
  set1_local INTEGER,
  set1_visitante INTEGER,
  set2_local INTEGER,
  set2_visitante INTEGER,
  set3_local INTEGER,
  set3_visitante INTEGER,
  ganador_team_id UUID REFERENCES public.master_teams(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'programado', 'en_curso', 'finalizado')),
  dia DATE,
  hora TEXT,
  cancha INTEGER CHECK (cancha IS NULL OR cancha BETWEEN 1 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition_id, categoria_id, numero_partido)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_master_qualifiers_lookup
  ON public.master_qualifiers (edition_id, categoria_id, posicion_final);

CREATE INDEX IF NOT EXISTS idx_master_teams_lookup
  ON public.master_teams (edition_id, categoria_id, seed);

CREATE INDEX IF NOT EXISTS idx_master_matches_lookup
  ON public.master_matches (edition_id, categoria_id, numero_partido);

CREATE INDEX IF NOT EXISTS idx_master_matches_schedule
  ON public.master_matches (edition_id, dia, hora, cancha);

-- Triggers de updated_at
CREATE OR REPLACE FUNCTION public.set_master_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_master_editions_updated ON public.master_editions;
CREATE TRIGGER trg_master_editions_updated
  BEFORE UPDATE ON public.master_editions
  FOR EACH ROW EXECUTE FUNCTION public.set_master_updated_at();

DROP TRIGGER IF EXISTS trg_master_qualifiers_updated ON public.master_qualifiers;
CREATE TRIGGER trg_master_qualifiers_updated
  BEFORE UPDATE ON public.master_qualifiers
  FOR EACH ROW EXECUTE FUNCTION public.set_master_updated_at();

DROP TRIGGER IF EXISTS trg_master_teams_updated ON public.master_teams;
CREATE TRIGGER trg_master_teams_updated
  BEFORE UPDATE ON public.master_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_master_updated_at();

DROP TRIGGER IF EXISTS trg_master_matches_updated ON public.master_matches;
CREATE TRIGGER trg_master_matches_updated
  BEFORE UPDATE ON public.master_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_master_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.master_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_qualifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_matches ENABLE ROW LEVEL SECURITY;

-- Lectura pública (para Link Público del Club y Modo TV)
CREATE POLICY "Master editions visibles para todos"
  ON public.master_editions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Master qualifiers visibles para todos"
  ON public.master_qualifiers FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Master teams visibles para todos"
  ON public.master_teams FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Master matches visibles para todos"
  ON public.master_matches FOR SELECT TO anon, authenticated USING (true);

-- Escritura restringida a administradores del club
CREATE POLICY "Admins gestionan master_editions"
  ON public.master_editions FOR ALL TO authenticated
  USING (public.can_manage_club(club_id))
  WITH CHECK (public.can_manage_club(club_id));

CREATE POLICY "Admins gestionan master_qualifiers"
  ON public.master_qualifiers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.master_editions e
      WHERE e.id = edition_id AND public.can_manage_club(e.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.master_editions e
      WHERE e.id = edition_id AND public.can_manage_club(e.club_id)
    )
  );

CREATE POLICY "Admins gestionan master_teams"
  ON public.master_teams FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.master_editions e
      WHERE e.id = edition_id AND public.can_manage_club(e.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.master_editions e
      WHERE e.id = edition_id AND public.can_manage_club(e.club_id)
    )
  );

CREATE POLICY "Admins gestionan master_matches"
  ON public.master_matches FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.master_editions e
      WHERE e.id = edition_id AND public.can_manage_club(e.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.master_editions e
      WHERE e.id = edition_id AND public.can_manage_club(e.club_id)
    )
  );
