import { supabase } from "@/integrations/supabase/client";

export function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

const PERFIL_LINK_REGEX = /\[PERFIL_ID:([0-9a-fA-F-]{36})\]/i;
const PERFIL_UNLINK_GLOBAL_REGEX = /\[PERFIL_DESVINCULADO:([0-9a-fA-F-]{36})\]/gi;
const ALL_PERFIL_TAGS_REGEX = /\[(?:PERFIL_ID|PERFIL_DESVINCULADO):[0-9a-fA-F-]{36}\]\s*/gi;

export function extractLinkedPerfilIdFromNotas(notas: string | null | undefined): string | null {
  if (!notas) return null;
  const match = notas.match(PERFIL_LINK_REGEX);
  return match && match[1] ? match[1].toLowerCase() : null;
}

export function extractUnlinkedPerfilIdsFromNotas(notas: string | null | undefined): Set<string> {
  const result = new Set<string>();
  if (!notas) return result;
  let match: RegExpExecArray | null;
  const regex = new RegExp(PERFIL_UNLINK_GLOBAL_REGEX.source, "gi");
  while ((match = regex.exec(notas)) !== null) {
    if (match[1]) result.add(match[1].toLowerCase());
  }
  return result;
}

export function stripPerfilTagsFromNotas(notas: string | null | undefined): string {
  if (!notas) return "";
  return notas.replace(ALL_PERFIL_TAGS_REGEX, "").trim();
}

export function buildNotasWithPerfilLink(
  currentNotas: string | null | undefined,
  perfilId: string
): string {
  const clean = stripPerfilTagsFromNotas(currentNotas);
  return `${clean} [PERFIL_ID:${perfilId}]`.trim();
}

export function buildNotasWithPerfilUnlink(
  currentNotas: string | null | undefined,
  perfilId: string
): string {
  const clean = stripPerfilTagsFromNotas(currentNotas);
  return `${clean} [PERFIL_DESVINCULADO:${perfilId}]`.trim();
}

export interface RawPerfilRow {
  id: string;
  email?: string | null;
  rol?: string | null;
  club_id?: string | null;
  created_at?: string | null;
  jugador_id?: string | null;
}

export interface RawProfileBridgeRow {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  jugador_id?: string | null;
}

export interface RawJugadorRow {
  id: string;
  nombre: string;
  apellido: string;
  dni?: string | null;
  email?: string | null;
  telefono?: string | null;
  club?: string | null;
  genero?: string | null;
  categoria_id?: string | null;
  notas?: string | null;
}

/**
 * Resuelve de forma determinística y 1-a-1 el vínculo entre perfiles registrados y fichas de jugadores.
 * Previene que dos perfiles distintos queden atados al mismo jugador_id al mismo tiempo.
 */
