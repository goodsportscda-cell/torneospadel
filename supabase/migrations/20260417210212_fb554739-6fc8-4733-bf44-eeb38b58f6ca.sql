-- Enum para rondas de llave
CREATE TYPE public.ronda_llave AS ENUM ('previa', 'dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'final');

-- Tabla llaves (una por torneo)
CREATE TABLE public.llaves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id UUID NOT NULL,
  cantidad_parejas INTEGER NOT NULL,
  tamanio_cuadro INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(torneo_id)
);

-- Tabla partidos_llave
CREATE TABLE public.partidos_llave (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  llave_id UUID NOT NULL REFERENCES public.llaves(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  ronda public.ronda_llave NOT NULL,
  pareja_local_id UUID,
  pareja_visitante_id UUID,
  -- referencia textual al clasificado de zona (ej: "1°A", "2°B"), util cuando aún no se rellenó la pareja
  ref_local TEXT,
  ref_visitante TEXT,
  -- referencias a partidos previos cuyo ganador llena este slot
  partido_local_origen_id UUID REFERENCES public.partidos_llave(id) ON DELETE SET NULL,
  partido_visitante_origen_id UUID REFERENCES public.partidos_llave(id) ON DELETE SET NULL,
  -- partido siguiente al que avanza el ganador
  partido_siguiente_id UUID REFERENCES public.partidos_llave(id) ON DELETE SET NULL,
  -- "local" o "visitante" en el partido siguiente
  posicion_siguiente TEXT,
  ganador_id UUID,
  estado public.estado_partido NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(llave_id, numero)
);

CREATE INDEX idx_partidos_llave_llave ON public.partidos_llave(llave_id);
CREATE INDEX idx_partidos_llave_siguiente ON public.partidos_llave(partido_siguiente_id);

-- Agregar partido_llave_id a sets_partido (opcional: o partido_id de zona, o partido_llave_id)
ALTER TABLE public.sets_partido ADD COLUMN partido_llave_id UUID REFERENCES public.partidos_llave(id) ON DELETE CASCADE;
ALTER TABLE public.sets_partido ALTER COLUMN partido_id DROP NOT NULL;
ALTER TABLE public.sets_partido ADD CONSTRAINT sets_partido_uno_u_otro CHECK (
  (partido_id IS NOT NULL AND partido_llave_id IS NULL) OR
  (partido_id IS NULL AND partido_llave_id IS NOT NULL)
);

-- RLS
ALTER TABLE public.llaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidos_llave ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Llaves visibles para todos" ON public.llaves FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear llaves (pre-auth)" ON public.llaves FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar llaves (pre-auth)" ON public.llaves FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar llaves (pre-auth)" ON public.llaves FOR DELETE USING (true);

CREATE POLICY "Partidos llave visibles para todos" ON public.partidos_llave FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear partidos_llave (pre-auth)" ON public.partidos_llave FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar partidos_llave (pre-auth)" ON public.partidos_llave FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar partidos_llave (pre-auth)" ON public.partidos_llave FOR DELETE USING (true);

-- Triggers de updated_at
CREATE TRIGGER update_llaves_updated_at BEFORE UPDATE ON public.llaves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_partidos_llave_updated_at BEFORE UPDATE ON public.partidos_llave
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();