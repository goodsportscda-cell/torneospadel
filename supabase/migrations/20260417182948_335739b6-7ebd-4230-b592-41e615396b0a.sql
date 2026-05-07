-- Tabla de zonas
CREATE TABLE public.zonas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  tamanio INTEGER NOT NULL CHECK (tamanio IN (3, 4)),
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zonas visibles para todos" ON public.zonas FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear zonas (pre-auth)" ON public.zonas FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar zonas (pre-auth)" ON public.zonas FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar zonas (pre-auth)" ON public.zonas FOR DELETE USING (true);

CREATE TRIGGER update_zonas_updated_at
BEFORE UPDATE ON public.zonas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_zonas_torneo ON public.zonas(torneo_id);

-- Tabla de parejas en zonas
CREATE TABLE public.zonas_parejas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zona_id UUID NOT NULL REFERENCES public.zonas(id) ON DELETE CASCADE,
  inscripcion_id UUID NOT NULL,
  posicion_siembra INTEGER NOT NULL CHECK (posicion_siembra BETWEEN 1 AND 4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(zona_id, posicion_siembra),
  UNIQUE(zona_id, inscripcion_id)
);

ALTER TABLE public.zonas_parejas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zonas parejas visibles para todos" ON public.zonas_parejas FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear zonas_parejas (pre-auth)" ON public.zonas_parejas FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar zonas_parejas (pre-auth)" ON public.zonas_parejas FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar zonas_parejas (pre-auth)" ON public.zonas_parejas FOR DELETE USING (true);

CREATE INDEX idx_zonas_parejas_zona ON public.zonas_parejas(zona_id);
CREATE INDEX idx_zonas_parejas_inscripcion ON public.zonas_parejas(inscripcion_id);

-- Enum para tipo de partido
CREATE TYPE public.tipo_partido_zona AS ENUM ('directo', 'ganadores', 'perdedores');
CREATE TYPE public.estado_partido AS ENUM ('pendiente', 'en_juego', 'finalizado');

-- Tabla de partidos de zona
CREATE TABLE public.partidos_zona (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zona_id UUID NOT NULL REFERENCES public.zonas(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL,
  tipo public.tipo_partido_zona NOT NULL DEFAULT 'directo',
  pareja_local_id UUID,
  pareja_visitante_id UUID,
  posicion_local INTEGER,
  posicion_visitante INTEGER,
  estado public.estado_partido NOT NULL DEFAULT 'pendiente',
  ganador_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partidos_zona ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partidos zona visibles para todos" ON public.partidos_zona FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear partidos_zona (pre-auth)" ON public.partidos_zona FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar partidos_zona (pre-auth)" ON public.partidos_zona FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar partidos_zona (pre-auth)" ON public.partidos_zona FOR DELETE USING (true);

CREATE TRIGGER update_partidos_zona_updated_at
BEFORE UPDATE ON public.partidos_zona
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_partidos_zona_zona ON public.partidos_zona(zona_id);

-- Tabla de sets de cada partido
CREATE TABLE public.sets_partido (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partido_id UUID NOT NULL REFERENCES public.partidos_zona(id) ON DELETE CASCADE,
  numero_set INTEGER NOT NULL CHECK (numero_set BETWEEN 1 AND 5),
  games_local INTEGER NOT NULL DEFAULT 0,
  games_visitante INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(partido_id, numero_set)
);

ALTER TABLE public.sets_partido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sets visibles para todos" ON public.sets_partido FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear sets (pre-auth)" ON public.sets_partido FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar sets (pre-auth)" ON public.sets_partido FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar sets (pre-auth)" ON public.sets_partido FOR DELETE USING (true);

CREATE INDEX idx_sets_partido ON public.sets_partido(partido_id);