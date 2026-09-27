-- Keep role assignment available only through a server-validated operation
-- and record every change to a profile's role or club.

CREATE TABLE IF NOT EXISTS public.auditoria_roles_perfiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  email_actor TEXT NOT NULL DEFAULT '',
  perfil_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  email_objetivo TEXT NOT NULL DEFAULT '',
  rol_anterior TEXT NOT NULL,
  rol_nuevo TEXT NOT NULL,
  club_anterior_id UUID REFERENCES public.clubes(id) ON DELETE SET NULL,
  club_nuevo_id UUID REFERENCES public.clubes(id) ON DELETE SET NULL,
  cambiado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_roles_perfiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_roles_perfiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.auditoria_roles_perfiles TO authenticated;

DROP POLICY IF EXISTS "Solo superadmins leen auditoria de roles" ON public.auditoria_roles_perfiles;
CREATE POLICY "Solo superadmins leen auditoria de roles"
ON public.auditoria_roles_perfiles FOR SELECT TO authenticated
USING (public.current_profile_role() = 'super_admin');

CREATE OR REPLACE FUNCTION public.audit_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_email TEXT;
BEGIN
  IF OLD.rol IS DISTINCT FROM NEW.rol OR OLD.club_id IS DISTINCT FROM NEW.club_id THEN
    SELECT p.email INTO v_actor_email
    FROM public.perfiles p
    WHERE p.id = auth.uid();

    INSERT INTO public.auditoria_roles_perfiles (
      actor_id, email_actor, perfil_id, email_objetivo, rol_anterior, rol_nuevo,
      club_anterior_id, club_nuevo_id
    ) VALUES (
      auth.uid(), COALESCE(v_actor_email, ''), NEW.id, COALESCE(NEW.email, ''), OLD.rol::TEXT, NEW.rol::TEXT,
      OLD.club_id, NEW.club_id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_profile_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_profile_role_change_after_update ON public.perfiles;
CREATE TRIGGER audit_profile_role_change_after_update
AFTER UPDATE OF rol, club_id ON public.perfiles
FOR EACH ROW
WHEN (OLD.rol IS DISTINCT FROM NEW.rol OR OLD.club_id IS DISTINCT FROM NEW.club_id)
EXECUTE FUNCTION public.audit_profile_role_change();

CREATE OR REPLACE FUNCTION public.assign_club_admin(
  p_perfil_id UUID,
  p_club_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role TEXT;
  v_target RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Iniciá sesión como superadmin para asignar administradores.');
  END IF;

  SELECT p.rol::TEXT INTO v_actor_role
  FROM public.perfiles p
  WHERE p.id = auth.uid();

  IF v_actor_role IS DISTINCT FROM 'super_admin' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Solo un superadmin puede asignar administradores de club.');
  END IF;

  IF p_perfil_id IS NULL OR p_club_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Seleccioná un usuario y un club.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clubes c WHERE c.id = p_club_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'El club seleccionado no existe.');
  END IF;

  SELECT p.id, p.email, p.rol::TEXT AS rol, p.club_id
  INTO v_target
  FROM public.perfiles p
  WHERE p.id = p_perfil_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'No se encontró la cuenta seleccionada.');
  END IF;

  IF v_target.rol = 'super_admin' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'No se puede cambiar el rol de otro superadmin desde esta pantalla.');
  END IF;

  IF v_target.rol = 'club_admin' AND v_target.club_id = p_club_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'ya_asignado', true, 'email', v_target.email, 'club_id', p_club_id);
  END IF;

  IF v_target.club_id IS NOT NULL AND v_target.club_id <> p_club_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'Esta cuenta ya pertenece a otro club. Revisá su asignación antes de cambiarla.');
  END IF;

  UPDATE public.perfiles
  SET rol = 'club_admin', club_id = p_club_id
  WHERE id = p_perfil_id;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'ya_asignado', false, 'email', v_target.email, 'club_id', p_club_id);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_club_admin(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_club_admin(UUID, UUID) TO authenticated;

