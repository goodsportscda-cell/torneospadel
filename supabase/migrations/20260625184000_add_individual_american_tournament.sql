-- 1. Agregar nuevo valor al enum de tipo de torneo si no existe
-- En Postgres, ALTER TYPE ADD VALUE no se puede ejecutar dentro de un bloque transaccional en versiones antiguas,
-- pero en Supabase CLI / Migraciones de Postgres 15+ funciona correctamente.
ALTER TYPE public.tipo_torneo ADD VALUE IF NOT EXISTS 'americano_individual';

-- 2. Agregar columnas de configuración y finanzas a la tabla de torneos
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS canchas_count INTEGER DEFAULT 3;
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS costo_fecha_jugador NUMERIC(10,2) DEFAULT 10000;
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS costo_fecha_cancha NUMERIC(10,2) DEFAULT 22000;
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS porcentaje_premios NUMERIC(5,2) DEFAULT 60.00;

-- 3. Tabla torneo_individual_jugadores: Registros individuales de jugadores para este formato
CREATE TABLE IF NOT EXISTS public.torneo_individual_jugadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  jugador_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'confirmada',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (torneo_id, jugador_id)
);

ALTER TABLE public.torneo_individual_jugadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Torneo ind jugadores visibles para todos" ON public.torneo_individual_jugadores FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear torneo_individual_jugadores" ON public.torneo_individual_jugadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar torneo_individual_jugadores" ON public.torneo_individual_jugadores FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar torneo_individual_jugadores" ON public.torneo_individual_jugadores FOR DELETE USING (true);

-- 4. Tabla torneo_individual_fechas: Control de fechas, costo de canchas específico por fecha
CREATE TABLE IF NOT EXISTS public.torneo_individual_fechas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  fecha INTEGER NOT NULL,
  costo_canchas NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (torneo_id, fecha)
);

ALTER TABLE public.torneo_individual_fechas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Torneo ind fechas visibles para todos" ON public.torneo_individual_fechas FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear torneo_individual_fechas" ON public.torneo_individual_fechas FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar torneo_individual_fechas" ON public.torneo_individual_fechas FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar torneo_individual_fechas" ON public.torneo_individual_fechas FOR DELETE USING (true);

-- 5. Tabla torneo_individual_pagos: Control de pago de cada jugador para cada una de las fechas
CREATE TABLE IF NOT EXISTS public.torneo_individual_pagos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  fecha INTEGER NOT NULL,
  jugador_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
  monto_pagado NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado_pago public.estado_pago NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (torneo_id, fecha, jugador_id)
);

ALTER TABLE public.torneo_individual_pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Torneo ind pagos visibles para todos" ON public.torneo_individual_pagos FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear torneo_individual_pagos" ON public.torneo_individual_pagos FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar torneo_individual_pagos" ON public.torneo_individual_pagos FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar torneo_individual_pagos" ON public.torneo_individual_pagos FOR DELETE USING (true);

-- 6. Tabla partidos_individuales: Partidos jugados en formato individual cruzando los 4 jugadores de cada cancha
CREATE TABLE IF NOT EXISTS public.partidos_individuales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  fecha INTEGER NOT NULL,
  cancha TEXT NOT NULL,
  jugador1_id UUID REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  jugador2_id UUID REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  jugador3_id UUID REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  jugador4_id UUID REFERENCES public.jugadores(id) ON DELETE RESTRICT,
  suplente1_nombre TEXT,
  suplente2_nombre TEXT,
  suplente3_nombre TEXT,
  suplente4_nombre TEXT,
  sets_pareja1 INTEGER DEFAULT 0,
  sets_pareja2 INTEGER DEFAULT 0,
  estado public.estado_partido NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partidos_individuales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partidos ind visibles para todos" ON public.partidos_individuales FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear partidos_individuales" ON public.partidos_individuales FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar partidos_individuales" ON public.partidos_individuales FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar partidos_individuales" ON public.partidos_individuales FOR DELETE USING (true);

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER update_partidos_individuales_updated_at
  BEFORE UPDATE ON public.partidos_individuales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Tabla sets_partido_individual: Desglose de games por cada set para el cálculo de desempates de la tabla general
CREATE TABLE IF NOT EXISTS public.sets_partido_individual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partido_individual_id UUID NOT NULL REFERENCES public.partidos_individuales(id) ON DELETE CASCADE,
  numero_set INTEGER NOT NULL CHECK (numero_set BETWEEN 1 AND 3),
  games_pareja1 INTEGER NOT NULL DEFAULT 0,
  games_pareja2 INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (partido_individual_id, numero_set)
);

ALTER TABLE public.sets_partido_individual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sets ind visibles para todos" ON public.sets_partido_individual FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear sets_partido_individual" ON public.sets_partido_individual FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar sets_partido_individual" ON public.sets_partido_individual FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar sets_partido_individual" ON public.sets_partido_individual FOR DELETE USING (true);
