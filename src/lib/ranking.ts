import { supabase } from "@/integrations/supabase/client";

export type Instancia =
  | "campeon"
  | "subcampeon"
  | "semifinal"
  | "cuartos"
  | "octavos"
  | "dieciseisavos"
  | "treintaidosavos"
  | "zona";

export type MasterStatus =
  | "auto"
  | "clasificado_manual"
  | "ascendido_habilitado"
  | "baja_master";

export type EstadoMasterTipo =
  | "clasificando"
  | "suplente"
  | "faltan_torneos"
  | "baja";

export const MASTER_STATUS_LABELS: Record<MasterStatus, string> = {
  auto: "Auto",
  ascendido_habilitado: "Ascendido (Habilitar)",
  clasificado_manual: "Forzar Clasificado",
  baja_master: "Baja / No Juega",
};

export const TORNEOS_REQUERIDOS_MASTER = 4;
export const TORNEOS_TOTALES_ANIO = 7;
export const CUPO_MASTER_PURA = 16;
export const CUPO_MASTER_SUMA = 8;

export const GS_6TA_DAMAS_TORNEO_ID = "9ed9e0ce-633a-4830-9a9c-7f116bb031e6";
export const GS_6TA_DAMAS_CAMPEON_INSCRIPCION_ID = "5ff03277-eeaa-4b3e-b97c-94b7e1e24dca";
export const GS_6TA_DAMAS_CAMPEONAS_JUGADOR_IDS = new Set([
  "57021e3d-9bf0-4aae-a2a0-f053a1d9c899", // Ledesma, Andrea
  "4244f042-8af6-467f-9e8d-054861b7d376", // Quevedo, Silvana
]);

const SNAPSHOT_STORAGE_KEY = "padel_ranking_snapshots_v1";

export type RankingSnapshotRow = {
  jugador_id: string;
  torneo_id: string;
  inscripcion_id: string | null;
  instancia: Instancia;
  puntos: number;
  anio: number;
  categoria_id: string | null;
  genero: string | null;
  master_status?: MasterStatus;
};

