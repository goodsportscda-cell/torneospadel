-- Agregar 'operador' a la restricción CHECK de rol en perfiles
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('super_admin', 'club_admin', 'operador', 'jugador'));

-- RLS: Operador puede actualizar partidos_zona
DROP POLICY IF EXISTS "Operadores pueden actualizar partidos_zona" ON public.partidos_zona;
CREATE POLICY "Operadores pueden actualizar partidos_zona" ON public.partidos_zona
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

-- RLS: Operador puede actualizar partidos_llave
DROP POLICY IF EXISTS "Operadores pueden actualizar partidos_llave" ON public.partidos_llave;
CREATE POLICY "Operadores pueden actualizar partidos_llave" ON public.partidos_llave
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

-- RLS: Operador puede actualizar partidos_individuales
DROP POLICY IF EXISTS "Operadores pueden actualizar partidos_individuales" ON public.partidos_individuales;
CREATE POLICY "Operadores pueden actualizar partidos_individuales" ON public.partidos_individuales
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

-- RLS: Operador puede insertar sets (necesario para la carga de resultados)
-- sets_partido (que sirve para llaves y zonas)
DROP POLICY IF EXISTS "Operadores pueden insertar sets_partido" ON public.sets_partido;
CREATE POLICY "Operadores pueden insertar sets_partido" ON public.sets_partido
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);
DROP POLICY IF EXISTS "Operadores pueden actualizar sets_partido" ON public.sets_partido;
CREATE POLICY "Operadores pueden actualizar sets_partido" ON public.sets_partido
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);
DROP POLICY IF EXISTS "Operadores pueden eliminar sets_partido" ON public.sets_partido;
CREATE POLICY "Operadores pueden eliminar sets_partido" ON public.sets_partido
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

-- sets_partido_individual
DROP POLICY IF EXISTS "Operadores pueden insertar sets_partido_individual" ON public.sets_partido_individual;
CREATE POLICY "Operadores pueden insertar sets_partido_individual" ON public.sets_partido_individual
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);
DROP POLICY IF EXISTS "Operadores pueden actualizar sets_partido_individual" ON public.sets_partido_individual;
CREATE POLICY "Operadores pueden actualizar sets_partido_individual" ON public.sets_partido_individual
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);
DROP POLICY IF EXISTS "Operadores pueden eliminar sets_partido_individual" ON public.sets_partido_individual;
CREATE POLICY "Operadores pueden eliminar sets_partido_individual" ON public.sets_partido_individual
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);
