-- Añadir columna podio_final a torneo_individual_jugadores
ALTER TABLE public.torneo_individual_jugadores
ADD COLUMN IF NOT EXISTS podio_final INTEGER CHECK (podio_final IN (1, 2, 3));
