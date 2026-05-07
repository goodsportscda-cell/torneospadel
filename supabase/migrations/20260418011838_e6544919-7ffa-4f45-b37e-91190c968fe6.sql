-- Agregar nuevos valores al enum estado_partido
ALTER TYPE public.estado_partido ADD VALUE IF NOT EXISTS 'programado';
ALTER TYPE public.estado_partido ADD VALUE IF NOT EXISTS 'suspendido';

-- Agregar columnas de programación a partidos_llave
ALTER TABLE public.partidos_llave
  ADD COLUMN IF NOT EXISTS fecha_hora TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancha TEXT;

-- También útil para partidos_zona (mismo concepto)
ALTER TABLE public.partidos_zona
  ADD COLUMN IF NOT EXISTS fecha_hora TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancha TEXT;