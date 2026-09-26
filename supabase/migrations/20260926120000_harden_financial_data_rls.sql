-- Lock down tournament financials, registration records, and payment receipts.

CREATE OR REPLACE FUNCTION public.can_manage_tournament(p_torneo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.torneos t
    JOIN public.perfiles p ON p.id = auth.uid()
    WHERE t.id = p_torneo_id
      AND (
        p.rol = 'super_admin'
        OR (
          p.rol IN ('club_admin', 'operador')
          AND p.club_id IS NOT NULL
          AND p.club_id = t.club_id
        )
      )
  ) OR public.has_role(auth.uid(), 'admin');
$$;

REVOKE ALL ON FUNCTION public.can_manage_tournament(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_tournament(UUID) TO authenticated;

-- Expenses contain financial information and are isolated by tournament/club.
DROP POLICY IF EXISTS "Gastos visibles para usuarios autenticados" ON public.torneo_gastos;
DROP POLICY IF EXISTS "Solo admins y organizadores pueden insertar gastos" ON public.torneo_gastos;
DROP POLICY IF EXISTS "Solo admins y organizadores pueden actualizar gastos" ON public.torneo_gastos;
DROP POLICY IF EXISTS "Solo admins y organizadores pueden eliminar gastos" ON public.torneo_gastos;

CREATE POLICY "Staff autorizado lee gastos de su torneo"
ON public.torneo_gastos FOR SELECT TO authenticated
USING (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado crea gastos de su torneo"
ON public.torneo_gastos FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado actualiza gastos de su torneo"
ON public.torneo_gastos FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado elimina gastos de su torneo"
ON public.torneo_gastos FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

-- Keep public tournament results usable while withholding registration/payment data.
DROP POLICY IF EXISTS "Inscripciones visibles para todos" ON public.inscripciones;
DROP POLICY IF EXISTS "Solo admins crean inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "Solo admins actualizan inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "Solo admins eliminan inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "Operadores pueden insertar inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "Operadores pueden actualizar inscripciones" ON public.inscripciones;
DROP POLICY IF EXISTS "Operadores pueden eliminar inscripciones" ON public.inscripciones;

CREATE POLICY "Lectura de inscripciones publicas sin columnas privadas"
ON public.inscripciones FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Staff autorizado crea inscripciones de su torneo"
ON public.inscripciones FOR INSERT TO authenticated
WITH CHECK (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado actualiza inscripciones de su torneo"
ON public.inscripciones FOR UPDATE TO authenticated
USING (public.can_manage_tournament(torneo_id))
WITH CHECK (public.can_manage_tournament(torneo_id));

CREATE POLICY "Staff autorizado elimina inscripciones de su torneo"
ON public.inscripciones FOR DELETE TO authenticated
USING (public.can_manage_tournament(torneo_id));

-- Column grants prevent anonymous and ordinary authenticated clients from reading
-- payment states, amounts, notes, receipt paths, or other operational fields.
REVOKE SELECT ON public.inscripciones FROM anon, authenticated;
REVOKE SELECT ON public.inscripciones FROM PUBLIC;
GRANT SELECT (
  id, torneo_id, jugador1_id, jugador2_id, estado, fecha_inscripcion, created_at
) ON public.inscripciones TO anon, authenticated;

-- The management UI reads full rows through this filtered view. Its WHERE clause
-- is evaluated with the view owner's privileges, then only authorized rows return.
CREATE OR REPLACE VIEW public.inscripciones_admin
WITH (security_barrier = true)
AS
SELECT i.*
FROM public.inscripciones i
WHERE public.can_manage_tournament(i.torneo_id);

GRANT SELECT ON public.inscripciones_admin TO authenticated;

-- A linked player may see their own payment state without granting that column
-- across every registration row to authenticated clients.
CREATE OR REPLACE FUNCTION public.get_my_inscription_payment_status(p_jugador_id UUID)
RETURNS TABLE (inscripcion_id UUID, estado_pago public.estado_pago)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.id, i.estado_pago
  FROM public.inscripciones i
  WHERE (i.jugador1_id = p_jugador_id OR i.jugador2_id = p_jugador_id)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.jugador_id = p_jugador_id
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_inscription_payment_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_inscription_payment_status(UUID) TO authenticated;

-- Make receipts private. Public uploads are limited to open tournaments and
-- receipt-like files in that tournament's own storage prefix.
UPDATE storage.buckets
SET public = false
WHERE id = 'comprobantes';

DROP POLICY IF EXISTS "Cualquiera puede subir comprobantes" ON storage.objects;
DROP POLICY IF EXISTS "Comprobantes publicamente visibles" ON storage.objects;

CREATE POLICY "Inscripcion publica carga comprobante acotado"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'comprobantes'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'pdf', 'webp')
  AND COALESCE((metadata->>'size')::BIGINT, 0) BETWEEN 1 AND 5242880
  AND EXISTS (
    SELECT 1 FROM public.torneos t
    WHERE t.id::TEXT = (storage.foldername(name))[1]
      AND t.estado = 'inscripciones_abiertas'
  )
);

CREATE POLICY "Staff autorizado lee comprobantes"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'comprobantes'
  AND EXISTS (
    SELECT 1 FROM public.torneos t
    WHERE t.id::TEXT = (storage.foldername(name))[1]
      AND public.can_manage_tournament(t.id)
  )
);

-- Match photos use a separate public media bucket so public score pages continue
-- working without making uploaded bank receipts public. After this migration,
-- run scripts/migrate_partido_photos_to_bucket.mjs to copy existing objects and
-- update their stored URLs; the script is read-only unless passed --apply.
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-partidos', 'fotos-partidos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Staff autorizado carga fotos de partidos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fotos-partidos'
  AND (storage.foldername(name))[1] = 'partidos'
  AND public.can_manage_tournament(((storage.foldername(name))[2])::UUID)
);
