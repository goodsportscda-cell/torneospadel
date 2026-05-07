CREATE TYPE public.estado_pago AS ENUM ('pendiente', 'parcial', 'pagado');

CREATE TABLE public.inscripciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  jugador1_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  jugador2_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  estado_pago public.estado_pago NOT NULL DEFAULT 'pendiente',
  monto_pagado NUMERIC(10,2) DEFAULT 0,
  fecha_inscripcion DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT jugadores_distintos CHECK (jugador1_id <> jugador2_id)
);

-- Evitar duplicados de la misma pareja (en cualquier orden) en el mismo torneo
CREATE UNIQUE INDEX idx_inscripciones_pareja_unica
  ON public.inscripciones (
    torneo_id,
    LEAST(jugador1_id, jugador2_id),
    GREATEST(jugador1_id, jugador2_id)
  );

CREATE INDEX idx_inscripciones_torneo ON public.inscripciones(torneo_id);

ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inscripciones visibles para todos"
  ON public.inscripciones FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear inscripciones (pre-auth)"
  ON public.inscripciones FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar inscripciones (pre-auth)"
  ON public.inscripciones FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar inscripciones (pre-auth)"
  ON public.inscripciones FOR DELETE USING (true);

CREATE TRIGGER update_inscripciones_updated_at
  BEFORE UPDATE ON public.inscripciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();