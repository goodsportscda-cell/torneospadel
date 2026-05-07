
-- Add jugador_id to profiles so users can link to their player record
ALTER TABLE public.profiles ADD COLUMN jugador_id uuid;

-- Allow users to insert their own profile (needed for edge cases)
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