export function resolvePerfilesJugadorLinks(params: {
  perfiles: RawPerfilRow[];
  profilesBridge?: RawProfileBridgeRow[];
  jugadores: RawJugadorRow[];
}): {
  jugadorIdByPerfilId: Map<string, string>;
  perfilByJugadorId: Map<string, { id: string; email: string; rol: string; club_id: string | null; created_at: string | null }>;
} {
  const { perfiles, profilesBridge = [], jugadores } = params;

  const jugadorById = new Map<string, RawJugadorRow>();
  const explicitPerfilIdToJugadorIdFromNotas = new Map<string, string>();
  const unlinkedPerfilIdsByJugadorId = new Map<string, Set<string>>();

  for (const j of jugadores) {
    jugadorById.set(j.id, j);
    const linkedPId = extractLinkedPerfilIdFromNotas(j.notas);
    if (linkedPId && !explicitPerfilIdToJugadorIdFromNotas.has(linkedPId)) {
      explicitPerfilIdToJugadorIdFromNotas.set(linkedPId, j.id);
    }
    const unlinkedSet = extractUnlinkedPerfilIdsFromNotas(j.notas);
    if (unlinkedSet.size > 0) {
      unlinkedPerfilIdsByJugadorId.set(j.id, unlinkedSet);
    }
  }

  const bridgeByUserId = new Map<string, RawProfileBridgeRow>();
  for (const b of profilesBridge) {
    if (b?.user_id) {
      bridgeByUserId.set(b.user_id, b);
    }
  }

  const jugadorIdByPerfilId = new Map<string, string>();
  const perfilByJugadorId = new Map<
    string,
    { id: string; email: string; rol: string; club_id: string | null; created_at: string | null }
  >();

  const assignPair = (perfil: RawPerfilRow, effectiveEmail: string, jugadorId: string) => {
    if (jugadorIdByPerfilId.has(perfil.id) || perfilByJugadorId.has(jugadorId)) return false;
    if (!jugadorById.has(jugadorId)) return false;
    jugadorIdByPerfilId.set(perfil.id, jugadorId);
    perfilByJugadorId.set(jugadorId, {
      id: perfil.id,
      email: effectiveEmail,
      rol: perfil.rol || "jugador",
      club_id: perfil.club_id ?? null,
      created_at: perfil.created_at ?? null,
    });
    return true;
  };

  // Paso 1: Vínculos explícitos por columna `perfiles.jugador_id` o etiqueta `[PERFIL_ID:...]` en `jugadores.notas`
  for (const p of perfiles) {
    const bridge = bridgeByUserId.get(p.id);
    const effectiveEmail = (p.email || bridge?.email || "").trim();
    const fromNotasJId = explicitPerfilIdToJugadorIdFromNotas.get(p.id.toLowerCase());
    const explicitJId = p.jugador_id || fromNotasJId || null;
    if (explicitJId) {
      const unlinkedSet = unlinkedPerfilIdsByJugadorId.get(explicitJId);
      if (!unlinkedSet?.has(p.id.toLowerCase()) || fromNotasJId === explicitJId) {
        assignPair(p, effectiveEmail, explicitJId);
      }
    }
  }

  // Paso 2: Vínculos desde `public.profiles` (tabla puente de /mi-cuenta) si no fue desvinculado explícitamente
  for (const p of perfiles) {
    if (jugadorIdByPerfilId.has(p.id)) continue;
    const bridge = bridgeByUserId.get(p.id);
    const effectiveEmail = (p.email || bridge?.email || "").trim();
    const bridgeJId = bridge?.jugador_id || null;
    if (bridgeJId) {
      const unlinkedSet = unlinkedPerfilIdsByJugadorId.get(bridgeJId);
      if (!unlinkedSet?.has(p.id.toLowerCase())) {
        assignPair(p, effectiveEmail, bridgeJId);
      }
    }
  }

  // Paso 3: Coincidencia por email normalizado (salvo que haya sido desvinculado explícitamente)
  const jugadoresByNormEmail = new Map<string, RawJugadorRow[]>();
  for (const j of jugadores) {
    if (perfilByJugadorId.has(j.id)) continue;
    const norm = normalizeEmail(j.email);
    if (!norm) continue;
    const arr = jugadoresByNormEmail.get(norm) ?? [];
    arr.push(j);
    jugadoresByNormEmail.set(norm, arr);
  }

  for (const p of perfiles) {
    if (jugadorIdByPerfilId.has(p.id)) continue;
    const bridge = bridgeByUserId.get(p.id);
    const effectiveEmail = (p.email || bridge?.email || "").trim();
    const norm = normalizeEmail(effectiveEmail);
    if (!norm) continue;
    const candidates = jugadoresByNormEmail.get(norm) ?? [];
    for (const candidate of candidates) {
      if (perfilByJugadorId.has(candidate.id)) continue;
      const unlinkedSet = unlinkedPerfilIdsByJugadorId.get(candidate.id);
      if (unlinkedSet?.has(p.id.toLowerCase())) continue;
      if (assignPair(p, effectiveEmail, candidate.id)) {
        break;
      }
    }
  }

  return { jugadorIdByPerfilId, perfilByJugadorId };
}

/**
 * Vincula manualmente un perfil de usuario (`perfiles.id`) con una ficha deportiva (`jugadores.id`).
 * Previene que dos perfiles distintos queden atados al mismo jugador_id.
 */
