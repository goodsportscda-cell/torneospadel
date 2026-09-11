-- RLS para inscripciones (Torneos Americanos)
DROP POLICY IF EXISTS "Operadores pueden insertar inscripciones" ON public.inscripciones;
CREATE POLICY "Operadores pueden insertar inscripciones" ON public.inscripciones
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

DROP POLICY IF EXISTS "Operadores pueden actualizar inscripciones" ON public.inscripciones;
CREATE POLICY "Operadores pueden actualizar inscripciones" ON public.inscripciones
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

DROP POLICY IF EXISTS "Operadores pueden eliminar inscripciones" ON public.inscripciones;
CREATE POLICY "Operadores pueden eliminar inscripciones" ON public.inscripciones
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

-- RLS para torneo_individual_jugadores (Inscripciones de Torneos Individuales/Americanos)
DROP POLICY IF EXISTS "Operadores pueden insertar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
CREATE POLICY "Operadores pueden insertar torneo_individual_jugadores" ON public.torneo_individual_jugadores
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

DROP POLICY IF EXISTS "Operadores pueden actualizar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
CREATE POLICY "Operadores pueden actualizar torneo_individual_jugadores" ON public.torneo_individual_jugadores
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);

DROP POLICY IF EXISTS "Operadores pueden eliminar torneo_individual_jugadores" ON public.torneo_individual_jugadores;
CREATE POLICY "Operadores pueden eliminar torneo_individual_jugadores" ON public.torneo_individual_jugadores
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'operador')
);
