-- Función reutilizable para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Enums
CREATE TYPE public.genero_categoria AS ENUM ('caballeros', 'damas', 'mixto');
CREATE TYPE public.tipo_torneo AS ENUM ('oficial', 'americano');
CREATE TYPE public.estado_torneo AS ENUM (
  'inscripciones_abiertas',
  'inscripciones_cerradas',
  'en_curso',
  'finalizado',
  'cancelado'
);

-- Tabla categorias
CREATE TABLE public.categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  genero public.genero_categoria NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (nombre, genero)
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias visibles para todos"
  ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear categorias (pre-auth)"
  ON public.categorias FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar categorias (pre-auth)"
  ON public.categorias FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar categorias (pre-auth)"
  ON public.categorias FOR DELETE USING (true);

-- Tabla torneos
CREATE TABLE public.torneos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo public.tipo_torneo NOT NULL DEFAULT 'oficial',
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  categoria_libre TEXT,
  genero public.genero_categoria,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  sede TEXT,
  costo_inscripcion NUMERIC(10,2),
  premios TEXT,
  estado public.estado_torneo NOT NULL DEFAULT 'inscripciones_abiertas',
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.torneos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Torneos visibles para todos"
  ON public.torneos FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede crear torneos (pre-auth)"
  ON public.torneos FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar torneos (pre-auth)"
  ON public.torneos FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar torneos (pre-auth)"
  ON public.torneos FOR DELETE USING (true);

CREATE TRIGGER update_torneos_updated_at
  BEFORE UPDATE ON public.torneos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_torneos_estado ON public.torneos(estado);
CREATE INDEX idx_torneos_fecha_inicio ON public.torneos(fecha_inicio DESC);

-- Precarga categorías oficiales
INSERT INTO public.categorias (nombre, genero, orden) VALUES
  ('Suma 7', 'caballeros', 1),
  ('5ta', 'caballeros', 2),
  ('6ta', 'caballeros', 3),
  ('7ma', 'caballeros', 4),
  ('8va', 'caballeros', 5),
  ('6ta', 'damas', 10),
  ('7ma', 'damas', 11),
  ('8va', 'damas', 12);