import { getNivelCategoriaPura, isCategoriaSuma, TORNEOS_REQUERIDOS_MASTER } from "@/lib/ranking";

export type MasterQualifierEstado = "confirmado" | "pendiente" | "baja";
export type MasterRonda = "cuartos" | "semifinal" | "final";
export type MasterMatchEstado = "pendiente" | "programado" | "en_curso" | "finalizado";

export type MasterCategorySpec = {
  key: string;
  label: string;
  genero: "caballeros" | "damas";
  isSuma: boolean;
  cupos: number;
  diaCuartosSemis: MasterDiaKey;
  orden: number;
};

export type MasterDiaKey = "2026-12-03" | "2026-12-04" | "2026-12-05" | "2026-12-06";

export const MASTER_CANCHAS = [1, 2, 3, 4, 5, 6] as const;

export const MASTER_DIAS: {
  key: MasterDiaKey;
  label: string;
  shortLabel: string;
  detalle: string;
  horaInicioDefault: string;
}[] = [
  {
    key: "2026-12-03",
    label: "Jueves 3 de Diciembre",
    shortLabel: "Jueves 3/12",
    detalle: "Desde 18:00 hs · 7ma Damas y 5ta Caballeros (4tos y Semis)",
    horaInicioDefault: "18:00",
  },
  {
    key: "2026-12-04",
    label: "Viernes 4 de Diciembre",
    shortLabel: "Viernes 4/12",
    detalle: "Desde 18:00 hs · 8va Damas, 8va Caballeros y 6ta Caballeros (4tos y Semis)",
    horaInicioDefault: "18:00",
  },
  {
    key: "2026-12-05",
    label: "Sábado 5 de Diciembre",
    shortLabel: "Sábado 5/12",
    detalle: "Desde 18:00 hs · 6ta Damas, 7ma Caballeros y Suma 7 Caballeros (4tos y Semis)",
    horaInicioDefault: "18:00",
  },
  {
    key: "2026-12-06",
    label: "Domingo 6 de Diciembre",
    shortLabel: "Domingo 6/12",
    detalle: "Todas las Finales (8 finales)",
    horaInicioDefault: "16:00",
  },
];

export const MASTER_2026_CATEGORIES: MasterCategorySpec[] = [
  {
    key: "caballeros_5ta",
    label: "5ta Caballeros",
    genero: "caballeros",
    isSuma: false,
    cupos: 16,
    diaCuartosSemis: "2026-12-03",
    orden: 1,
  },
  {
    key: "caballeros_6ta",
    label: "6ta Caballeros",
    genero: "caballeros",
    isSuma: false,
    cupos: 16,
    diaCuartosSemis: "2026-12-04",
    orden: 2,
  },
  {
    key: "caballeros_7ma",
    label: "7ma Caballeros",
    genero: "caballeros",
    isSuma: false,
    cupos: 16,
    diaCuartosSemis: "2026-12-05",
    orden: 3,
  },
  {
    key: "caballeros_8va",
    label: "8va Caballeros",
    genero: "caballeros",
    isSuma: false,
    cupos: 16,
    diaCuartosSemis: "2026-12-04",
    orden: 4,
  },
  {
    key: "damas_6ta",
    label: "6ta Damas",
    genero: "damas",
    isSuma: false,
    cupos: 16,
    diaCuartosSemis: "2026-12-05",
    orden: 5,
  },
  {
    key: "damas_7ma",
    label: "7ma Damas",
    genero: "damas",
    isSuma: false,
    cupos: 16,
    diaCuartosSemis: "2026-12-03",
    orden: 6,
  },
  {
    key: "damas_8va",
    label: "8va Damas",
    genero: "damas",
    isSuma: false,
    cupos: 16,
    diaCuartosSemis: "2026-12-04",
    orden: 7,
  },
  {
    key: "caballeros_suma7",
    label: "Suma 7 Caballeros",
    genero: "caballeros",
    isSuma: true,
    cupos: 8,
    diaCuartosSemis: "2026-12-05",
    orden: 8,
  },
];

export const MASTER_RONDA_LABELS: Record<MasterRonda, string> = {
  cuartos: "Cuartos de Final",
  semifinal: "Semifinal",
  final: "Final",
};

/**
 * Empareja una categoría de la base de datos (`public.categorias`) con una de las
 * 8 categorías oficiales del Master 2026.
 */
