CREATE TABLE public.jugadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT,
  telefono TEXT,
  email TEXT,
  genero public.genero_categoria,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  club TEXT,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.jugadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jugadores visibles para todos"
  ON public.jugadores FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear jugadores (pre-auth)"
  ON public.jugadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar jugadores (pre-auth)"
  ON public.jugadores FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar jugadores (pre-auth)"
  ON public.jugadores FOR DELETE USING (true);

CREATE TRIGGER update_jugadores_updated_at
  BEFORE UPDATE ON public.jugadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_jugadores_apellido ON public.jugadores(apellido);
CREATE INDEX idx_jugadores_dni ON public.jugadores(dni);