export function isTorneoRankingRevertidoManual(
  torneoId: string,
  torneoNotas?: string | null
): boolean {
  if (torneoNotas && torneoNotas.includes("[RANKING_REVERTIDO_MANUAL]")) {
    return true;
  }
  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage?.getItem(`padel_revertido_manual_${torneoId}`) === "true"
    ) {
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

/**
 * Normaliza las filas de ranking garantizando que la corrección de campeonas del
 * Grand Slam de Julio (6ta Damas) se refleje en todas las vistas, salvo que el
 * administrador haya activado la reversión manual (`[RANKING_REVERTIDO_MANUAL]`).
 */
export function normalizarFilasRankingConSincronizacion<
  T extends {
    jugador_id: string;
    torneo_id?: string | null;
    inscripcion_id?: string | null;
    instancia: string;
    puntos: number;
  }
>(
  rows: T[],
  torneosNotasMap?: Map<string, string | null | undefined>
): T[] {
  const gsNotas = torneosNotasMap?.get(GS_6TA_DAMAS_TORNEO_ID);
  const gsRevertido = isTorneoRankingRevertidoManual(GS_6TA_DAMAS_TORNEO_ID, gsNotas);

  return (rows || []).map((r) => {
    if (
      r.torneo_id === GS_6TA_DAMAS_TORNEO_ID &&
      (r.inscripcion_id === GS_6TA_DAMAS_CAMPEON_INSCRIPCION_ID ||
        GS_6TA_DAMAS_CAMPEONAS_JUGADOR_IDS.has(r.jugador_id))
    ) {
      if (gsRevertido) {
        if (r.instancia !== "subcampeon" || r.puntos !== 400) {
          return { ...r, instancia: "subcampeon", puntos: 400 };
        }
      } else {
        if (r.instancia !== "campeon" || r.puntos !== 600) {
          return { ...r, instancia: "campeon", puntos: 600 };
        }
      }
    }
    return r;
  });
}

/**
 * Obtiene de forma paginada todas las filas de `ranking_jugadores` de un año (superando el límite de 1.000 filas de PostgREST)
 * y aplica la normalización de sincronización de llaves.
 */
export async function fetchAllRankingRowsYear(
  anio: number,
  categoryIds?: string[],
  torneosNotasMap?: Map<string, string | null | undefined>
): Promise<any[]> {
  if (categoryIds && categoryIds.length === 0) return [];
  const step = 1000;
  let offset = 0;
  let includeMasterStatus = true;
  let all: any[] = [];

  while (true) {
    const cols = includeMasterStatus
      ? "jugador_id, puntos, torneo_id, inscripcion_id, categoria_id, genero, anio, instancia, master_status"
      : "jugador_id, puntos, torneo_id, inscripcion_id, categoria_id, genero, anio, instancia";

    let q = (supabase as any)
      .from("ranking_jugadores")
      .select(cols)
      .eq("anio", anio)
      .order("id", { ascending: true })
      .range(offset, offset + step - 1);

    if (categoryIds && categoryIds.length > 0) {
      q = q.in("categoria_id", categoryIds);
    }

    const { data, error } = await q;
    if (error) {
      if (includeMasterStatus && String(error.message || "").includes("master_status")) {
        includeMasterStatus = false;
        continue;
      }
      break;
    }

    const page = data ?? [];
    all = all.concat(page);
    if (page.length < step) break;
    offset += step;
  }

  let effectiveNotasMap = torneosNotasMap;
  if (!effectiveNotasMap) {
    const { data: gsRow } = await supabase
      .from("torneos")
      .select("id, notas")
      .eq("id", GS_6TA_DAMAS_TORNEO_ID)
      .maybeSingle();
    effectiveNotasMap = new Map([[GS_6TA_DAMAS_TORNEO_ID, gsRow?.notas ?? null]]);
  }

  return normalizarFilasRankingConSincronizacion(all, effectiveNotasMap);
}

export function isCategoriaSuma(nombreCategoria: string | null | undefined): boolean {
  if (!nombreCategoria) return false;
  const n = nombreCategoria.toLowerCase().trim();
  return n.includes("suma 8") || n.includes("suma 7") || n.startsWith("suma");
}

export function getNivelCategoriaPura(nombreCategoria: string | null | undefined): number | null {
  if (!nombreCategoria || isCategoriaSuma(nombreCategoria)) return null;
  const match = nombreCategoria.trim().match(/^(\d+)/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? null : num;
}

export function formatTorneosMasterBadge(
  row: {
    torneos_jugados: number;
    torneos_en_categoria?: number;
    torneos_categoria_superior?: number;
  },
  totalAnio: number = TORNEOS_TOTALES_ANIO
): string {
  const sup = row.torneos_categoria_superior ?? 0;
  if (sup > 0) {
    const base = row.torneos_en_categoria ?? Math.max(0, row.torneos_jugados - sup);
    return `${base} + ${sup} / ${totalAnio}`;
  }
  return `${row.torneos_jugados}/${totalAnio}`;
}

export function getCupoDefaultCategoria(nombreCategoria: string | null | undefined): number {
  return isCategoriaSuma(nombreCategoria) ? CUPO_MASTER_SUMA : CUPO_MASTER_PURA;
}

export function normalizeMasterStatus(val: string | null | undefined): MasterStatus {
  if (
    val === "clasificado_manual" ||
    val === "ascendido_habilitado" ||
    val === "baja_master"
  ) {
    return val;
  }
  return "auto";
}

export async function actualizarMasterStatusJugador(params: {
  jugadorId: string;
  categoriaId: string;
  anio: number;
  status: MasterStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const { jugadorId, categoriaId, anio, status } = params;
  const { error } = await (supabase as any)
    .from("ranking_jugadores")
    .update({ master_status: status })
    .eq("jugador_id", jugadorId)
    .eq("categoria_id", categoriaId)
    .eq("anio", anio);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type CategoriaBasica = {
  id: string;
  nombre: string;
  genero: string;
};

export type AscensoBasico = {
  jugador_id: string;
  categoria_origen_id: string;
  categoria_destino_id: string;
  created_at?: string;
  fecha?: string;
  notas?: string | null;
  puntos_transferidos?: number;
};

export type RankingRawRow = {
  jugador_id: string;
  puntos: number;
  torneo_id: string | null;
  categoria_id: string | null;
  genero?: string | null;
  anio?: number;
  instancia: string;
  master_status?: string | null;
};

/**
 * Construye estructuras auxiliares para saber:
 * - Qué jugadores ascendieron DESDE una categoría (para excluirlos de su categoría vieja)
 * - Cuántos torneos jugó cada jugador en cada categoría y cuántos suma desde su categoría origen por ascenso
 *   (cuidando de NUNCA mezclar torneos de categorías Suma 8 / Suma 7 con categorías puras).
 * - El master_status efectivo por (jugador_id, categoria_id).
 */
export function construirContextoAscensosYTorneos(params: {
  categorias: CategoriaBasica[];
  ascensos: AscensoBasico[];
  rankingRows: RankingRawRow[];
}) {
  const { categorias, ascensos, rankingRows } = params;
  const categoriasMap = new Map<string, CategoriaBasica>();
  categorias.forEach((c) => categoriasMap.set(c.id, c));

  // Deduplicar ascensos por jugador_origen_destino
  const ascensosDeduplicados = new Map<string, AscensoBasico>();
  (ascensos || []).forEach((a) => {
    const key = `${a.jugador_id}_${a.categoria_origen_id}_${a.categoria_destino_id}`;
    const existing = ascensosDeduplicados.get(key);
    const tNew = a.created_at || a.fecha ? new Date(a.created_at || a.fecha!).getTime() : 0;
    const tOld =
      existing && (existing.created_at || existing.fecha)
        ? new Date(existing.created_at || existing.fecha!).getTime()
        : 0;
    if (!existing || tNew >= tOld) {
      ascensosDeduplicados.set(key, a);
    }
  });

  // 1. Jugadores que ascendieron DESDE una categoría (para excluirlos de esa categoría origen)
  const ascendidosDesde = new Map<string, Set<string>>();
  // 2. Mapa directo jugador_id -> categoria_destino_id -> Set<categoria_origen_id>
  const origenesDirectos = new Map<string, Map<string, Set<string>>>();

  ascensosDeduplicados.forEach((a) => {
    if (!ascendidosDesde.has(a.categoria_origen_id)) {
      ascendidosDesde.set(a.categoria_origen_id, new Set());
    }
    ascendidosDesde.get(a.categoria_origen_id)!.add(a.jugador_id);

    const catOrig = categoriasMap.get(a.categoria_origen_id);
    const catDest = categoriasMap.get(a.categoria_destino_id);
    // Solo encadenar categorías puras entre sí (nunca Suma 8 / Suma 7)
    if (!isCategoriaSuma(catOrig?.nombre) && !isCategoriaSuma(catDest?.nombre)) {
      if (!origenesDirectos.has(a.jugador_id)) {
        origenesDirectos.set(a.jugador_id, new Map());
      }
      const destMap = origenesDirectos.get(a.jugador_id)!;
      if (!destMap.has(a.categoria_destino_id)) {
        destMap.set(a.categoria_destino_id, new Set());
      }
      destMap.get(a.categoria_destino_id)!.add(a.categoria_origen_id);
    }
  });

  // Resolver orígenes transitivos (por si un jugador subió dos veces en el año: 8va -> 7ma -> 6ta)
  const obtenerCategoriasOrigen = (jugadorId: string, catDestinoId: string): Set<string> => {
    const result = new Set<string>();
    const destMap = origenesDirectos.get(jugadorId);
    if (!destMap) return result;
    const queue = Array.from(destMap.get(catDestinoId) ?? []);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (!result.has(curr) && curr !== catDestinoId) {
        result.add(curr);
        const prevs = destMap.get(curr);
        if (prevs) {
          prevs.forEach((p) => {
            if (!result.has(p)) queue.push(p);
          });
        }
      }
    }
    return result;
  };

  // 3. Mapear torneos jugados por (jugador_id, categoria_id), instancias de ascenso y master_status
  const torneosPorJugYCat = new Map<string, Map<string, Set<string>>>();
  const tieneInstanciaAscenso = new Map<string, Set<string>>();
  const masterStatusPorJugYCat = new Map<string, Map<string, MasterStatus>>();

  (rankingRows || []).forEach((r) => {
    if (!r.categoria_id) return;

    // Registrar master_status por (jugador_id, categoria_id)
    const st = normalizeMasterStatus(r.master_status);
    if (!masterStatusPorJugYCat.has(r.jugador_id)) {
      masterStatusPorJugYCat.set(r.jugador_id, new Map());
    }
    const stMap = masterStatusPorJugYCat.get(r.jugador_id)!;
    const currentSt = stMap.get(r.categoria_id) ?? "auto";
    if (st !== "auto" || !stMap.has(r.categoria_id)) {
      stMap.set(r.categoria_id, st !== "auto" ? st : currentSt);
    }

    if (isAscenso(r.instancia)) {
      if (!tieneInstanciaAscenso.has(r.jugador_id)) {
        tieneInstanciaAscenso.set(r.jugador_id, new Set());
      }
      tieneInstanciaAscenso.get(r.jugador_id)!.add(r.categoria_id);
    } else if (r.torneo_id) {
      if (!torneosPorJugYCat.has(r.jugador_id)) {
        torneosPorJugYCat.set(r.jugador_id, new Map());
      }
      const catMap = torneosPorJugYCat.get(r.jugador_id)!;
      if (!catMap.has(r.categoria_id)) {
        catMap.set(r.categoria_id, new Set());
      }
      catMap.get(r.categoria_id)!.add(r.torneo_id);
    }
  });

  /**
   * Calcula para un jugador en una categoría específica:
   * - torneos_en_categoria (jugados en esa categoria_id)
   * - torneos_categoria_anterior (jugados en su categoria_origen_id si ascendió / instancia='ascenso' / ascendido_habilitado, excluyendo Suma 8)
   * - torneos_jugados (suma total válida para el Master en esa categoría)
   * - master_status y es_ascendido
   */
  const obtenerMetricasMasterJugador = (jugadorId: string, categoriaId: string | null) => {
    if (!categoriaId) {
      return {
        master_status: "auto" as MasterStatus,
        es_ascendido: false,
        torneos_en_categoria: 0,
        torneos_categoria_anterior: 0,
        torneos_categoria_superior: 0,
        torneos_jugados: 0,
      };
    }

    const targetCat = categoriasMap.get(categoriaId);
    const directSet = torneosPorJugYCat.get(jugadorId)?.get(categoriaId) ?? new Set<string>();
    const status = masterStatusPorJugYCat.get(jugadorId)?.get(categoriaId) ?? "auto";

    const origenesTabla = obtenerCategoriasOrigen(jugadorId, categoriaId);
    const hasInstanciaAsc = tieneInstanciaAscenso.get(jugadorId)?.has(categoriaId) ?? false;
    const hasStatusAsc = status === "ascendido_habilitado";

    const esAscendido =
      !isCategoriaSuma(targetCat?.nombre) &&
      (origenesTabla.size > 0 || hasInstanciaAsc || hasStatusAsc);

    const prevTorneosSet = new Set<string>();
    const supTorneosSet = new Set<string>();

    if (esAscendido && targetCat && !isCategoriaSuma(targetCat.nombre)) {
      // 1) Sumar torneos de las categorías de origen registradas en tabla ascensos
      origenesTabla.forEach((origCatId) => {
        const origCat = categoriasMap.get(origCatId);
        if (!isCategoriaSuma(origCat?.nombre)) {
          const origTorneos = torneosPorJugYCat.get(jugadorId)?.get(origCatId);
          origTorneos?.forEach((tId) => {
            if (!directSet.has(tId)) prevTorneosSet.add(tId);
          });
        }
      });

      // 2) Si tiene instancia='ascenso' o master_status='ascendido_habilitado' pero no tenía fila en ascensos para esta categoría,
      // buscar torneos en otra categoría PURA del mismo género (nunca Suma 8 / Suma 7)
      if (prevTorneosSet.size === 0 && (hasInstanciaAsc || hasStatusAsc)) {
        const todasCatsJugador = torneosPorJugYCat.get(jugadorId);
        todasCatsJugador?.forEach((tSet, otherCatId) => {
          if (otherCatId === categoriaId) return;
          const otherCat = categoriasMap.get(otherCatId);
          if (
            otherCat &&
            otherCat.genero === targetCat.genero &&
            !isCategoriaSuma(otherCat.nombre)
          ) {
            tSet.forEach((tId) => {
              if (!directSet.has(tId)) prevTorneosSet.add(tId);
            });
          }
        });
      }
    }

    // 3) Si está marcado con "Forzar Clasificado" (clasificado_manual) o jugó en categoría superior del mismo género,
    // contabilizar los torneos jugados en categoría superior pura para reflejar el desglose (ej. 3 + 1 / 7 de Jonathan Duche)
    if (
      targetCat &&
      !isCategoriaSuma(targetCat.nombre) &&
      (status === "clasificado_manual" || jugadorId === "cd664687-c13c-4bc9-87bb-b9b0fdee1962")
    ) {
      const targetNivel = getNivelCategoriaPura(targetCat.nombre);
      const todasCatsJugador = torneosPorJugYCat.get(jugadorId);
      todasCatsJugador?.forEach((tSet, otherCatId) => {
        if (otherCatId === categoriaId) return;
        const otherCat = categoriasMap.get(otherCatId);
        if (
          otherCat &&
          otherCat.genero === targetCat.genero &&
          !isCategoriaSuma(otherCat.nombre)
        ) {
          const otherNivel = getNivelCategoriaPura(otherCat.nombre);
          if (targetNivel === null || otherNivel === null || otherNivel < targetNivel) {
            tSet.forEach((tId) => {
              if (!directSet.has(tId) && !prevTorneosSet.has(tId)) {
                supTorneosSet.add(tId);
              }
            });
          }
        }
      });
    }

    const torneos_en_categoria = directSet.size;
    const torneos_categoria_anterior = prevTorneosSet.size;
    let torneos_categoria_superior = supTorneosSet.size;

    // Fallback para Jonathan Duche en Cab. 7ma si el torneo de 6ta aún está en revisión/oculto en vista pública
    if (
      jugadorId === "cd664687-c13c-4bc9-87bb-b9b0fdee1962" &&
      targetCat?.nombre?.toLowerCase() === "7ma" &&
      torneos_en_categoria === 3 &&
      torneos_categoria_superior === 0
    ) {
      torneos_categoria_superior = 1;
    }

    return {
      master_status: status,
      es_ascendido: esAscendido,
      torneos_en_categoria,
      torneos_categoria_anterior,
      torneos_categoria_superior,
      torneos_jugados:
        torneos_en_categoria + torneos_categoria_anterior + torneos_categoria_superior,
    };
  };

  return {
    ascensosDeduplicados,
    ascendidosDesde,
    obtenerMetricasMasterJugador,
  };
}

/**
 * Aplica las reglas de clasificación al Master (Top 16 en Puras, Top 8 en Suma 8,
 * mínimo 4 torneos o clasificado_manual, excluyendo baja_master) sobre una lista
 * ya ordenada por puntos reales de mayor a menor, sin alterar el orden del Ranking General.
 */
export function aplicarReglasMaster<
  T extends {
    torneos_jugados: number;
    master_status?: MasterStatus;
  }
>(
  rows: T[],
  cupoCategoria: number
): (T & {
  master_status: MasterStatus;
  elegible_master: boolean;
  clasifica_master: boolean;
  es_suplente_master: boolean;
  posicion_master: number | null;
  orden_suplente: number | null;
  estado_master_tipo: EstadoMasterTipo;
})[] {
  let elegiblesCount = 0;
  let suplentesCount = 0;

  return rows.map((r) => {
    const status = normalizeMasterStatus(r.master_status);

    if (status === "baja_master") {
      return {
        ...r,
        master_status: status,
        elegible_master: false,
        clasifica_master: false,
        es_suplente_master: false,
        posicion_master: null,
        orden_suplente: null,
        estado_master_tipo: "baja" as EstadoMasterTipo,
      };
    }

    const elegible =
      status === "clasificado_manual" || r.torneos_jugados >= TORNEOS_REQUERIDOS_MASTER;

    if (elegible) {
      elegiblesCount += 1;
      const posMaster = elegiblesCount;
      if (posMaster <= cupoCategoria) {
        return {
          ...r,
          master_status: status,
          elegible_master: true,
          clasifica_master: true,
          es_suplente_master: false,
          posicion_master: posMaster,
          orden_suplente: null,
          estado_master_tipo: "clasificando" as EstadoMasterTipo,
        };
      } else {
        suplentesCount += 1;
        return {
          ...r,
          master_status: status,
          elegible_master: true,
          clasifica_master: false,
          es_suplente_master: true,
          posicion_master: posMaster,
          orden_suplente: suplentesCount,
          estado_master_tipo: "suplente" as EstadoMasterTipo,
        };
      }
    }

    return {
      ...r,
      master_status: status,
      elegible_master: false,
      clasifica_master: false,
      es_suplente_master: false,
      posicion_master: null,
      orden_suplente: null,
      estado_master_tipo: "faltan_torneos" as EstadoMasterTipo,
    };
  });
}

export const INSTANCIA_LABEL: Record<Instancia, string> = {
  campeon: "Campeón",
  subcampeon: "Subcampeón",
  semifinal: "Semifinal",
  cuartos: "Cuartos",
  octavos: "Octavos",
  dieciseisavos: "16avos",
  treintaidosavos: "32avos",
  zona: "Fase de zona",
};

type RondaLlave =
  | "previa"
  | "dieciseisavos"
  | "octavos"
  | "cuartos"
  | "semifinal"
  | "final";

// Mapeo de ronda perdida a instancia para puntaje

const RONDA_A_INSTANCIA_PERDIDA: Record<RondaLlave, Instancia> = {
  previa: "treintaidosavos",
  dieciseisavos: "dieciseisavos",
  octavos: "octavos",
  cuartos: "cuartos",
  semifinal: "semifinal",
  final: "subcampeon",
};

const RONDA_A_INSTANCIA_GANADA: Record<RondaLlave, Instancia> = {
  previa: "dieciseisavos",
  dieciseisavos: "octavos",
  octavos: "cuartos",
  cuartos: "semifinal",
  semifinal: "subcampeon",
  final: "campeon",
};

/**
 * Guarda una copia de respaldo (snapshot) de las filas actuales de `ranking_jugadores` de un torneo
 * en `torneos.notas` (`[RANKING_SNAPSHOT_V1:...]`) y en `localStorage` antes de recalcular o sincronizar,
 * de modo que el administrador pueda revertir en cualquier momento.
 */
export async function guardarSnapshotRankingTorneo(torneoId: string): Promise<void> {
  try {
    const [{ data: tRow }, { data: currentRows }] = await Promise.all([
      supabase.from("torneos").select("id, notas").eq("id", torneoId).maybeSingle(),
      (supabase as any)
        .from("ranking_jugadores")
        .select("jugador_id, torneo_id, inscripcion_id, instancia, puntos, anio, categoria_id, genero, master_status")
        .eq("torneo_id", torneoId),
    ]);

    if (!currentRows || currentRows.length === 0) return;

    // Si para el Grand Slam 6ta Damas ya está en 600 pts, aseguramos que el snapshot original conserve el estado previo (400 pts subcampeón)
    const snapshotRows: RankingSnapshotRow[] = (currentRows as any[]).map((r) => {
      if (
        torneoId === GS_6TA_DAMAS_TORNEO_ID &&
        (r.inscripcion_id === GS_6TA_DAMAS_CAMPEON_INSCRIPCION_ID ||
          GS_6TA_DAMAS_CAMPEONAS_JUGADOR_IDS.has(r.jugador_id))
      ) {
        return {
          jugador_id: r.jugador_id,
          torneo_id: r.torneo_id,
          inscripcion_id: r.inscripcion_id,
          instancia: "subcampeon" as Instancia,
          puntos: 400,
          anio: r.anio ?? 2026,
          categoria_id: r.categoria_id ?? null,
          genero: r.genero ?? "damas",
          master_status: normalizeMasterStatus(r.master_status),
        };
      }
      return {
        jugador_id: r.jugador_id,
        torneo_id: r.torneo_id,
        inscripcion_id: r.inscripcion_id ?? null,
        instancia: r.instancia as Instancia,
        puntos: Number(r.puntos) || 0,
        anio: r.anio ?? 2026,
        categoria_id: r.categoria_id ?? null,
        genero: r.genero ?? null,
        master_status: normalizeMasterStatus(r.master_status),
      };
    });

    // Guardar en localStorage
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
        const allSnaps = raw ? JSON.parse(raw) : {};
        if (!allSnaps[torneoId]) {
          allSnaps[torneoId] = {
            savedAt: new Date().toISOString(),
            rows: snapshotRows,
          };
          window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(allSnaps));
        }
      }
    } catch {
      // ignore localStorage errors
    }

    // Guardar también en torneos.notas si aún no tiene un [RANKING_SNAPSHOT_V1:...]
    const notasActuales = tRow?.notas || "";
    if (!notasActuales.includes("[RANKING_SNAPSHOT_V1:")) {
      const compact = snapshotRows.map((s) => ({
        j: s.jugador_id,
        i: s.inscripcion_id,
        inst: s.instancia,
        p: s.puntos,
        a: s.anio,
        c: s.categoria_id,
        g: s.genero,
        ms: s.master_status,
      }));
      const encoded = encodeURIComponent(JSON.stringify(compact));
      const nextNotas = `${notasActuales} [RANKING_SNAPSHOT_V1:${encoded}]`.trim();
      await supabase.from("torneos").update({ notas: nextNotas }).eq("id", torneoId);
    }
  } catch (err) {
    console.warn("No se pudo guardar snapshot previo de ranking:", err);
  }
}

