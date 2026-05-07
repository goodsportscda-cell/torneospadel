
-- 1. Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Tabla de perfiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles visibles para usuarios autenticados"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabla de roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Función has_role (security definer para evitar recursión RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Políticas RLS para user_roles
CREATE POLICY "Usuarios autenticados pueden ver roles"
  ON public.user_roles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Solo admins pueden gestionar roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Trigger: crear profile + asignar primer admin automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Crear perfil
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  -- ¿Es el primer usuario? -> admin
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first_user;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. ACTUALIZAR RLS de tablas existentes: lectura pública, escritura solo admin

-- categorias
DROP POLICY IF EXISTS "Cualquiera puede crear categorias (pre-auth)" ON public.categorias;
DROP POLICY IF EXISTS "Cualquiera puede actualizar categorias (pre-auth)" ON public.categorias;
DROP POLICY IF EXISTS "Cualquiera puede eliminar categorias (pre-auth)" ON public.categorias;
CREATE POLICY "Solo admins crean categorias" ON public.categorias FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan categorias" ON public.categorias FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan categorias" ON public.categorias FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- categorias_jugadores
DROP POLICY IF EXISTS "Cualquiera puede crear cat. jugadores (pre-auth)" ON public.categorias_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede actualizar cat. jugadores (pre-auth)" ON public.categorias_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede eliminar cat. jugadores (pre-auth)" ON public.categorias_jugadores;
CREATE POLICY "Solo admins crean cat jugadores" ON public.categorias_jugadores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan cat jugadores" ON public.categorias_jugadores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan cat jugadores" ON public.categorias_jugadores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- cupos_master
DROP POLICY IF EXISTS "Cualquiera puede crear cupos master (pre-auth)" ON public.cupos_master;
DROP POLICY IF EXISTS "Cualquiera puede actualizar cupos master (pre-auth)" ON public.cupos_master;
DROP POLICY IF EXISTS "Cualquiera puede eliminar cupos master (pre-auth)" ON public.cupos_master;
CREATE POLICY "Solo admins crean cupos master" ON public.cupos_master FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan cupos master" ON public.cupos_master FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan cupos master" ON public.cupos_master FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- inscripciones
DROP POLICY IF EXISTS "Cualquiera puede crear inscripciones (pre-auth)" ON public.inscripciones;
DROP POLICY IF EXISTS "Cualquiera puede actualizar inscripciones (pre-auth)" ON public.inscripciones;
DROP POLICY IF EXISTS "Cualquiera puede eliminar inscripciones (pre-auth)" ON public.inscripciones;
CREATE POLICY "Solo admins crean inscripciones" ON public.inscripciones FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan inscripciones" ON public.inscripciones FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan inscripciones" ON public.inscripciones FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- jugadores
DROP POLICY IF EXISTS "Cualquiera puede crear jugadores (pre-auth)" ON public.jugadores;
DROP POLICY IF EXISTS "Cualquiera puede actualizar jugadores (pre-auth)" ON public.jugadores;
DROP POLICY IF EXISTS "Cualquiera puede eliminar jugadores (pre-auth)" ON public.jugadores;
CREATE POLICY "Solo admins crean jugadores" ON public.jugadores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan jugadores" ON public.jugadores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan jugadores" ON public.jugadores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- llaves
DROP POLICY IF EXISTS "Cualquiera puede crear llaves (pre-auth)" ON public.llaves;
DROP POLICY IF EXISTS "Cualquiera puede actualizar llaves (pre-auth)" ON public.llaves;
DROP POLICY IF EXISTS "Cualquiera puede eliminar llaves (pre-auth)" ON public.llaves;
CREATE POLICY "Solo admins crean llaves" ON public.llaves FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan llaves" ON public.llaves FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan llaves" ON public.llaves FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- partidos_llave
DROP POLICY IF EXISTS "Cualquiera puede crear partidos_llave (pre-auth)" ON public.partidos_llave;
DROP POLICY IF EXISTS "Cualquiera puede actualizar partidos_llave (pre-auth)" ON public.partidos_llave;
DROP POLICY IF EXISTS "Cualquiera puede eliminar partidos_llave (pre-auth)" ON public.partidos_llave;
CREATE POLICY "Solo admins crean partidos_llave" ON public.partidos_llave FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan partidos_llave" ON public.partidos_llave FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan partidos_llave" ON public.partidos_llave FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- partidos_zona
DROP POLICY IF EXISTS "Cualquiera puede crear partidos_zona (pre-auth)" ON public.partidos_zona;
DROP POLICY IF EXISTS "Cualquiera puede actualizar partidos_zona (pre-auth)" ON public.partidos_zona;
DROP POLICY IF EXISTS "Cualquiera puede eliminar partidos_zona (pre-auth)" ON public.partidos_zona;
CREATE POLICY "Solo admins crean partidos_zona" ON public.partidos_zona FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan partidos_zona" ON public.partidos_zona FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan partidos_zona" ON public.partidos_zona FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- puntos_ranking
DROP POLICY IF EXISTS "Cualquiera puede crear puntos_ranking (pre-auth)" ON public.puntos_ranking;
DROP POLICY IF EXISTS "Cualquiera puede actualizar puntos_ranking (pre-auth)" ON public.puntos_ranking;
DROP POLICY IF EXISTS "Cualquiera puede eliminar puntos_ranking (pre-auth)" ON public.puntos_ranking;
CREATE POLICY "Solo admins crean puntos_ranking" ON public.puntos_ranking FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan puntos_ranking" ON public.puntos_ranking FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan puntos_ranking" ON public.puntos_ranking FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ranking_jugadores
DROP POLICY IF EXISTS "Cualquiera puede crear ranking (pre-auth)" ON public.ranking_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede actualizar ranking (pre-auth)" ON public.ranking_jugadores;
DROP POLICY IF EXISTS "Cualquiera puede eliminar ranking (pre-auth)" ON public.ranking_jugadores;
CREATE POLICY "Solo admins crean ranking" ON public.ranking_jugadores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan ranking" ON public.ranking_jugadores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan ranking" ON public.ranking_jugadores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- sets_partido
DROP POLICY IF EXISTS "Cualquiera puede crear sets (pre-auth)" ON public.sets_partido;
DROP POLICY IF EXISTS "Cualquiera puede actualizar sets (pre-auth)" ON public.sets_partido;
DROP POLICY IF EXISTS "Cualquiera puede eliminar sets (pre-auth)" ON public.sets_partido;
CREATE POLICY "Solo admins crean sets" ON public.sets_partido FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan sets" ON public.sets_partido FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan sets" ON public.sets_partido FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- torneos
DROP POLICY IF EXISTS "Cualquiera puede crear torneos (pre-auth)" ON public.torneos;
DROP POLICY IF EXISTS "Cualquiera puede actualizar torneos (pre-auth)" ON public.torneos;
DROP POLICY IF EXISTS "Cualquiera puede eliminar torneos (pre-auth)" ON public.torneos;
CREATE POLICY "Solo admins crean torneos" ON public.torneos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan torneos" ON public.torneos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan torneos" ON public.torneos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- zonas
DROP POLICY IF EXISTS "Cualquiera puede crear zonas (pre-auth)" ON public.zonas;
DROP POLICY IF EXISTS "Cualquiera puede actualizar zonas (pre-auth)" ON public.zonas;
DROP POLICY IF EXISTS "Cualquiera puede eliminar zonas (pre-auth)" ON public.zonas;
CREATE POLICY "Solo admins crean zonas" ON public.zonas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan zonas" ON public.zonas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan zonas" ON public.zonas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- zonas_parejas
DROP POLICY IF EXISTS "Cualquiera puede crear zonas_parejas (pre-auth)" ON public.zonas_parejas;
DROP POLICY IF EXISTS "Cualquiera puede actualizar zonas_parejas (pre-auth)" ON public.zonas_parejas;
DROP POLICY IF EXISTS "Cualquiera puede eliminar zonas_parejas (pre-auth)" ON public.zonas_parejas;
CREATE POLICY "Solo admins crean zonas_parejas" ON public.zonas_parejas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins actualizan zonas_parejas" ON public.zonas_parejas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admins eliminan zonas_parejas" ON public.zonas_parejas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
