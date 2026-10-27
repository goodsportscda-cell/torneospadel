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

export function isCategoriaSuma(nombreCategoria: string | null | undefined): boolean {
  if (!nombreCategoria) return false;
  const n = nombreCategoria.toLowerCase().trim();
  return n.includes("suma 8") || n.includes("suma 7") || n.startsWith("suma");
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

    const torneos_en_categoria = directSet.size;
    const torneos_categoria_anterior = prevTorneosSet.size;
    return {
      master_status: status,
      es_ascendido: esAscendido,
      torneos_en_categoria,
      torneos_categoria_anterior,
      torneos_jugados: torneos_en_categoria + torneos_categoria_anterior,
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
      .select("id, club_id, fecha_inicio, categoria_id, genero, categoria_libre, tipo, numero_fecha, multiplicador_puntos")
      .eq("id", torneoId)
      .maybeSingle();
    if (errT) throw errT;
    if (!torneo) throw new Error("Torneo no encontrado");

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