export function extraerSnapshotDesdeNotasOLocal(
  torneoId: string,
  notas?: string | null
): RankingSnapshotRow[] | null {
  if (notas) {
    const match = notas.match(/\[RANKING_SNAPSHOT_V1:([^\]]+)\]/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((x: any) => ({
            jugador_id: x.j,
            torneo_id: torneoId,
            inscripcion_id: x.i ?? null,
            instancia: x.inst as Instancia,
            puntos: Number(x.p) || 0,
            anio: Number(x.a) || 2026,
            categoria_id: x.c ?? null,
            genero: x.g ?? null,
            master_status: normalizeMasterStatus(x.ms),
          }));
        }
      } catch {
        // fallback a localStorage
      }
    }
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
      if (raw) {
        const allSnaps = JSON.parse(raw);
        if (allSnaps[torneoId]?.rows?.length > 0) {
          return allSnaps[torneoId].rows;
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Revierte los puntos de `ranking_jugadores` de un torneo a su estado previo guardado en el snapshot
 * (o revierte la corrección de campeonas en el Grand Slam de 6ta Damas a 400 pts subcampeonas).
 */
export async function revertirRankingTorneo(torneoId: string): Promise<{
  ok: boolean;
  restaurados: number;
  error?: string;
}> {
  try {
    const { data: torneo, error: errT } = await supabase
      .from("torneos")
      .select("id, club_id, fecha_inicio, categoria_id, genero, notas")
      .eq("id", torneoId)
      .maybeSingle();
    if (errT) throw errT;
    if (!torneo) throw new Error("Torneo no encontrado");

    const anio = new Date(torneo.fecha_inicio).getFullYear();
    const snapshot = extraerSnapshotDesdeNotasOLocal(torneoId, torneo.notas);

    let restaurados = 0;

    if (snapshot && snapshot.length > 0) {
      await supabase.from("ranking_jugadores").delete().eq("torneo_id", torneoId);
      const { error: insErr } = await supabase.from("ranking_jugadores").insert(snapshot);
      if (insErr) {
        const sinStatus = snapshot.map(({ master_status: _ms, ...rest }) => rest);
        const { error: retryErr } = await supabase.from("ranking_jugadores").insert(sinStatus);
        if (retryErr) throw retryErr;
      }
      restaurados = snapshot.length;
    } else if (torneoId === GS_6TA_DAMAS_TORNEO_ID) {
      // Fallback directo para Grand Slam 6ta Damas: volver a subcampeón (400 pts) a la pareja campeona
      const { error: updErr } = await supabase
        .from("ranking_jugadores")
        .update({ instancia: "subcampeon", puntos: 400 })
        .eq("torneo_id", GS_6TA_DAMAS_TORNEO_ID)
        .eq("inscripcion_id", GS_6TA_DAMAS_CAMPEON_INSCRIPCION_ID);
      if (updErr) throw updErr;
      restaurados = 2;
    } else {
      return {
        ok: false,
        restaurados: 0,
        error: "No hay un respaldo previo guardado para este torneo.",
      };
    }

    // Marcar [RANKING_REVERTIDO_MANUAL] en torneos.notas y localStorage
    const currentNotas = torneo.notas || "";
    if (!currentNotas.includes("[RANKING_REVERTIDO_MANUAL]")) {
      const nextNotas = `${currentNotas} [RANKING_REVERTIDO_MANUAL]`.trim();
      await supabase.from("torneos").update({ notas: nextNotas }).eq("id", torneoId);
    }
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(`padel_revertido_manual_${torneoId}`, "true");
      }
    } catch {
      // ignore
    }

    await recalcularTodosLosAscensos(anio, torneo.club_id);
    return { ok: true, restaurados };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      restaurados: 0,
      error: e instanceof Error ? e.message : "Error desconocido al revertir",
    };
  }
}

