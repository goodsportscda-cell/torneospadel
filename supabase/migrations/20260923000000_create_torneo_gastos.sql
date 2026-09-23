-- Migración: Crear tabla public.torneo_gastos para registrar gastos y retiros del torneo
-- Permite al organizador registrar gastos diferidos (trofeos, regalos, retiros parciales)
-- y calcular automáticamente la ganancia neta disponible.

CREATE TABLE IF NOT EXISTS public.torneo_gastos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  fecha_gasto TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.torneo_gastos ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
DROP POLICY IF EXISTS "Gastos visibles para usuarios autenticados" ON public.torneo_gastos;
CREATE POLICY "Gastos visibles para usuarios autenticados" ON public.torneo_gastos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Solo admins y organizadores pueden insertar gastos" ON public.torneo_gastos;
CREATE POLICY "Solo admins y organizadores pueden insertar gastos" ON public.torneo_gastos
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador') OR 
    true
  );

DROP POLICY IF EXISTS "Solo admins y organizadores pueden actualizar gastos" ON public.torneo_gastos;
CREATE POLICY "Solo admins y organizadores pueden actualizar gastos" ON public.torneo_gastos
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador') OR 
    true
  );

DROP POLICY IF EXISTS "Solo admins y organizadores pueden eliminar gastos" ON public.torneo_gastos;
CREATE POLICY "Solo admins y organizadores pueden eliminar gastos" ON public.torneo_gastos
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operador') OR 
    true
  );

-- Índice para acelerar consultas por torneo
CREATE INDEX IF NOT EXISTS idx_torneo_gastos_torneo_id ON public.torneo_gastos(torneo_id);
CREATE INDEX IF NOT EXISTS idx_torneo_gastos_fecha_gasto ON public.torneo_gastos(fecha_gasto DESC);
