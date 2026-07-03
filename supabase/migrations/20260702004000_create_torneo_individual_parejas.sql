-- Create torneo_individual_parejas table for fixed couples in Desafíos
CREATE TABLE IF NOT EXISTS public.torneo_individual_parejas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
    jugador1_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
    jugador2_id UUID NOT NULL REFERENCES public.jugadores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_torneo_pareja UNIQUE(torneo_id, jugador1_id, jugador2_id),
    CONSTRAINT chk_different_players CHECK (jugador1_id <> jugador2_id)
);

-- Enable RLS
ALTER TABLE public.torneo_individual_parejas ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access for authenticated users (since the app has similar security policies)
CREATE POLICY "Allow all access to authenticated users" ON public.torneo_individual_parejas
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policy to allow read-only access to anon users (public wall)
CREATE POLICY "Allow read access to anonymous users" ON public.torneo_individual_parejas
    FOR SELECT
    TO anon
    USING (true);