export function matchMasterCategorySpec(cat: {
  nombre: string;
  genero: string;
}): MasterCategorySpec | null {
  const nombre = (cat.nombre || "").toLowerCase().trim();
  const genero = (cat.genero || "").toLowerCase().trim();

  if (isCategoriaSuma(nombre) && nombre.includes("7")) {
    if (genero === "caballeros" || genero === "mixto") {
      return MASTER_2026_CATEGORIES.find((c) => c.key === "caballeros_suma7") ?? null;
    }
    return null;
  }

  const nivel = getNivelCategoriaPura(nombre);
  if (nivel === null) return null;

  if (genero === "caballeros") {
    if (nivel === 5) return MASTER_2026_CATEGORIES.find((c) => c.key === "caballeros_5ta") ?? null;
    if (nivel === 6) return MASTER_2026_CATEGORIES.find((c) => c.key === "caballeros_6ta") ?? null;
    if (nivel === 7) return MASTER_2026_CATEGORIES.find((c) => c.key === "caballeros_7ma") ?? null;
    if (nivel === 8) return MASTER_2026_CATEGORIES.find((c) => c.key === "caballeros_8va") ?? null;
  }

  if (genero === "damas") {
    if (nivel === 6) return MASTER_2026_CATEGORIES.find((c) => c.key === "damas_6ta") ?? null;
    if (nivel === 7) return MASTER_2026_CATEGORIES.find((c) => c.key === "damas_7ma") ?? null;
    if (nivel === 8) return MASTER_2026_CATEGORIES.find((c) => c.key === "damas_8va") ?? null;
  }

  return null;
}

export type MasterQualifierInput = {
  jugador_id: string;
  ranking_posicion_original: number;
  puntos_anuales: number;
  torneos_jugados: number;
  torneos_categoria_anterior: number;
  ascenso_validado: boolean;
  estado: MasterQualifierEstado;
  orden_manual: number | null;
};

export type MasterQualifierComputed<T extends MasterQualifierInput = MasterQualifierInput> = T & {
  torneos_computados: number;
  elegible: boolean;
  posicion_final: number | null;
  es_suplente: boolean;
  orden_suplente: number | null;
};

/**
 * Calcula elegibilidad y reacomodamiento correlativo ante bajas.
 * - Un jugador es elegible si `torneos_computados >= 4`, donde `torneos_computados`
 *   incluye `torneos_categoria_anterior` si `ascenso_validado` es true (o si ya
 *   supera 4 en la categoría actual).
 * - Los jugadores en estado `'baja'` quedan fuera del cuadro y NO ocupan posición.
 * - Todos los demás elegibles suben correlativamente (1..cupos son Titulares;
 *   cupos+1..N son Suplentes #1, #2, ...).
 * - Si hay `orden_manual`, se respeta para ordenar antes de asignar posiciones finales.
 */
export function computeMasterQualifiersOrder<T extends MasterQualifierInput>(
  rows: T[],
  cupos: number
): MasterQualifierComputed<T>[] {
  const enriched = rows.map((r) => {
    const torneos_computados = r.ascenso_validado
      ? r.torneos_jugados + r.torneos_categoria_anterior
      : r.torneos_jugados;
    const elegible =
      torneos_computados >= TORNEOS_REQUERIDOS_MASTER || r.ascenso_validado;
    return {
      ...r,
      torneos_computados,
      elegible,
    };
  });

  const activos = enriched
    .filter((r) => r.elegible && r.estado !== "baja")
    .sort((a, b) => {
      const aMan = a.orden_manual ?? Number.MAX_SAFE_INTEGER;
      const bMan = b.orden_manual ?? Number.MAX_SAFE_INTEGER;
      if (aMan !== bMan) return aMan - bMan;
      if (b.puntos_anuales !== a.puntos_anuales) return b.puntos_anuales - a.puntos_anuales;
      return a.ranking_posicion_original - b.ranking_posicion_original;
    });

  const posMap = new Map<string, { posicion_final: number; es_suplente: boolean; orden_suplente: number | null }>();
  activos.forEach((r, idx) => {
    const pos = idx + 1;
    const esSuplente = pos > cupos;
    posMap.set(r.jugador_id, {
      posicion_final: pos,
      es_suplente: esSuplente,
      orden_suplente: esSuplente ? pos - cupos : null,
    });
  });

  return enriched
    .map((r) => {
      if (!r.elegible || r.estado === "baja") {
        return {
          ...r,
          posicion_final: null,
          es_suplente: false,
          orden_suplente: null,
        };
      }
      const p = posMap.get(r.jugador_id)!;
      return {
        ...r,
        posicion_final: p.posicion_final,
        es_suplente: p.es_suplente,
        orden_suplente: p.orden_suplente,
      };
    })
    .sort((a, b) => {
      if (a.posicion_final !== null && b.posicion_final !== null) {
        return a.posicion_final - b.posicion_final;
      }
      if (a.posicion_final !== null) return -1;
      if (b.posicion_final !== null) return 1;
      if (a.estado === "baja" && b.estado !== "baja") return 1;
      if (b.estado === "baja" && a.estado !== "baja") return -1;
      return a.ranking_posicion_original - b.ranking_posicion_original;
    });
}

