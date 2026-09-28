-- Public contact channels only. Do not reuse private player/staff phone numbers.
ALTER TABLE public.clubes
  ADD COLUMN IF NOT EXISTS contacto_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS contacto_email TEXT;

ALTER TABLE public.clubes
  ADD CONSTRAINT clubes_contacto_whatsapp_valido CHECK (
    contacto_whatsapp IS NULL OR contacto_whatsapp ~ '^[1-9][0-9]{7,14}$'
  ),
  ADD CONSTRAINT clubes_contacto_email_valido CHECK (
    contacto_email IS NULL OR (
      length(contacto_email) <= 254 AND
      contacto_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

-- Preserve the existing club ownership rules for both old and new row values.
ALTER POLICY "Admins pueden editar su club" ON public.clubes
  TO authenticated
  USING (public.es_super_admin() OR public.es_club_admin(id))
  WITH CHECK (public.es_super_admin() OR public.es_club_admin(id));

COMMENT ON COLUMN public.clubes.contacto_whatsapp IS 'Public WhatsApp number in international digits-only format, explicitly configured by the club.';
COMMENT ON COLUMN public.clubes.contacto_email IS 'Public support email explicitly configured by the club.';
