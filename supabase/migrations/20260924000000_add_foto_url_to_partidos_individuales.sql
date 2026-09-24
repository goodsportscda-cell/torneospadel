-- Migration: Add foto_url to partidos_individuales for TV Mode and multimedia display
ALTER TABLE public.partidos_individuales ADD COLUMN IF NOT EXISTS foto_url text;