export type ParejaFormadaDraft = {
  cruce_label: string;
  jugador1_id: string;
  jugador2_id: string | null;
  jugador2_nombre_manual: string | null;
  jugador2_categoria_nivel: number | null;
  puntos_combinados: number;
  mejor_ranking_individual: number;
  seed: number;
};

/**
 * Forma las 8 parejas de Categorías Puras mediante cruce de extremos:
 * 1°+16°, 2°+15°, ..., 8°+9°, y las ordena por puntaje combinado descendente
 * (desempate por mejor ranking individual ascendente) asignando Seed #1..#8.
 */
export function formarParejasPuras(
  titulares: {
    jugador_id: string;
    puntos_anuales: number;
    posicion_final: number;
  }[]
): ParejaFormadaDraft[] {
  const ordenados = [...titulares]
    .filter((t) => t.posicion_final >= 1 && t.posicion_final <= 16)
    .sort((a, b) => a.posicion_final - b.posicion_final);

  if (ordenados.length < 16) {
    throw new Error(`Se necesitan 16 titulares confirmados/activos para armar las parejas (hay ${ordenados.length}).`);
  }

  const rawPairs: Omit<ParejaFormadaDraft, "seed">[] = [];
  for (let i = 0; i < 8; i++) {
    const top = ordenados[i];
    const bottom = ordenados[15 - i];
    rawPairs.push({
      cruce_label: `${top.posicion_final}° + ${bottom.posicion_final}°`,
      jugador1_id: top.jugador_id,
      jugador2_id: bottom.jugador_id,
      jugador2_nombre_manual: null,
      jugador2_categoria_nivel: null,
      puntos_combinados: top.puntos_anuales + bottom.puntos_anuales,
      mejor_ranking_individual: Math.min(top.posicion_final, bottom.posicion_final),
    });
  }

  return ordenarSeedsParejas(rawPairs);
}

export function ordenarSeedsParejas<
  T extends {
    puntos_combinados: number;
    mejor_ranking_individual: number;
  }
>(pairs: T[]): (T & { seed: number })[] {
  return [...pairs]
    .sort((a, b) => {
      if (b.puntos_combinados !== a.puntos_combinados) {
        return b.puntos_combinados - a.puntos_combinados;
      }
      return a.mejor_ranking_individual - b.mejor_ranking_individual;
    })
    .map((p, idx) => ({ ...p, seed: idx + 1 }));
}

export function validarSuma7(
  catTitularNivel: number | null | undefined,
  catInvitadoNivel: number | null | undefined
): { ok: boolean; suma: number | null; error?: string } {
  if (!catTitularNivel || !catInvitadoNivel) {
    return {
      ok: false,
      suma: null,
      error: "Indicá la categoría individual tanto del titular como del invitado.",
    };
  }
  const suma = catTitularNivel + catInvitadoNivel;
  if (suma < 7) {
    return {
      ok: false,
      suma,
      error: `La suma de categorías es ${suma} (${catTitularNivel} + ${catInvitadoNivel}) y debe ser igual o mayor a 7.`,
    };
  }
  return { ok: true, suma };
}

export type MasterBracketTemplateMatch = {
  numero_partido: number;
  ronda: MasterRonda;
  seedLocal: number | null;
  seedVisitante: number | null;
  ref_local: string;
  ref_visitante: string;
};

/**
 * Cuadro eliminatorio oficial desde Cuartos de Final:
 * - QF1 (#1): Seed #1 vs Seed #8
 * - QF2 (#2): Seed #4 vs Seed #5
 * - QF3 (#3): Seed #3 vs Seed #6
 * - QF4 (#4): Seed #2 vs Seed #7
 * - SF1 (#5): G:1 vs G:2
 * - SF2 (#6): G:3 vs G:4
 * - Final (#7): G:5 vs G:6
 */