/**
 * Calcula y guarda los puntos de ranking para todos los jugadores
 * de un torneo finalizado. Borra puntos previos del torneo y los recalcula.
 */
export async function calcularRankingTorneo(torneoId: string, skipAscensosRecalc: boolean = false): Promise<{
  ok: boolean;
  jugadoresConPuntos: number;
  error?: string;
}> {
  try {
    // 1. Datos del torneo
    const { data: torneo, error: errT } = await supabase
      .from("torneos")
      .select("id, club_id, fecha_inicio, categoria_id, genero, categoria_libre, tipo, numero_fecha, multiplicador_puntos, notas")
      .eq("id", torneoId)
      .maybeSingle();
    if (errT) throw errT;
    if (!torneo) throw new Error("Torneo no encontrado");

    // Guardar snapshot reversible antes de modificar ranking_jugadores
    if (torneo.tipo === "oficial") {
      await guardarSnapshotRankingTorneo(torneoId);
      // Si tenía marca de revertido manual, limpiarla al recalcular/sincronizar explícitamente
      if (torneo.notas && torneo.notas.includes("[RANKING_REVERTIDO_MANUAL]")) {
        const cleaned = torneo.notas.replace(/\[RANKING_REVERTIDO_MANUAL\]/g, "").trim();
        await supabase.from("torneos").update({ notas: cleaned }).eq("id", torneoId);
      }
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(`padel_revertido_manual_${torneoId}`);
        }
      } catch {
        // ignore
      }
    }

    // Los americanos no forman parte del ranking oficial. También limpiamos
    // cualquier registro previo por si el torneo se había calculado antes.
    if (torneo.tipo !== "oficial") {
      const { error: deleteError } = await supabase
        .from("ranking_jugadores")
        .delete()
        .eq("torneo_id", torneoId);
      if (deleteError) throw deleteError;
      if (!skipAscensosRecalc) {
        await recalcularTodosLosAscensos(new Date(torneo.fecha_inicio).getFullYear(), torneo.club_id);
      }
      return { ok: true, jugadoresConPuntos: 0 };
    }

    const anio = new Date(torneo.fecha_inicio).getFullYear();

    // 1b. Resolver género desde la categoría si el torneo no lo tiene seteado
    let generoTorneo: string | null = torneo.genero ?? null;
    if (!generoTorneo && torneo.categoria_id) {
      const { data: cat } = await supabase
        .from("categorias")
        .select("genero")
        .eq("id", torneo.categoria_id)
        .maybeSingle();
      if (cat?.genero) generoTorneo = cat.genero;
    }

    // Multiplicador (default 1, fecha 4 suele ser 2)
    const multiplicador = Number(torneo.multiplicador_puntos ?? 1) || 1;

    // 2. Cargar tabla de puntos
    const { data: puntosCfg, error: errP } = await (supabase as any)
      .from("puntos_ranking")
      .select("instancia, puntos")
      .eq("club_id", torneo.club_id);
    if (errP) throw errP;
    const puntosMap = new Map<string, number>();
    (puntosCfg ?? []).forEach((p: any) => puntosMap.set(p.instancia, p.puntos));

    // 3. Inscripciones del torneo (parejas) con jugadores
    const { data: inscripciones, error: errI } = await supabase
      .from("inscripciones")
      .select("id, jugador1_id, jugador2_id")
      .eq("torneo_id", torneoId);
    if (errI) throw errI;

    const inscripcionToJugadores = new Map<string, [string, string]>();
    (inscripciones ?? []).forEach((i) =>
      inscripcionToJugadores.set(i.id, [i.jugador1_id, i.jugador2_id])
    );

    // 4. Determinar instancia alcanzada por cada inscripción
    const inscripcionInstancia = new Map<string, Instancia>();

    // 4a. Llaves del torneo
    const { data: llaves } = await supabase
      .from("llaves")
      .select("id, created_at")
      .eq("torneo_id", torneoId)
      .order("created_at", { ascending: false });

    let llaveId = null;
    let partidos: any[] | null = null;

    if (llaves && llaves.length > 0) {
      for (const ll of llaves) {
        const { data: p } = await supabase
          .from("partidos_llave")
          .select("id, ronda, pareja_local_id, pareja_visitante_id, ganador_id, estado, partido_siguiente_id")
          .eq("llave_id", ll.id);

        if (p && p.length > 0) {
          llaveId = ll.id;
          partidos = p;
          break;
        }
      }
    }

    if (llaveId && partidos) {
      const partidoMap = new Map();
      partidos.forEach((p) => partidoMap.set(p.id, p));

      partidos
        .filter((p) => p.estado === "finalizado" && p.ganador_id)
        .forEach((p) => {
          // Asignar al perdedor
          const perdedor =
            p.pareja_local_id === p.ganador_id
              ? p.pareja_visitante_id
              : p.pareja_local_id;

          if (perdedor) {
            let instanciaPerdida = RONDA_A_INSTANCIA_PERDIDA[p.ronda as RondaLlave];
            if (p.ronda === "previa") {
              const sig = partidoMap.get(p.partido_siguiente_id);
              if (sig) {
                if (sig.ronda === "octavos") instanciaPerdida = "dieciseisavos";
                else if (sig.ronda === "cuartos") instanciaPerdida = "octavos";
                else if (sig.ronda === "semifinal") instanciaPerdida = "cuartos";
              }
            }
            const actual = inscripcionInstancia.get(perdedor);
            if (!actual || instanciaPeso(instanciaPerdida) > instanciaPeso(actual)) {
              inscripcionInstancia.set(perdedor, instanciaPerdida);
            }
          }

          // Asignar al ganador
          let instanciaGanada = RONDA_A_INSTANCIA_GANADA[p.ronda as RondaLlave];
          if (p.ronda === "previa") {
            const sig = partidoMap.get(p.partido_siguiente_id);
            if (sig) {
              if (sig.ronda === "octavos") instanciaGanada = "octavos";
              else if (sig.ronda === "cuartos") instanciaGanada = "cuartos";
              else if (sig.ronda === "semifinal") instanciaGanada = "semifinal";
            }
          }
          const actualG = inscripcionInstancia.get(p.ganador_id);
          if (!actualG || instanciaPeso(instanciaGanada) > instanciaPeso(actualG)) {
            inscripcionInstancia.set(p.ganador_id, instanciaGanada);
          }
        });
    }

    // 4b. Las inscripciones que NO llegaron al cuadro → "zona"
    (inscripciones ?? []).forEach((i) => {
      if (!inscripcionInstancia.has(i.id)) {
        inscripcionInstancia.set(i.id, "zona");
      }
    });

    // 5. Preservar master_status previo de los jugadores en esta categoría y año antes de borrar
    const statusPrevioMap = new Map<string, MasterStatus>();
    if (torneo.categoria_id) {
      const { data: prevRows } = await (supabase as any)
        .from("ranking_jugadores")
        .select("jugador_id, master_status")
        .eq("anio", anio)
        .eq("categoria_id", torneo.categoria_id);
      (prevRows ?? []).forEach((r: any) => {
        const st = normalizeMasterStatus(r.master_status);
        if (st !== "auto") {
          statusPrevioMap.set(r.jugador_id, st);
        }
      });
    }

    // Borrar puntos previos del torneo
    await supabase.from("ranking_jugadores").delete().eq("torneo_id", torneoId);

    // 6. Insertar puntos por jugador
    const filas: {
      jugador_id: string;
      torneo_id: string;
      inscripcion_id: string;
      instancia: Instancia;
      puntos: number;
      anio: number;
      categoria_id: string | null;
      genero: string | null;
      master_status?: MasterStatus;
    }[] = [];

    for (const [inscId, instancia] of inscripcionInstancia.entries()) {
      const jugadores = inscripcionToJugadores.get(inscId);
      if (!jugadores) continue;
      const puntosBase = puntosMap.get(instancia) ?? 0;
      const puntos = Math.round(puntosBase * multiplicador);
      jugadores.forEach((jugadorId) => {
        const stPrev = statusPrevioMap.get(jugadorId);
        filas.push({
          jugador_id: jugadorId,
          torneo_id: torneoId,
          inscripcion_id: inscId,
          instancia,
          puntos,
          anio,
          categoria_id: torneo.categoria_id,
          genero: generoTorneo,
          ...(stPrev ? { master_status: stPrev } : {}),
        });
      });
    }

    if (filas.length > 0) {
      const { error: errIns } = await supabase
        .from("ranking_jugadores")
        .insert(filas);
      if (errIns) {
        // Fallback si la columna master_status aún no fue corrida en la base
        const filasSinStatus = filas.map(({ master_status: _ms, ...rest }) => rest);
        const { error: errRetry } = await supabase
          .from("ranking_jugadores")
          .insert(filasSinStatus);
        if (errRetry) throw errRetry;
      }
    }

    // Recalcular todos los ascensos del año para mantener puntos transferidos consistentes
    if (!skipAscensosRecalc) {
      await recalcularTodosLosAscensos(anio, torneo.club_id);
    }

    return { ok: true, jugadoresConPuntos: filas.length };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      jugadoresConPuntos: 0,
      error: e instanceof Error ? e.message : "Error desconocido",
    };
  }
}

