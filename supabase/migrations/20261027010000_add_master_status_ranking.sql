-- Migración: Carrera al Master de Diciembre
-- Agrega columna opcional master_status en ranking_jugadores (sin crear tablas nuevas)

ALTER TABLE public.ranking_jugadores
ADD COLUMN IF NOT EXISTS master_status text DEFAULT 'auto';

-- Constraint opcional para validar valores permitidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ranking_jugadores_master_status_check'
  ) THEN
    ALTER TABLE public.ranking_jugadores
    ADD CONSTRAINT ranking_jugadores_master_status_check
    CHECK (master_status IS NULL OR master_status IN ('auto', 'clasificado_manual', 'ascendido_habilitado', 'baja_master'));
  END IF;
END $$;

-- Índice liviano para acelerar actualizaciones y lecturas por jugador + categoría + año
CREATE INDEX IF NOT EXISTS idx_ranking_jugadores_master_lookup
ON public.ranking_jugadores (anio, categoria_id, jugador_id);

