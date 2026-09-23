-- Migración para añadir leyenda personalizada a las fechas de torneos individuales
-- y subtitulo_fase a los torneos tipo Americano / Desafío Semanal

ALTER TABLE public.torneo_individual_fechas
ADD COLUMN IF NOT EXISTS leyenda TEXT;

ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS subtitulo_fase TEXT;