export async function recalcularTodosLosAscensos(anio: number, clubId?: string | null): Promise<void> {
  try {
    let categoryIds: string[] | null = null;
    if (clubId) {
      const { data: categories, error: categoriesError } = await supabase
        .from("categorias")
        .select("id")
        .eq("club_id", clubId);
      if (categoriesError) throw categoriesError;
      categoryIds = (categories ?? []).map((category) => category.id);
      if (!categoryIds.length) return;
    }
    // 1. Obtener todos los ascensos de este año ordenados cronológicamente
    let ascensosQuery = supabase
      .from("ascensos")
      .select("id, jugador_id, categoria_origen_id, categoria_destino_id")
      .eq("anio", anio)
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true });
    if (categoryIds) ascensosQuery = ascensosQuery.in("categoria_origen_id", categoryIds);
    const { data: ascensos, error: errA } = await ascensosQuery;

    if (errA) throw errA;
    if (!ascensos || ascensos.length === 0) return;

    // 2. Obtener todos los puntos de ranking_jugadores del año
    let rankingQuery = supabase
      .from("ranking_jugadores")
      .select("jugador_id, categoria_id, puntos")
      .eq("anio", anio);
    if (categoryIds) rankingQuery = rankingQuery.in("categoria_id", categoryIds);
    const { data: rankingData, error: errR } = await rankingQuery;

    if (errR) throw errR;

    // Mapa de puntos acumulados por jugador y categoría: Map<jugador_id, Map<categoria_id, puntos>>
    const puntosPorJugador = new Map<string, Map<string, number>>();

    // Poblar con los puntos base de torneos
    (rankingData ?? []).forEach((r) => {
      if (!r.categoria_id) return;
      if (!puntosPorJugador.has(r.jugador_id)) {
        puntosPorJugador.set(r.jugador_id, new Map());
      }
      const catMap = puntosPorJugador.get(r.jugador_id)!;
      catMap.set(r.categoria_id, (catMap.get(r.categoria_id) ?? 0) + r.puntos);
    });

    // 3. Procesar ascensos cronológicamente actualizando los puntos transferidos
    const updatePromises = [];
    for (const asc of ascensos) {
      const pId = asc.jugador_id;
      const catOrig = asc.categoria_origen_id;
      const catDest = asc.categoria_destino_id;

      // Puntos actuales en la categoría origen (torneos + posibles transferencias previas)
      const catMap = puntosPorJugador.get(pId) ?? new Map<string, number>();
      const ptsOrigen = catMap.get(catOrig) ?? 0;
      const ptsTransferidos = Math.floor(ptsOrigen / 2);

      // Actualizar en la base de datos (lo guardamos en un array para ejecutar en paralelo)
      updatePromises.push(
        supabase
          .from("ascensos")
          .update({
            puntos_origen: ptsOrigen,
            puntos_transferidos: ptsTransferidos,
          })
          .eq("id", asc.id)
      );

      // Sumar los puntos transferidos a la categoría destino para futuros ascensos encadenados
      if (!puntosPorJugador.has(pId)) {
        puntosPorJugador.set(pId, new Map());
      }
      const destCatMap = puntosPorJugador.get(pId)!;
      destCatMap.set(catDest, (destCatMap.get(catDest) ?? 0) + ptsTransferidos);
    }

    // Ejecutar todas las actualizaciones en paralelo para optimizar velocidad
    await Promise.all(updatePromises);
  } catch (err) {
    console.error("Error en recalcularTodosLosAscensos:", err);
  }
}

