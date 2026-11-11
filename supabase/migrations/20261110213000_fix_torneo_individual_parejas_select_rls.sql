-- Permitir lectura (SELECT) de public.torneo_individual_parejas también a usuarios autenticados (admins, operadores y jugadores logueados)
-- Anteriormente solo existía la política "Allow read access to anonymous users" (TO anon), por lo que al estar autenticado el SELECT devolvía 0 filas.

DROP POLICY IF EXISTS "Allow read access to anonymous users" ON public.torneo_individual_parejas;
DROP POLICY IF EXISTS "Parejas de torneo individual visibles para todos" ON public.torneo_individual_parejas;

CREATE POLICY "Parejas de torneo individual visibles para todos"
ON public.torneo_individual_parejas
FOR SELECT
TO anon, authenticated
USING (true);

