ALTER TABLE partidos_individuales
ADD COLUMN IF NOT EXISTS fecha_programada date,
ADD COLUMN IF NOT EXISTS hora_programada time without time zone;