export async function linkPerfilToJugador(params: {
  perfilId: string;
  perfilEmail: string;
  jugadorId: string;
  previousJugadorId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { perfilId, perfilEmail, jugadorId, previousJugadorId } = params;
  if (!perfilId || !jugadorId) {
    return { ok: false, error: "Debes seleccionar tanto el perfil como el jugador." };
  }

  try {
    // 1. Verificar ficha destino
    const { data: targetJugador, error: targetErr } = await (supabase as any)
      .from("jugadores")
      .select("id, nombre, apellido, email, notas")
      .eq("id", jugadorId)
      .maybeSingle();

    if (targetErr || !targetJugador) {
      return { ok: false, error: targetErr?.message || "No se encontró la ficha del jugador." };
    }

    const existingTagPerfilId = extractLinkedPerfilIdFromNotas(targetJugador.notas);
    if (existingTagPerfilId && existingTagPerfilId !== perfilId.toLowerCase()) {
      return {
        ok: false,
        error: "Este jugador ya tiene otro perfil vinculado. Desvinculá el perfil anterior antes de vincular uno nuevo.",
      };
    }

    // 2. Intentar RPC oficial de base de datos (si la migración ya está aplicada)
    try {
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc(
        "admin_set_perfil_jugador_link",
        {
          p_perfil_id: perfilId,
          p_jugador_id: jugadorId,
        }
      );
      if (!rpcErr && rpcRes && rpcRes.ok === false) {
        return { ok: false, error: rpcRes.error || "No se pudo vincular el perfil." };
      }
    } catch {
      // Fallback silencioso si la función aún no existe en la instancia remota
    }

    // 3. Intentar actualización directa en public.perfiles.jugador_id (si la columna ya existe)
    try {
      await (supabase as any)
        .from("perfiles")
        .update({ jugador_id: jugadorId })
        .eq("id", perfilId);
    } catch {
      // Fallback silencioso
    }

    // 4. Si el perfil estaba vinculado a otro jugador antes, limpiar el vínculo anterior sin borrar la ficha
    if (previousJugadorId && previousJugadorId !== jugadorId) {
      const { data: prevJug } = await (supabase as any)
        .from("jugadores")
        .select("id, email, notas")
        .eq("id", previousJugadorId)
        .maybeSingle();
      if (prevJug) {
        const nextPrevNotas = buildNotasWithPerfilUnlink(prevJug.notas, perfilId);
        const shouldClearPrevEmail =
          perfilEmail && normalizeEmail(prevJug.email) === normalizeEmail(perfilEmail);
        await (supabase as any)
          .from("jugadores")
          .update({
            notas: nextPrevNotas || null,
            ...(shouldClearPrevEmail ? { email: null } : {}),
          })
          .eq("id", previousJugadorId);
      }
    }

    // 5. Persistir en public.jugadores (email + etiqueta de vínculo en notas)
    const updatedNotas = buildNotasWithPerfilLink(targetJugador.notas, perfilId);
    const updatePayload: Record<string, any> = {
      notas: updatedNotas || null,
    };
    if (perfilEmail && perfilEmail.trim()) {
      updatePayload.email = perfilEmail.trim();
    }

    const { error: updateJugErr } = await (supabase as any)
      .from("jugadores")
      .update(updatePayload)
      .eq("id", jugadorId);

    if (updateJugErr) {
      return { ok: false, error: updateJugErr.message };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error inesperado al vincular perfil." };
  }
}

/**
 * Desvincula un perfil de usuario de su ficha en `jugadores` (`jugador_id = NULL`).
 * REGLA DE ORO: NUNCA borra la ficha en `jugadores` ni sus puntos, inscripciones o partidos históricos.
 */
export async function unlinkPerfilFromJugador(params: {
  perfilId: string;
  perfilEmail?: string | null;
  jugadorId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { perfilId, perfilEmail, jugadorId } = params;
  if (!perfilId || !jugadorId) {
    return { ok: false, error: "Faltan datos del perfil o jugador a desvincular." };
  }

  try {
    // 1. Intentar RPC oficial de base de datos (si la migración ya está aplicada)
    try {
      await (supabase as any).rpc("admin_set_perfil_jugador_link", {
        p_perfil_id: perfilId,
        p_jugador_id: null,
      });
    } catch {
      // Fallback silencioso
    }

    // 2. Intentar limpiar jugador_id en public.perfiles
    try {
      await (supabase as any)
        .from("perfiles")
        .update({ jugador_id: null })
        .eq("id", perfilId);
    } catch {
      // Fallback silencioso
    }

    // 3. Actualizar public.jugadores sin borrar jamás la ficha deportiva
    const { data: jug, error: fetchErr } = await (supabase as any)
      .from("jugadores")
      .select("id, email, notas")
      .eq("id", jugadorId)
      .maybeSingle();

    if (fetchErr || !jug) {
      return { ok: false, error: fetchErr?.message || "No se encontró la ficha del jugador." };
    }

    const updatedNotas = buildNotasWithPerfilUnlink(jug.notas, perfilId);
    const shouldClearEmail =
      !perfilEmail || normalizeEmail(jug.email) === normalizeEmail(perfilEmail);

    const { error: updErr } = await (supabase as any)
      .from("jugadores")
      .update({
        notas: updatedNotas || null,
        ...(shouldClearEmail ? { email: null } : {}),
      })
      .eq("id", jugadorId);

    if (updErr) {
      return { ok: false, error: updErr.message };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error inesperado al desvincular perfil." };
  }
}

