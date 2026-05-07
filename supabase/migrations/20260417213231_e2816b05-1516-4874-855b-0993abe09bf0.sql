-- 1) Limpiar partidos_zona duplicados (dejar solo el más antiguo por zona+orden)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY zona_id, orden ORDER BY created_at ASC) AS rn
  FROM public.partidos_zona
)
DELETE FROM public.partidos_zona
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Agregar índice único para prevenir duplicados a futuro
CREATE UNIQUE INDEX IF NOT EXISTS partidos_zona_zona_orden_unico
  ON public.partidos_zona (zona_id, orden);