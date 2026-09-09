ALTER TABLE torneos ADD COLUMN IF NOT EXISTS ranking_publicado BOOLEAN DEFAULT false;

-- Update existing finalized tournaments to true so they remain visible
UPDATE torneos SET ranking_publicado = true WHERE estado = 'finalizado';
