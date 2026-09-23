-- Migración: Añadir columnas posicion_manual y podio_final para torneos individuales y de parejas
ALTER TABLE public.torneo_individual_jugadores
ADD COLUMN IF NOT EXISTS podio_final INTEGER CHECK (podio_final IN (1, 2, 3));

ALTER TABLE public.torneo_individual_jugadores
ADD COLUMN IF NOT EXISTS posicion_manual INTEGER DEFAULT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'torneo_individual_parejas'
  ) THEN
    ALTER TABLE public.torneo_individual_parejas
    ADD COLUMN IF NOT EXISTS podio_final INTEGER CHECK (podio_final IN (1, 2, 3));

    ALTER TABLE public.torneo_individual_parejas
    ADD COLUMN IF NOT EXISTS posicion_manual INTEGER DEFAULT NULL;
  END IF;
END $$;

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
