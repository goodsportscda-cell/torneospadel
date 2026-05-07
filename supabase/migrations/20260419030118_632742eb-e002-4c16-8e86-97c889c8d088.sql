-- 1. Crear el enum para estado de inscripción
CREATE TYPE public.estado_inscripcion AS ENUM (
  'pendiente_confirmacion',
  'confirmada',
  'lista_espera',
  'cancelada'
);

-- 2. Agregar columna estado a inscripciones (default 'confirmada' para no romper las existentes)
ALTER TABLE public.inscripciones
ADD COLUMN estado public.estado_inscripcion NOT NULL DEFAULT 'confirmada';

-- 3. Agregar cupo_maximo a torneos (opcional)
ALTER TABLE public.torneos
ADD COLUMN cupo_maximo integer;

-- 4. Índice útil para filtrar por estado en el panel
CREATE INDEX idx_inscripciones_estado ON public.inscripciones(estado);
CREATE INDEX idx_inscripciones_torneo_estado ON public.inscripciones(torneo_id, estado);