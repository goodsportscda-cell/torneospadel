-- Reorder existing caballero categories in the tournament categories table
UPDATE public.categorias SET orden = 5 WHERE nombre = '5ta' AND genero = 'caballeros';
UPDATE public.categorias SET orden = 6 WHERE nombre = '6ta' AND genero = 'caballeros';
UPDATE public.categorias SET orden = 7 WHERE nombre = '7ma' AND genero = 'caballeros';
UPDATE public.categorias SET orden = 8 WHERE nombre = '8va' AND genero = 'caballeros';
UPDATE public.categorias SET orden = 9 WHERE nombre = 'Suma 7' AND genero = 'caballeros';

-- Insert missing caballero categories
INSERT INTO public.categorias (nombre, genero, orden) VALUES
  ('1ra', 'caballeros', 1),
  ('2da', 'caballeros', 2),
  ('3ra', 'caballeros', 3),
  ('4ta', 'caballeros', 4)
ON CONFLICT (nombre, genero) DO UPDATE SET orden = EXCLUDED.orden;

-- Reorder existing damas categories in the tournament categories table
UPDATE public.categorias SET orden = 16 WHERE nombre = '6ta' AND genero = 'damas';
UPDATE public.categorias SET orden = 17 WHERE nombre = '7ma' AND genero = 'damas';
UPDATE public.categorias SET orden = 18 WHERE nombre = '8va' AND genero = 'damas';

-- Insert missing damas categories
INSERT INTO public.categorias (nombre, genero, orden) VALUES
  ('1ra', 'damas', 11),
  ('2da', 'damas', 12),
  ('3ra', 'damas', 13),
  ('4ta', 'damas', 14),
  ('5ta', 'damas', 15)
ON CONFLICT (nombre, genero) DO UPDATE SET orden = EXCLUDED.orden;
