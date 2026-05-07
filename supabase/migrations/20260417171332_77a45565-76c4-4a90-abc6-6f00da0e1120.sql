-- DNI obligatorio y único en jugadores
ALTER TABLE public.jugadores
  ALTER COLUMN dni SET NOT NULL;

ALTER TABLE public.jugadores
  ADD CONSTRAINT jugadores_dni_unique UNIQUE (dni);