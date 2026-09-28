-- Club deletion is restricted to superadmins. The application also refuses to
-- delete clubs that still have tournaments or categories linked to them.
DROP POLICY IF EXISTS "Solo superadmins eliminan clubes" ON public.clubes;

CREATE POLICY "Solo superadmins eliminan clubes"
ON public.clubes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfiles
    WHERE perfiles.id = (SELECT auth.uid())
      AND perfiles.rol = 'super_admin'
  )
);
