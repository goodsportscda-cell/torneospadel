-- Nueva tabla independiente de categorías de jugadores
CREATE TABLE public.categorias_jugadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  genero public.genero_categoria NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (nombre, genero)
);

ALTER TABLE public.categorias_jugadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias jugadores visibles para todos"
  ON public.categorias_jugadores FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear cat. jugadores (pre-auth)"
  ON public.categorias_jugadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar cat. jugadores (pre-auth)"
  ON public.categorias_jugadores FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar cat. jugadores (pre-auth)"
  ON public.categorias_jugadores FOR DELETE USING (true);

-- Precarga 1ra a 8va por género
INSERT INTO public.categorias_jugadores (nombre, genero, orden) VALUES
  ('1ra', 'caballeros', 1),
  ('2da', 'caballeros', 2),
  ('3ra', 'caballeros', 3),
  ('4ta', 'caballeros', 4),
  ('5ta', 'caballeros', 5),
  ('6ta', 'caballeros', 6),
  ('7ma', 'caballeros', 7),
  ('8va', 'caballeros', 8),
  ('1ra', 'damas', 11),
  ('2da', 'damas', 12),
  ('3ra', 'damas', 13),
  ('4ta', 'damas', 14),
  ('5ta', 'damas', 15),
  ('6ta', 'damas', 16),
  ('7ma', 'damas', 17),
  ('8va', 'damas', 18);

-- Cambiar la FK de jugadores: dropear la vieja y crear una nueva
ALTER TABLE public.jugadores DROP CONSTRAINT IF EXISTS jugadores_categoria_id_fkey;
-- Limpiar valores anteriores que apuntaban a la otra tabla
UPDATE public.jugadores SET categoria_id = NULL;
ALTER TABLE public.jugadores
  ADD CONSTRAINT jugadores_categoria_id_fkey
  FOREIGN KEY (categoria_id) REFERENCES public.categorias_jugadores(id) ON DELETE SET NULL;