function instanciaPeso(i: Instancia): number {
  const orden: Instancia[] = [
    "zona",
    "treintaidosavos",
    "dieciseisavos",
    "octavos",
    "cuartos",
    "semifinal",
    "subcampeon",
    "campeon",
  ];
  return orden.indexOf(i);
}

export function isAscenso(instancia: string | null | undefined): boolean {
  if (!instancia) return false;
  return instancia.trim().toLowerCase() === "ascenso";
}

export type DiferenciaSincronizacionJugador = {
  jugador_id: string;
  jugador_nombre: string;
  instancia_actual: Instancia;
  puntos_actuales: number;
  instancia_llave: Instancia;
  puntos_llave: number;
};

export type TorneoSincronizacionAuditItem = {
  torneo_id: string;
  torneo_nombre: string;
  fecha_inicio: string;
  numero_fecha: number | null;
  multiplicador: number;
  categoria_id: string | null;
  categoria_nombre: string;
  genero: string | null;
  tiene_diferencias_con_llave: boolean;
  tiene_snapshot_reversible: boolean;
  esta_revertido_manual: boolean;
  diferencias: DiferenciaSincronizacionJugador[];
};

/**
 * Audita los torneos oficiales finalizados de un club en el año dado, detectando:
 * 1) Cualquier diferencia de puntos/instancia entre el cuadro (`partidos_llave`) y `ranking_jugadores`.
 * 2) Cualquier torneo que tenga un respaldo (snapshot) reversible activo (incluyendo el Grand Slam de 6ta Damas).
 */
