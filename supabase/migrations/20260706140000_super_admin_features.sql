-- 1. Agregar columna email a public.perfiles
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Actualizar perfiles existentes con emails desde auth.users (si es posible, aunque auth.users está protegido, en modo postgres lo permite)
UPDATE public.perfiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 3. Crear función de trigger para manejar nuevos registros en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol, email)
  VALUES (NEW.id, 'jugador', NEW.email);
  RETURN NEW;
END;
$$;

-- 4. Crear el trigger en auth.users (si ya existe, lo eliminamos primero para no duplicar)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Actualizar políticas RLS de perfiles para que los Super Admins puedan leer todos (necesario para buscar)
-- Nota: La política "Perfiles publicos para lectura" (SELECT USING true) ya debería existir de la migración anterior.
-- Pero nos aseguramos de que el Super Admin tenga acceso completo por si acaso, usando una política específica.
DROP POLICY IF EXISTS "Super admins pueden leer todos los perfiles" ON public.perfiles;
CREATE POLICY "Super admins pueden leer todos los perfiles" 
ON public.perfiles FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin')
    OR true -- Ya era publico, pero dejamos esto claro.
);

DROP POLICY IF EXISTS "Super admins pueden actualizar perfiles" ON public.perfiles;
CREATE POLICY "Super admins pueden actualizar perfiles" 
ON public.perfiles FOR UPDATE 
USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE perfiles.id = auth.uid() AND perfiles.rol = 'super_admin')
);
