-- RLS: Permitir a los club_admin actualizar roles de usuarios que pertenecen a su club o no tienen club asignado todavia
DROP POLICY IF EXISTS "Club admins pueden actualizar perfiles para operadores" ON public.perfiles;
CREATE POLICY "Club admins pueden actualizar perfiles para operadores" ON public.perfiles
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.perfiles admin 
        WHERE admin.id = auth.uid() 
          AND admin.rol = 'club_admin' 
          AND (perfiles.club_id = admin.club_id OR perfiles.club_id IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.perfiles admin 
        WHERE admin.id = auth.uid() 
          AND admin.rol = 'club_admin' 
          AND (perfiles.club_id = admin.club_id OR perfiles.club_id IS NULL)
    )
);
