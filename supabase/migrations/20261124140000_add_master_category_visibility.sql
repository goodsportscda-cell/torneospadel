-- Control de visibilidad por categoría para el Link Público del Club (Borrador vs Publicado)
-- Por defecto todo inicia en FALSE (oculto / Próximamente).

CREATE TABLE IF NOT EXISTS public.master_category_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID NOT NULL REFERENCES public.master_editions(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  publicar_clasificados BOOLEAN NOT NULL DEFAULT false,
  publicar_parejas BOOLEAN NOT NULL DEFAULT false,
  publicar_llaves BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS idx_master_visibility_lookup
  ON public.master_category_visibility (edition_id, categoria_id);

DROP TRIGGER IF EXISTS trg_master_visibility_updated ON public.master_category_visibility;
CREATE TRIGGER trg_master_visibility_updated
  BEFORE UPDATE ON public.master_category_visibility
  FOR EACH ROW EXECUTE FUNCTION public.set_master_updated_at();

ALTER TABLE public.master_category_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master visibility visible para todos"
  ON public.master_category_visibility FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins gestionan master_category_visibility"
  ON public.master_category_visibility FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.master_editions e
      WHERE e.id = edition_id AND public.can_manage_club(e.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.master_editions e
      WHERE e.id = edition_id AND public.can_manage_club(e.club_id)
    )
  );
