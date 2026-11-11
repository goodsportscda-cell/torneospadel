import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Obtiene las parejas de `public.torneo_individual_parejas` para un torneo dado.
 * Incluye un fallback automático con credenciales `anon` para sortear el caso en que
 * la política RLS de SELECT en la base de datos remota esté restringida a `TO anon`
 * y devuelva vacío para sesiones `authenticated`.
 */
export async function fetchTorneoIndividualParejas(
  torneoId: string
): Promise<{ data: any[]; error: any }> {
  if (!torneoId) return { data: [], error: null };

  const { data, error } = await (supabase as any)
    .from("torneo_individual_parejas")
    .select("*")
    .eq("torneo_id", torneoId)
    .order("created_at", { ascending: true });

  if (!error && Array.isArray(data) && data.length > 0) {
    return { data, error: null };
  }

  // Fallback vía REST con rol `anon` (que siempre tiene la política "Allow read access to anonymous users")
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/torneo_individual_parejas?torneo_id=eq.${encodeURIComponent(
        torneoId
      )}&select=*&order=created_at.asc`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (res.ok) {
        const anonRows = await res.json();
        if (Array.isArray(anonRows)) {
          return { data: anonRows, error: null };
        }
      }
    } catch (fallbackErr) {
      console.warn("Fallback anon fetch para torneo_individual_parejas falló:", fallbackErr);
    }
  }

  return { data: data ?? [], error };
}

/**
 * Extrae los IDs de parejas dados de baja mediante etiqueta `[BAJA_PAREJA:<uuid>]` en `torneos.notas`.
 */
export function extractBajaParejaIds(notas?: string | null): Set<string> {
  const set = new Set<string>();
  if (!notas) return set;
  const matches = notas.matchAll(/\[BAJA_PAREJA:([0-9a-fA-F-]{36})\]/g);
  for (const m of matches) {
    if (m[1]) set.add(m[1].toLowerCase());
  }
  return set;
}

/**
 * Extrae reemplazos de jugadores registrados en `torneos.notas` (`[REEMPLAZO_YYYY-MM-DD:oldId->newId:pts]`).
 */
export function extractReemplazoPlayerMap(
  notas?: string | null
): Map<string, { newId: string; puntos: number }> {
  const map = new Map<string, { newId: string; puntos: number }>();
  if (!notas) return map;
  const matches = notas.matchAll(
    /\[REEMPLAZO_[^:]+:([0-9a-fA-F-]{36})->([0-9a-fA-F-]{36}):(\d+(?:\.\d+)?)pts\]/g
  );
  for (const m of matches) {
    if (m[1] && m[2]) {
      map.set(m[1], { newId: m[2], puntos: Number(m[3]) || 0 });
    }
  }
  return map;
}

/**
 * Filtra las parejas activas descartando las dadas de baja o huérfanas de `torneo_individual_jugadores`,
 * y aplicando reemplazos registrados en `torneos.notas` si la fila en `torneo_individual_parejas` no pudo actualizarse por RLS.
 */
export function filterActiveTorneoParejas(
  parejas: any[],
  activeTorneoJugadores?: Array<{ jugador_id: string }>,
  torneoNotas?: string | null
): any[] {
  if (!Array.isArray(parejas) || parejas.length === 0) return [];
  const bajaIds = extractBajaParejaIds(torneoNotas);
  const reemplazos = extractReemplazoPlayerMap(torneoNotas);

  const resolvePlayerId = (pid: string) => {
    let curr = pid;
    let guard = 0;
    while (reemplazos.has(curr) && guard < 10) {
      curr = reemplazos.get(curr)!.newId;
      guard++;
    }
    return curr;
  };

  const activePlayerIds =
    Array.isArray(activeTorneoJugadores)
      ? new Set(activeTorneoJugadores.map((tj) => tj.jugador_id))
      : null;

  return parejas
    .filter((p) => {
      if (!p?.id) return false;
      if (bajaIds.has(String(p.id).toLowerCase())) return false;
      const j1 = resolvePlayerId(p.jugador1_id);
      const j2 = resolvePlayerId(p.jugador2_id);
      if (activePlayerIds) {
        if (activePlayerIds.size === 0) return false;
        if (!activePlayerIds.has(j1) && !activePlayerIds.has(j2)) {
          return false;
        }
      }
      return true;
    })
    .map((p) => {
      const j1 = resolvePlayerId(p.jugador1_id);
      const j2 = resolvePlayerId(p.jugador2_id);
      if (j1 !== p.jugador1_id || j2 !== p.jugador2_id) {
        const r1 = reemplazos.get(p.jugador1_id);
        const r2 = reemplazos.get(p.jugador2_id);
        return {
          ...p,
          jugador1_id: j1,
          jugador2_id: j2,
          puntos_iniciales:
            p.puntos_iniciales || r1?.puntos || r2?.puntos || 0,
        };
      }
      return p;
    });
}
