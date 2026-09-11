ALTER TABLE torneo_individual_fechas ADD COLUMN IF NOT EXISTS publicado BOOLEAN DEFAULT false;

-- Opcional: Para evitar que los muros ya finalizados desaparezcan de repente
UPDATE torneo_individual_fechas SET publicado = true WHERE estado = 'finalizado';