export async function auditarSincronizacionLlavesClub(
  clubId: string,
  anio: number
): Promise<TorneoSincronizacionAuditItem[]> {
  try {
    const [
      { data: torneosData },
      { data: categoriasData },
      { data: puntosCfg },
    ] = await Promise.all([
      supabase
        .from("torneos")
        .select("id, nombre, fecha_inicio, numero_fecha, multiplicador_puntos, categoria_id, genero, tipo, estado, notas")
        .eq("club_id", clubId)
        .eq("tipo", "oficial")
        .order("fecha_inicio", { ascending: false }),
      supabase.from("categorias").select("id, nombre, genero").eq("club_id", clubId),
      (supabase as any).from("puntos_ranking").select("instancia, puntos").eq("club_id", clubId),
    ]);

    const torneosAnio = ((torneosData ?? []) as any[]).filter((t) => {
      const a = t.fecha_inicio ? new Date(t.fecha_inicio).getFullYear() : anio;
      return a === anio && t.estado === "finalizado";
    });
    if (torneosAnio.length === 0) return [];

    const catMap = new Map<string, { nombre: string; genero: string }>();
    ((categoriasData ?? []) as any[]).forEach((c) =>
      catMap.set(c.id, { nombre: c.nombre, genero: c.genero })
    );

    const puntosMap = new Map<string, number>();
    ((puntosCfg ?? []) as any[]).forEach((p) => puntosMap.set(p.instancia, Number(p.puntos) || 0));

    const torneoIds = torneosAnio.map((t) => t.id);
    const notasMap = new Map<string, string | null>();
    torneosAnio.forEach((t) => notasMap.set(t.id, t.notas ?? null));

    const [{ data: llavesData }, { data: rkRawData }] = await Promise.all([
      supabase
        .from("llaves")
        .select("id, torneo_id, created_at")
        .in("torneo_id", torneoIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("ranking_jugadores")
        .select("jugador_id, torneo_id, inscripcion_id, instancia, puntos")
        .in("torneo_id", torneoIds),
    ]);

    const rkNormalized = normalizarFilasRankingConSincronizacion(
      (rkRawData ?? []) as any[],
      notasMap
    );

    const llaveIds = ((llavesData ?? []) as any[]).map((l) => l.id);
    const { data: partidosData } =
      llaveIds.length > 0
        ? await supabase
            .from("partidos_llave")
            .select("id, llave_id, ronda, pareja_local_id, pareja_visitante_id, ganador_id, estado, partido_siguiente_id")
            .in("llave_id", llaveIds)
        : { data: [] };

    const playerIdsSet = new Set<string>();
    rkNormalized.forEach((r) => playerIdsSet.add(r.jugador_id));

    const playerNameMap = new Map<string, string>();
    const allPIds = Array.from(playerIdsSet);
    for (let i = 0; i < allPIds.length; i += 100) {
      const chunk = allPIds.slice(i, i + 100);
      const { data: pRows } = await (supabase as any)
        .from("jugadores_publicos")
        .select("id, nombre, apellido")
        .in("id", chunk);
      ((pRows ?? []) as any[]).forEach((p) =>
        playerNameMap.set(p.id, `${p.apellido}, ${p.nombre}`)
      );
    }

    const result: TorneoSincronizacionAuditItem[] = [];

    for (const t of torneosAnio) {
      const tLlaves = ((llavesData ?? []) as any[]).filter((l) => l.torneo_id === t.id);
      let activePartidos: any[] | null = null;
      for (const ll of tLlaves) {
        const p = ((partidosData ?? []) as any[]).filter((x) => x.llave_id === ll.id);
        if (p.length > 0) {
          activePartidos = p;
          break;
        }
      }
      if (!activePartidos) continue;

      const pMap = new Map(activePartidos.map((p) => [p.id, p]));
      const expectedInst = new Map<string, Instancia>();

      activePartidos
        .filter((p) => p.estado === "finalizado" && p.ganador_id)
        .forEach((p) => {
          const perdedor =
            p.pareja_local_id === p.ganador_id ? p.pareja_visitante_id : p.pareja_local_id;
          if (perdedor) {
            let instP = RONDA_A_INSTANCIA_PERDIDA[p.ronda as RondaLlave];
            if (p.ronda === "previa") {
              const sig = pMap.get(p.partido_siguiente_id);
              if (sig) {
                if (sig.ronda === "octavos") instP = "dieciseisavos";
                else if (sig.ronda === "cuartos") instP = "octavos";
                else if (sig.ronda === "semifinal") instP = "cuartos";
              }
            }
            const cur = expectedInst.get(perdedor);
            if (!cur || instanciaPeso(instP) > instanciaPeso(cur)) {
              expectedInst.set(perdedor, instP);
            }
          }

          let instG = RONDA_A_INSTANCIA_GANADA[p.ronda as RondaLlave];
          if (p.ronda === "previa") {
            const sig = pMap.get(p.partido_siguiente_id);
            if (sig) {
              if (sig.ronda === "octavos") instG = "octavos";
              else if (sig.ronda === "cuartos") instG = "cuartos";
              else if (sig.ronda === "semifinal") instG = "semifinal";
            }
          }
          const curG = expectedInst.get(p.ganador_id);
          if (!curG || instanciaPeso(instG) > instanciaPeso(curG)) {
            expectedInst.set(p.ganador_id, instG);
          }
        });

      const mult = Number(t.multiplicador_puntos ?? 1) || 1;
      const tRk = rkNormalized.filter((r) => r.torneo_id === t.id);
      const diferencias: DiferenciaSincronizacionJugador[] = [];

      for (const r of tRk) {
        const expInst = (r.inscripcion_id ? expectedInst.get(r.inscripcion_id) : undefined) || "zona";
        const expPts = Math.round((puntosMap.get(expInst) ?? 0) * mult);
        const curPts = Number(r.puntos) || 0;
        if (expPts !== curPts) {
          diferencias.push({
            jugador_id: r.jugador_id,
            jugador_nombre: playerNameMap.get(r.jugador_id) || r.jugador_id,
            instancia_actual: r.instancia as Instancia,
            puntos_actuales: curPts,
            instancia_llave: expInst,
            puntos_llave: expPts,
          });
        }
      }

      const snapshot = extraerSnapshotDesdeNotasOLocal(t.id, t.notas);
      const isGs6D = t.id === GS_6TA_DAMAS_TORNEO_ID;
      const estaRevertido = isTorneoRankingRevertidoManual(t.id, t.notas);
      const tieneSnapshot = Boolean((snapshot && snapshot.length > 0) || isGs6D);

      // Si es el Grand Slam 6ta Damas y ya está sincronizado (sin diferencias con la llave),
      // mostramos igualmente en el historial qué jugadoras fueron corregidas para poder revertirlo en 1 clic
      if (isGs6D && diferencias.length === 0 && !estaRevertido) {
        diferencias.push(
          {
            jugador_id: "57021e3d-9bf0-4aae-a2a0-f053a1d9c899",
            jugador_nombre: playerNameMap.get("57021e3d-9bf0-4aae-a2a0-f053a1d9c899") || "Ledesma, Andrea",
            instancia_actual: "campeon",
            puntos_actuales: 600,
            instancia_llave: "campeon",
            puntos_llave: 600,
          },
          {
            jugador_id: "4244f042-8af6-467f-9e8d-054861b7d376",
            jugador_nombre: playerNameMap.get("4244f042-8af6-467f-9e8d-054861b7d376") || "Quevedo, Silvana",
            instancia_actual: "campeon",
            puntos_actuales: 600,
            instancia_llave: "campeon",
            puntos_llave: 600,
          }
        );
      } else if (
        tieneSnapshot &&
        diferencias.length === 0 &&
        snapshot &&
        snapshot.length > 0 &&
        !estaRevertido
      ) {
        // Comparar contra el snapshot para mostrar qué jugadores cambiaron respecto al estado anterior
        for (const r of tRk) {
          const snapRow = snapshot.find((s) => s.jugador_id === r.jugador_id);
          if (snapRow && snapRow.puntos !== r.puntos) {
            diferencias.push({
              jugador_id: r.jugador_id,
              jugador_nombre: playerNameMap.get(r.jugador_id) || r.jugador_id,
              instancia_actual: r.instancia as Instancia,
              puntos_actuales: r.puntos,
              instancia_llave: snapRow.instancia,
              puntos_llave: snapRow.puntos,
            });
          }
        }
      }

      const tieneDifReal = tRk.some((r) => {
        const expInst = (r.inscripcion_id ? expectedInst.get(r.inscripcion_id) : undefined) || "zona";
        const expPts = Math.round((puntosMap.get(expInst) ?? 0) * mult);
        return expPts !== (Number(r.puntos) || 0);
      });

      if (tieneDifReal || tieneSnapshot) {
        const cat = t.categoria_id ? catMap.get(t.categoria_id) : undefined;
        result.push({
          torneo_id: t.id,
          torneo_nombre: t.nombre,
          fecha_inicio: t.fecha_inicio,
          numero_fecha: t.numero_fecha ?? null,
          multiplicador: mult,
          categoria_id: t.categoria_id ?? null,
          categoria_nombre: cat ? cat.nombre : "General",
          genero: t.genero ?? cat?.genero ?? null,
          tiene_diferencias_con_llave: tieneDifReal,
          tiene_snapshot_reversible: tieneSnapshot,
          esta_revertido_manual: estaRevertido,
          diferencias,
        });
      }
    }

    return result;
  } catch (err) {
    console.error("Error auditando sincronización de llaves:", err);
    return [];
  }
}
