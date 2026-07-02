-- 1. Agregar columnas para la modalidad y duración de los Desafíos
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS modalidad TEXT DEFAULT 'individual';
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS desafio_semanas INTEGER DEFAULT 8;

-- 2. Agregar columnas para finanzas del torneo (entradas y salidas extras)
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS ingresos_sponsors NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS gastos_trofeos NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS gastos_regalos NUMERIC(10,2) DEFAULT 0.00;
