-- Migration: Añadir Franjas Horarias y Disponibilidades

-- 1. Agregar columna canchas_disponibles a torneos
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS canchas_disponibles INTEGER DEFAULT 3;

-- 2. Crear tabla torneo_franjas_horarias
CREATE TABLE IF NOT EXISTS public.torneo_franjas_horarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
    dia_nombre TEXT NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    label_franja TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en torneo_franjas_horarias
ALTER TABLE public.torneo_franjas_horarias ENABLE ROW LEVEL SECURITY;

-- Políticas para torneo_franjas_horarias
CREATE POLICY "franjas_read_all" ON public.torneo_franjas_horarias FOR SELECT USING (true);
CREATE POLICY "franjas_insert_admin" ON public.torneo_franjas_horarias FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol IN ('admin', 'superadmin'))
);
CREATE POLICY "franjas_update_admin" ON public.torneo_franjas_horarias FOR UPDATE USING (
    EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol IN ('admin', 'superadmin'))
);
CREATE POLICY "franjas_delete_admin" ON public.torneo_franjas_horarias FOR DELETE USING (
    EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol IN ('admin', 'superadmin'))
);

-- 3. Crear tabla inscripcion_disponibilidades
CREATE TABLE IF NOT EXISTS public.inscripcion_disponibilidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id UUID NOT NULL REFERENCES public.inscripciones(id) ON DELETE CASCADE,
    franja_id UUID NOT NULL REFERENCES public.torneo_franjas_horarias(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(inscripcion_id, franja_id)
);

-- Habilitar RLS en inscripcion_disponibilidades
ALTER TABLE public.inscripcion_disponibilidades ENABLE ROW LEVEL SECURITY;

-- Políticas para inscripcion_disponibilidades
CREATE POLICY "disp_read_all" ON public.inscripcion_disponibilidades FOR SELECT USING (true);
CREATE POLICY "disp_insert_all" ON public.inscripcion_disponibilidades FOR INSERT WITH CHECK (true);
CREATE POLICY "disp_delete_admin" ON public.inscripcion_disponibilidades FOR DELETE USING (
    EXISTS (SELECT 1 FROM perfiles WHERE user_id = auth.uid() AND rol IN ('admin', 'superadmin'))
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_torneo_franjas_torneo_id ON public.torneo_franjas_horarias(torneo_id);
CREATE INDEX IF NOT EXISTS idx_insc_disp_inscripcion_id ON public.inscripcion_disponibilidades(inscripcion_id);
