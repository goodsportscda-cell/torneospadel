-- Agregar campos a torneos
ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS numero_fecha integer,
  ADD COLUMN IF NOT EXISTS multiplicador_puntos numeric NOT NULL DEFAULT 1;

-- Tabla de cupos al Master por categoría
CREATE TABLE IF NOT EXISTS public.cupos_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL UNIQUE,
  cupos integer NOT NULL DEFAULT 16,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cupos_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cupos master visibles para todos"
  ON public.cupos_master FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear cupos master (pre-auth)"
  ON public.cupos_master FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar cupos master (pre-auth)"
  ON public.cupos_master FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar cupos master (pre-auth)"
  ON public.cupos_master FOR DELETE USING (true);

CREATE TRIGGER update_cupos_master_updated_at
  BEFORE UPDATE ON public.cupos_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();