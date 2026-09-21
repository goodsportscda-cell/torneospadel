-- 1. Actualizar todos los torneos finalizados para que tengan ranking_publicado = true
UPDATE public.torneos 
SET ranking_publicado = true 
WHERE estado = 'finalizado';

-- 2. Asegurar que los torneos sin club_id pertenezcan al club principal (Goodsports)
UPDATE public.torneos 
SET club_id = (SELECT id FROM public.clubes WHERE slug = 'goodsports' LIMIT 1) 
WHERE club_id IS NULL;
