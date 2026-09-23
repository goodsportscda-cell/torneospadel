-- Migración para añadir payment_status a los participantes de torneos
-- Soporta valores: 'pending', 'paid', 'courtesy'

-- 1. Añadir columna a torneo_individual_jugadores (participantes de desafíos/americanos)
ALTER TABLE public.torneo_individual_jugadores
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'torneo_individual_jugadores_payment_status_check'
  ) THEN
    ALTER TABLE public.torneo_individual_jugadores
    ADD CONSTRAINT torneo_individual_jugadores_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'courtesy'));
  END IF;
END $$;

-- 2. Añadir columna a inscripciones (participantes de torneos regulares)
ALTER TABLE public.inscripciones
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 3. Añadir columna a torneo_individual_parejas si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'torneo_individual_parejas'
  ) THEN
    ALTER TABLE public.torneo_individual_parejas
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
  END IF;
END $$;
