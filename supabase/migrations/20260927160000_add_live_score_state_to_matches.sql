-- Stores the active point-by-point scoreboard on its tournament match so that
-- the operator's phone and the public TV view stay in sync.
ALTER TABLE public.partidos_zona
  ADD COLUMN IF NOT EXISTS marcador_en_vivo jsonb;

ALTER TABLE public.partidos_llave
  ADD COLUMN IF NOT EXISTS marcador_en_vivo jsonb;

ALTER TABLE public.partidos_individuales
  ADD COLUMN IF NOT EXISTS marcador_en_vivo jsonb;

-- Public TV pages listen only to active match IDs. Keep these match tables in
-- Realtime so their existing public SELECT policies govern the delivered rows.
DO $$
DECLARE
  v_table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'No se encontró la publicación supabase_realtime';
  END IF;

  FOREACH v_table_name IN ARRAY ARRAY['partidos_zona', 'partidos_llave', 'partidos_individuales'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables AS publication_table
      WHERE publication_table.pubname = 'supabase_realtime'
        AND publication_table.schemaname = 'public'
        AND publication_table.tablename = v_table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table_name);
    END IF;
  END LOOP;
END;
$$;
