-- Restrict profile visibility and prevent users from changing their own role.
-- Apply this migration to Supabase before relying on these rules in production.

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.rol FROM public.perfiles AS p WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_profile_club_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.club_id FROM public.perfiles AS p WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_profile_club_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_club_id() TO authenticated;

DROP POLICY IF EXISTS "Perfiles publicos para lectura" ON public.perfiles;
DROP POLICY IF EXISTS "Super admins pueden leer todos los perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Super admins pueden actualizar perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Super admins pueden insertar perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Club admins pueden actualizar perfiles para operadores" ON public.perfiles;

CREATE POLICY "Usuarios leen su perfil y admins los perfiles permitidos"
ON public.perfiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.current_profile_role() = 'super_admin'
  OR (
    public.current_profile_role() = 'club_admin'
    AND (club_id = public.current_profile_club_id() OR club_id IS NULL)
  )
);

REVOKE UPDATE ON public.perfiles FROM anon, authenticated;
GRANT UPDATE (rol, club_id) ON public.perfiles TO authenticated;

CREATE POLICY "Solo super admins cambian perfiles"
ON public.perfiles FOR UPDATE TO authenticated
USING (public.current_profile_role() = 'super_admin')
WITH CHECK (public.current_profile_role() = 'super_admin');

CREATE POLICY "Admins asignan operadores de su club"
ON public.perfiles FOR UPDATE TO authenticated
USING (
  public.current_profile_role() = 'club_admin'
  AND rol IN ('jugador', 'operador')
  AND (club_id = public.current_profile_club_id() OR club_id IS NULL)
)
WITH CHECK (
  public.current_profile_role() = 'club_admin'
  AND (
    (rol = 'operador' AND club_id = public.current_profile_club_id())
    OR (rol = 'jugador' AND club_id IS NULL)
  )
);
