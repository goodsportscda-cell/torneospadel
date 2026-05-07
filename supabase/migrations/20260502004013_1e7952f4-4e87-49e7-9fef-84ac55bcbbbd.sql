
CREATE TABLE public.ascensos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jugador_id UUID NOT NULL,
  categoria_origen_id UUID NOT NULL,
  categoria_destino_id UUID NOT NULL,
  puntos_origen INTEGER NOT NULL DEFAULT 0,
  puntos_transferidos INTEGER NOT NULL DEFAULT 0,
  anio INTEGER NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ascensos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ascensos visibles para todos"
ON public.ascensos FOR SELECT
TO public
USING (true);

CREATE POLICY "Solo admins crean ascensos"
ON public.ascensos FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admins actualizan ascensos"
ON public.ascensos FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admins eliminan ascensos"
ON public.ascensos FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
