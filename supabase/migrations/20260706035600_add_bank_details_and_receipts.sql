-- Agregar campos para el flujo de pago manual
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS datos_bancarios TEXT;
ALTER TABLE public.inscripciones ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- Crear un bucket de storage para los comprobantes
INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para el bucket (storage.objects)
-- Cualquiera puede subir un comprobante (necesario para la inscripción pública)
CREATE POLICY "Cualquiera puede subir comprobantes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'comprobantes');

-- Solo admins o el público (para ver sus propios comprobantes?) 
-- Como es público, todos pueden leer de ese bucket (public = true en el insert inicial).
-- Pero explícitamente agregamos política de select
CREATE POLICY "Comprobantes publicamente visibles"
ON storage.objects FOR SELECT
USING (bucket_id = 'comprobantes');
