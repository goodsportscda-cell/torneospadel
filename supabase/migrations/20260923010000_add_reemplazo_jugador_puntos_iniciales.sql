-- Migración: Añadir soporte para reemplazo de jugadores a mitad de torneo
-- y herencia de puntos iniciales / handicap acumulado.

-- 1. torneo_individual_jugadores
ALTER TABLE public.torneo_individual_jugadores
ADD COLUMN IF NOT EXISTS puntos_iniciales NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.torneo_individual_jugadores
ADD COLUMN IF NOT EXISTS reemplaza_a_jugador_id UUID REFERENCES public.jugadores(id) ON DELETE SET NULL;

ALTER TABLE public.torneo_individual_jugadores
ADD COLUMN IF NOT EXISTS fecha_reemplazo TIMESTAMP WITH TIME ZONE;

-- 2. torneo_individual_parejas (para reemplazos en torneos de parejas fijas)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'torneo_individual_parejas'
  ) THEN
    ALTER TABLE public.torneo_individual_parejas
    ADD COLUMN IF NOT EXISTS puntos_iniciales NUMERIC NOT NULL DEFAULT 0;
  END IF;
END $$;