export const MASTER_BRACKET_TEMPLATE: MasterBracketTemplateMatch[] = [
  { numero_partido: 1, ronda: "cuartos", seedLocal: 1, seedVisitante: 8, ref_local: "Seed #1", ref_visitante: "Seed #8" },
  { numero_partido: 2, ronda: "cuartos", seedLocal: 4, seedVisitante: 5, ref_local: "Seed #4", ref_visitante: "Seed #5" },
  { numero_partido: 3, ronda: "cuartos", seedLocal: 3, seedVisitante: 6, ref_local: "Seed #3", ref_visitante: "Seed #6" },
  { numero_partido: 4, ronda: "cuartos", seedLocal: 2, seedVisitante: 7, ref_local: "Seed #2", ref_visitante: "Seed #7" },
  { numero_partido: 5, ronda: "semifinal", seedLocal: null, seedVisitante: null, ref_local: "Ganador QF1", ref_visitante: "Ganador QF2" },
  { numero_partido: 6, ronda: "semifinal", seedLocal: null, seedVisitante: null, ref_local: "Ganador QF3", ref_visitante: "Ganador QF4" },
  { numero_partido: 7, ronda: "final", seedLocal: null, seedVisitante: null, ref_local: "Ganador SF1", ref_visitante: "Ganador SF2" },
];

export type BestOf3Score = {
  set1_local: number | null;
  set1_visitante: number | null;
  set2_local: number | null;
  set2_visitante: number | null;
  set3_local: number | null;
  set3_visitante: number | null;
};

/**
 * Determina el ganador de un partido al mejor de 3 sets completos.
 */
export function determinarGanadorBestOf3(score: BestOf3Score): "local" | "visitante" | null {
  const sets: [number | null, number | null][] = [
    [score.set1_local, score.set1_visitante],
    [score.set2_local, score.set2_visitante],
    [score.set3_local, score.set3_visitante],
  ];

  let setsLocal = 0;
  let setsVisitante = 0;

  for (const [gl, gv] of sets) {
    if (gl === null || gv === null || gl === undefined || gv === undefined) continue;
    if (gl === gv) continue;
    if (gl > gv) setsLocal += 1;
    else setsVisitante += 1;
  }

  if (setsLocal >= 2 && setsLocal > setsVisitante) return "local";
  if (setsVisitante >= 2 && setsVisitante > setsLocal) return "visitante";
  return null;
}

export function getNextMasterMatchTarget(numeroPartido: number): {
  nextNumero: number;
  slot: "team_local_id" | "team_visitante_id";
} | null {
  switch (numeroPartido) {
    case 1:
      return { nextNumero: 5, slot: "team_local_id" };
    case 2:
      return { nextNumero: 5, slot: "team_visitante_id" };
    case 3:
      return { nextNumero: 6, slot: "team_local_id" };
    case 4:
      return { nextNumero: 6, slot: "team_visitante_id" };
    case 5:
      return { nextNumero: 7, slot: "team_local_id" };
    case 6:
      return { nextNumero: 7, slot: "team_visitante_id" };
    default:
      return null;
  }
}

export type ScheduleConflict = {
  type: "cancha" | "jugador";
  matchIdA: string;
  matchIdB: string;
  message: string;
};

function parseHoraToMinutes(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = hora.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function detectarConflictosCronograma(
  matches: {
    id: string;
    categoriaLabel: string;
    rondaLabel: string;
    dia: string | null;
    hora: string | null;
    cancha: number | null;
    playerIds: string[];
  }[],
  minGapMinutes: number = 60
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < matches.length; i++) {
    const a = matches[i];
    const minA = parseHoraToMinutes(a.hora);
    if (!a.dia || minA === null) continue;

    for (let j = i + 1; j < matches.length; j++) {
      const b = matches[j];
      if (a.dia !== b.dia) continue;
      const minB = parseHoraToMinutes(b.hora);
      if (minB === null) continue;

      if (Math.abs(minA - minB) < minGapMinutes) {
        if (a.cancha && b.cancha && a.cancha === b.cancha) {
          conflicts.push({
            type: "cancha",
            matchIdA: a.id,
            matchIdB: b.id,
            message: `Superposición en Cancha ${a.cancha} (${a.dia} ${a.hora}): ${a.categoriaLabel} (${a.rondaLabel}) y ${b.categoriaLabel} (${b.rondaLabel})`,
          });
        }

        const sharedPlayers = a.playerIds.filter((pid) => b.playerIds.includes(pid));
        if (sharedPlayers.length > 0) {
          conflicts.push({
            type: "jugador",
            matchIdA: a.id,
            matchIdB: b.id,
            message: `Jugador con partidos simultáneos (${a.dia} ${a.hora}): ${a.categoriaLabel} (${a.rondaLabel}) y ${b.categoriaLabel} (${b.rondaLabel})`,
          });
        }
      }
    }
  }

  return conflicts;
}
