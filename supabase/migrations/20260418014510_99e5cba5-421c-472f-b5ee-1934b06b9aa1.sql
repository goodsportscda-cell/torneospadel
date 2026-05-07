-- Tabla de configuración de puntos por instancia
CREATE TABLE public.puntos_ranking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia TEXT NOT NULL UNIQUE,
  puntos INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.puntos_ranking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Puntos ranking visibles para todos" ON public.puntos_ranking FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear puntos_ranking (pre-auth)" ON public.puntos_ranking FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar puntos_ranking (pre-auth)" ON public.puntos_ranking FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar puntos_ranking (pre-auth)" ON public.puntos_ranking FOR DELETE USING (true);

CREATE TRIGGER update_puntos_ranking_updated_at
  BEFORE UPDATE ON public.puntos_ranking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar valores iniciales
INSERT INTO public.puntos_ranking (instancia, puntos, orden) VALUES
  ('campeon', 300, 1),
  ('subcampeon', 200, 2),
  ('semifinal', 100, 3),
  ('cuartos', 50, 4),
  ('octavos', 25, 5),
  ('dieciseisavos', 15, 6),
  ('treintaidosavos', 10, 7),
  ('zona', 5, 8);

-- Tabla de puntos otorgados por torneo a cada jugador
CREATE TABLE public.ranking_jugadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jugador_id UUID NOT NULL,
  torneo_id UUID NOT NULL,
  inscripcion_id UUID NOT NULL,
  instancia TEXT NOT NULL,
  puntos INTEGER NOT NULL DEFAULT 0,
  anio INTEGER NOT NULL,
  categoria_id UUID,
  genero TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(jugador_id, torneo_id)
);

ALTER TABLE public.ranking_jugadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ranking visible para todos" ON public.ranking_jugadores FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear ranking (pre-auth)" ON public.ranking_jugadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar ranking (pre-auth)" ON public.ranking_jugadores FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar ranking (pre-auth)" ON public.ranking_jugadores FOR DELETE USING (true);

CREATE INDEX idx_ranking_jugador ON public.ranking_jugadores(jugador_id);
CREATE INDEX idx_ranking_torneo ON public.ranking_jugadores(torneo_id);
CREATE INDEX idx_ranking_anio ON public.ranking_jugadores(anio);
CREATE INDEX idx_ranking_cat_gen ON public.ranking_jugadores(categoria_id, genero, anio);