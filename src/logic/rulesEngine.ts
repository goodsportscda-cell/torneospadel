/**
 * Motor de Reglas Modular (`rulesEngine.ts`)
 * Centraliza la configuración `rules_config`, el cálculo de tabla de posiciones
 * (PJ, PG, PP, Ausencias/WO, SF, SC, DS, GF, GC, DG, Pts), la cascada de desempates
 * y la mecánica de Ascensos y Descensos del Formato Escalera para Ligas y Desafíos Semanales.
 *
 * Aislamiento estricto: Nunca modifica ni interfiere con torneos oficiales de fin de semana.
 */

import {
  applyManualPositions,
  extractPodioFinalFromNotas,
  extractPosicionManualFromNotas,
  extractWOFromNotas,
  filterActiveTorneoJugadores,
  isLigaParejasTournament,
  isPuntosPorSetTournament,
  resolveTorneoCourtsCount,
} from "./torneoStandings";

export type FormatoCompeticion =
  | "convencional"
  | "liga_parejas"
  | "escalera_semanal";

export type CriterioDesempate =
  | "puntos"
  | "enfrentamiento_directo"
  | "diferencia_sets"
  | "diferencia_games"
  | "sorteo";

export interface PuntosCanchaRule {
  victoria: number;
  derrota: number;
}

export interface RulesConfig {
  formato_competicion: FormatoCompeticion;
  puntos_victoria_2_0: number;
  puntos_victoria_2_1: number;
  puntos_derrota_1_2: number;
  puntos_derrota_0_2: number;
  puntos_wo_perdedor: number;
  wo_score_simbolico: string;
  criterios_desempate: CriterioDesempate[];
  puntos_por_cancha: Record<string, PuntosCanchaRule>;
  /**
   * Indica si los puntos de `puntos_por_cancha` fueron personalizados explícitamente
   * por el administrador (para saber si aplicar o no el bonus fijo de Semanas 9 y 10 Crown Pádel).
   */
  custom_cancha_points?: boolean;
}

export const DEFAULT_CRITERIOS_DESEMPATE: CriterioDesempate[] = [
  "puntos",
  "enfrentamiento_directo",
  "diferencia_sets",
  "diferencia_games",
  "sorteo",
];

export const CRITERIO_DESEMPATE_LABELS: Record<CriterioDesempate, string> = {
  puntos: "1. Puntos obtenidos",
  enfrentamiento_directo: "2. Enfrentamiento directo (H2H)",
  diferencia_sets: "3. Diferencia de Sets (DS)",
  diferencia_games: "4. Diferencia de Games (DG)",
  sorteo: "5. Mayor Games a favor / Sorteo",
};

/**
 * Construye el mapa por defecto de puntos por cancha según la cantidad de canchas activas.
 * Cancha 1 (Pista Superior) otorga el puntaje más alto y desciende escalonadamente.
 */
export function buildDefaultPuntosPorCancha(
  courtsCount: number = 3
): Record<string, PuntosCanchaRule> {
  const safeCourts = Math.max(2, Math.min(6, Number(courtsCount) || 3));
  const result: Record<string, PuntosCanchaRule> = {};
  for (let c = 1; c <= 6; c++) {
    // Fórmula clásica compatible: Cancha 1 en 3 canchas = 3 - 1 + 2 = 4 pts victoria, 1 pt derrota
    const winPts = c <= safeCourts ? safeCourts - c + 2 : 2;
    result[String(c)] = {
      victoria: Math.max(2, winPts),
      derrota: 1,
    };
  }
  return result;
}

export const DEFAULT_RULES_CONFIG: RulesConfig = {
  formato_competicion: "convencional",
  puntos_victoria_2_0: 3,
  puntos_victoria_2_1: 2,
  puntos_derrota_1_2: 1,
  puntos_derrota_0_2: 0,
  puntos_wo_perdedor: 0,
  wo_score_simbolico: "6-0, 6-0",
  criterios_desempate: [...DEFAULT_CRITERIOS_DESEMPATE],
  puntos_por_cancha: buildDefaultPuntosPorCancha(3),
};

/**
 * Verifica que el torneo sea una Liga o Desafío Semanal y NO un torneo oficial de fin de semana.
 */
export function isTorneoElegibleEscalera(torneo: any): boolean {
  if (!torneo) return false;
  if (torneo.tipo === "oficial") return false;
  return (
    torneo.tipo === "americano_individual" ||
    torneo.tipo === "americano" ||
    Boolean(torneo.modalidad)
  );
}

/**
 * Extrae `rules_config` embebido en `torneos.notas` como fallback resiliente
 * en caso de que la migración SQL aún no haya sido corrida en la base remota.
 */
export function extractRulesConfigFromNotas(
  notas: string | null | undefined
): Partial<RulesConfig> | null {
  if (!notas) return null;
  const match = notas.match(/\[RULES_CONFIG:([A-Za-z0-9+/=_-]+)\]/);
  if (!match || !match[1]) return null;
  try {
    const jsonStr = decodeURIComponent(escape(atob(match[1])));
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persiste o actualiza la etiqueta `[RULES_CONFIG:base64]` en `torneos.notas`.
 */
export function updateRulesConfigInNotas(
  notas: string | null | undefined,
  config: RulesConfig | null
): string {
  let clean = (notas || "").replace(/\[RULES_CONFIG:[A-Za-z0-9+/=_-]+\]\s*/g, "").trim();
  if (!config) return clean;
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    clean = `${clean} [RULES_CONFIG:${encoded}]`.trim();
  } catch {
    // ignore encoding error
  }
  return clean;
}

/**
 * Resuelve la configuración efectiva `RulesConfig` para un torneo, garantizando
 * compatibilidad total con todos los torneos y desafíos semanales ya en curso.
 */
export function resolveRulesConfig(
  torneo: any,
  sistemaPuntuacionOverride?: string | null,
  activePlayersCount?: number,
  parejasCount?: number
): RulesConfig {
  const countCanchas = resolveTorneoCourtsCount(
    torneo,
    activePlayersCount,
    parejasCount
  );
  const isLiga = isLigaParejasTournament(torneo, sistemaPuntuacionOverride || undefined);
  const isPtsSet = isPuntosPorSetTournament(
    torneo,
    sistemaPuntuacionOverride,
    activePlayersCount
  );

  // Configuración base derivada del tipo de torneo actual para no alterar ningún torneo en curso
  const baseFormato: FormatoCompeticion =
    !isTorneoElegibleEscalera(torneo)
      ? "convencional"
      : isLiga
      ? "liga_parejas"
      : isPtsSet
      ? "convencional"
      : "escalera_semanal";

  const baseCriterios: CriterioDesempate[] = isLiga
    ? [
        "puntos",
        "enfrentamiento_directo",
        "diferencia_sets",
        "diferencia_games",
        "sorteo",
      ]
    : ["puntos", "diferencia_sets", "diferencia_games", "sorteo"];

  const basePuntosPorCancha = buildDefaultPuntosPorCancha(countCanchas);

  // Leer config guardada en columna `rules_config` o en tag de `notas`
  const rawDbConfig =
    torneo?.rules_config && typeof torneo.rules_config === "object"
      ? (torneo.rules_config as Partial<RulesConfig>)
      : null;
  const rawNotasConfig = extractRulesConfigFromNotas(torneo?.notas);

  // Solo considerar que hay override explícito si se guardó en notas o si el JSON de DB fue personalizado
  const explicitConfig: Partial<RulesConfig> | null = rawNotasConfig || rawDbConfig;

  // Si el torneo ya es Liga de Parejas o Escalera por `sistema_puntuacion`, priorizar coherencia con el selector
  let resolvedFormato: FormatoCompeticion = baseFormato;
  if (sistemaPuntuacionOverride === "liga_parejas") {
    resolvedFormato = "liga_parejas";
  } else if (sistemaPuntuacionOverride === "puntos_por_set") {
    resolvedFormato = "convencional";
  } else if (sistemaPuntuacionOverride === "escalera_semanal") {
    resolvedFormato = "escalera_semanal";
  } else if (sistemaPuntuacionOverride === "convencional") {
    resolvedFormato = "convencional";
  } else if (
    explicitConfig?.formato_competicion &&
    // Si la columna DB vino con el default "convencional" en un torneo que ya era liga_parejas o por_cancha sin customización explícita, respetar la modalidad real del torneo
    (rawNotasConfig || explicitConfig.custom_cancha_points || explicitConfig.formato_competicion !== "convencional")
  ) {
    resolvedFormato = explicitConfig.formato_competicion;
  }

  // Aislamiento estricto: torneos oficiales de fin de semana nunca usan escalera_semanal
  if (!isTorneoElegibleEscalera(torneo) && resolvedFormato === "escalera_semanal") {
    resolvedFormato = "convencional";
  }

  const mergedPuntosPorCancha: Record<string, PuntosCanchaRule> = {
    ...basePuntosPorCancha,
  };
  if (explicitConfig?.puntos_por_cancha && typeof explicitConfig.puntos_por_cancha === "object") {
    // Aplicar puntos por cancha explícitos solo si fueron configurados para este torneo
    if (rawNotasConfig || explicitConfig.custom_cancha_points || countCanchas === 3) {
      Object.entries(explicitConfig.puntos_por_cancha).forEach(([k, val]) => {
        if (val && typeof val === "object") {
          mergedPuntosPorCancha[k] = {
            victoria: Number(val.victoria ?? basePuntosPorCancha[k]?.victoria ?? 3),
            derrota: Number(val.derrota ?? basePuntosPorCancha[k]?.derrota ?? 1),
          };
        }
      });
    }
  }

  const defaultWoPerdedor = resolvedFormato === "liga_parejas" ? -1 : 0;

  return {
    formato_competicion: resolvedFormato,
    puntos_victoria_2_0:
      typeof explicitConfig?.puntos_victoria_2_0 === "number"
        ? explicitConfig.puntos_victoria_2_0
        : 3,
    puntos_victoria_2_1:
      typeof explicitConfig?.puntos_victoria_2_1 === "number"
        ? explicitConfig.puntos_victoria_2_1
        : 2,
    puntos_derrota_1_2:
      typeof explicitConfig?.puntos_derrota_1_2 === "number"
        ? explicitConfig.puntos_derrota_1_2
        : 1,
    puntos_derrota_0_2:
      typeof explicitConfig?.puntos_derrota_0_2 === "number"
        ? explicitConfig.puntos_derrota_0_2
        : 0,
    puntos_wo_perdedor:
      typeof explicitConfig?.puntos_wo_perdedor === "number" &&
      (rawNotasConfig || explicitConfig.puntos_wo_perdedor !== 0 || resolvedFormato !== "liga_parejas")
        ? explicitConfig.puntos_wo_perdedor
        : defaultWoPerdedor,
    wo_score_simbolico:
      typeof explicitConfig?.wo_score_simbolico === "string" &&
      explicitConfig.wo_score_simbolico.trim().length > 0
        ? explicitConfig.wo_score_simbolico.trim()
        : "6-0, 6-0",
    criterios_desempate:
      Array.isArray(explicitConfig?.criterios_desempate) &&
      explicitConfig!.criterios_desempate.length > 0 &&
      (rawNotasConfig || resolvedFormato === "liga_parejas" || explicitConfig?.custom_cancha_points)
        ? (explicitConfig!.criterios_desempate as CriterioDesempate[])
        : baseCriterios,
    puntos_por_cancha: mergedPuntosPorCancha,
    custom_cancha_points: Boolean(explicitConfig?.custom_cancha_points),
  };
}

/**
 * Parsea `wo_score_simbolico` (ej. `"6-0, 6-0"`) para obtener los sets y games
 * que suma el ganador por W.O. El ausente por W.O. nunca suma sets ni games a favor.
 */
export function parseWoScoreSimbolico(woScore: string = "6-0, 6-0"): {
  winnerSets: number;
  loserSets: number;
  winnerGames: number;
  loserGames: number;
} {
  if (!woScore || typeof woScore !== "string") {
    return { winnerSets: 2, loserSets: 0, winnerGames: 12, loserGames: 0 };
  }
  const setParts = woScore
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let winnerSets = 0;
  let winnerGames = 0;

  for (const part of setParts) {
    const m = part.match(/(\d+)\s*-\s*(\d+)/);
    if (m) {
      const g1 = parseInt(m[1], 10) || 0;
      const g2 = parseInt(m[2], 10) || 0;
      winnerSets += 1;
      winnerGames += Math.max(g1, g2);
    }
  }

  if (winnerSets === 0) {
    return { winnerSets: 2, loserSets: 0, winnerGames: 12, loserGames: 0 };
  }

  return {
    winnerSets,
    loserSets: 0,
    winnerGames,
    loserGames: 0,
  };
}

/**
 * Obtiene el puntaje de victoria y derrota en una cancha específica para `escalera_semanal`.
 */
export function getCourtPointsFromConfig(
  rulesConfig: RulesConfig,
  courtIndex: number,
  fechaNum?: number | null,
  countCanchas: number = 3
): { ptsWin: number; ptsLose: number } {
  // Reglamento Oficial Crown Pádel (Semanas 9 y 10 de Definición por Tabla Viva)
  // Se aplica si el admin no sobreescribió manualmente los puntos de cancha
  if (!rulesConfig.custom_cancha_points) {
    if (fechaNum === 9) {
      return { ptsWin: 4, ptsLose: 1 };
    }
    if (fechaNum === 10) {
      return { ptsWin: 6, ptsLose: 2 };
    }
  }

  const key = String(Math.max(1, Math.min(6, courtIndex)));
  const configured = rulesConfig.puntos_por_cancha?.[key];
  if (configured && typeof configured.victoria === "number") {
    return {
      ptsWin: configured.victoria,
      ptsLose: typeof configured.derrota === "number" ? configured.derrota : 1,
    };
  }

  return {
    ptsWin: Math.max(2, countCanchas - courtIndex + 2),
    ptsLose: 1,
  };
}

/**
 * Compara enfrentamiento directo (Head-to-Head) entre dos participantes (parejas o jugadores individuales).
 */
export function compareHeadToHead(a: any, b: any, matches: any[] = []): number {
  if (!matches || matches.length === 0) return 0;

  // Caso 1: Comparación entre Parejas (tienen jugador1_id y jugador2_id)
  if (a.jugador1_id && a.jugador2_id && b.jugador1_id && b.jugador2_id) {
    const isCoupleMatch = (m: any) => {
      if (m.estado !== "finalizado") return false;
      const team1MatchesA =
        (m.jugador1_id === a.jugador1_id && m.jugador2_id === a.jugador2_id) ||
        (m.jugador1_id === a.jugador2_id && m.jugador2_id === a.jugador1_id);
      const team2MatchesB =
        (m.jugador3_id === b.jugador1_id && m.jugador4_id === b.jugador2_id) ||
        (m.jugador3_id === b.jugador2_id && m.jugador4_id === b.jugador1_id);

      const team1MatchesB =
        (m.jugador1_id === b.jugador1_id && m.jugador2_id === b.jugador2_id) ||
        (m.jugador1_id === b.jugador2_id && m.jugador2_id === b.jugador1_id);
      const team2MatchesA =
        (m.jugador3_id === a.jugador1_id && m.jugador4_id === a.jugador2_id) ||
        (m.jugador3_id === a.jugador2_id && m.jugador4_id === a.jugador1_id);

      return (team1MatchesA && team2MatchesB) || (team1MatchesB && team2MatchesA);
    };

    const directMatches = matches.filter(isCoupleMatch);
    if (directMatches.length === 0) return 0;

    let aWins = 0;
    let bWins = 0;
    let aSetsH2H = 0;
    let bSetsH2H = 0;
    let aGamesH2H = 0;
    let bGamesH2H = 0;

    directMatches.forEach((m) => {
      const aIsTeam1 =
        (m.jugador1_id === a.jugador1_id && m.jugador2_id === a.jugador2_id) ||
        (m.jugador1_id === a.jugador2_id && m.jugador2_id === a.jugador1_id);

      const setsA = aIsTeam1 ? m.sets_pareja1 : m.sets_pareja2;
      const setsB = aIsTeam1 ? m.sets_pareja2 : m.sets_pareja1;

      let gamesA = 0;
      let gamesB = 0;
      m.sets?.forEach((s: any) => {
        gamesA += aIsTeam1 ? s.games_pareja1 : s.games_pareja2;
        gamesB += aIsTeam1 ? s.games_pareja2 : s.games_pareja1;
      });

      if (setsA > setsB) aWins++;
      else if (setsB > setsA) bWins++;

      aSetsH2H += setsA;
      bSetsH2H += setsB;
      aGamesH2H += gamesA;
      bGamesH2H += gamesB;
    });

    if (aWins !== bWins) return bWins - aWins;
    if (aSetsH2H !== bSetsH2H) return bSetsH2H - aSetsH2H;
    if (aGamesH2H !== bGamesH2H) return bGamesH2H - aGamesH2H;
    return 0;
  }

  // Caso 2: Comparación entre Jugadores Individuales (cuando se enfrentaron en lados opuestos de la red)
  if (a.jugador_id && b.jugador_id) {
    let aWins = 0;
    let bWins = 0;
    let aSetsH2H = 0;
    let bSetsH2H = 0;
    let aGamesH2H = 0;
    let bGamesH2H = 0;

    matches.forEach((m) => {
      if (m.estado !== "finalizado") return;
      const aInTeam1 = m.jugador1_id === a.jugador_id || m.jugador2_id === a.jugador_id;
      const aInTeam2 = m.jugador3_id === a.jugador_id || m.jugador4_id === a.jugador_id;
      const bInTeam1 = m.jugador1_id === b.jugador_id || m.jugador2_id === b.jugador_id;
      const bInTeam2 = m.jugador3_id === b.jugador_id || m.jugador4_id === b.jugador_id;

      if ((aInTeam1 && bInTeam2) || (aInTeam2 && bInTeam1)) {
        const setsA = aInTeam1 ? m.sets_pareja1 : m.sets_pareja2;
        const setsB = aInTeam1 ? m.sets_pareja2 : m.sets_pareja1;
        let gamesA = 0;
        let gamesB = 0;
        m.sets?.forEach((s: any) => {
          gamesA += aInTeam1 ? s.games_pareja1 : s.games_pareja2;
          gamesB += aInTeam1 ? s.games_pareja2 : s.games_pareja1;
        });

        if (setsA > setsB) aWins++;
        else if (setsB > setsA) bWins++;

        aSetsH2H += setsA;
        bSetsH2H += setsB;
        aGamesH2H += gamesA;
        bGamesH2H += gamesB;
      }
    });

    if (aWins !== bWins) return bWins - aWins;
    if (aSetsH2H !== bSetsH2H) return bSetsH2H - aSetsH2H;
    if (aGamesH2H !== bGamesH2H) return bGamesH2H - aGamesH2H;
  }

  return 0;
}

/**
 * Cascada de desempate configurable que respeta estrictamente el orden definido en `criterios_desempate`.
 */
export function compareStandingsByCriterios(
  a: any,
  b: any,
  matches: any[] = [],
  criterios: CriterioDesempate[] = DEFAULT_CRITERIOS_DESEMPATE
): number {
  const activeCriterios =
    Array.isArray(criterios) && criterios.length > 0
      ? criterios
      : DEFAULT_CRITERIOS_DESEMPATE;

  for (const criterio of activeCriterios) {
    if (criterio === "puntos") {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    } else if (criterio === "enfrentamiento_directo") {
      const h2h = compareHeadToHead(a, b, matches);
      if (h2h !== 0) return h2h;
    } else if (criterio === "diferencia_sets") {
      const dsA =
        typeof a.difSets === "number"
          ? a.difSets
          : (a.setsGanados || 0) - (a.setsPerdidos || 0);
      const dsB =
        typeof b.difSets === "number"
          ? b.difSets
          : (b.setsGanados || 0) - (b.setsPerdidos || 0);
      if (dsB !== dsA) return dsB - dsA;
    } else if (criterio === "diferencia_games") {
      const dgA =
        typeof a.difGames === "number"
          ? a.difGames
          : (a.gamesGanados || 0) - (a.gamesPerdidos || 0);
      const dgB =
        typeof b.difGames === "number"
          ? b.difGames
          : (b.gamesGanados || 0) - (b.gamesPerdidos || 0);
      if (dgB !== dgA) return dgB - dgA;
    } else if (criterio === "sorteo") {
      if ((b.gamesGanados || 0) !== (a.gamesGanados || 0)) {
        return (b.gamesGanados || 0) - (a.gamesGanados || 0);
      }
      const nameA = a.jugador1?.apellido
        ? `${a.jugador1.apellido} ${a.jugador1.nombre}`
        : a.apellido
        ? `${a.apellido} ${a.nombre}`
        : a.pareja_id || a.jugador_id || "";
      const nameB = b.jugador1?.apellido
        ? `${b.jugador1.apellido} ${b.jugador1.nombre}`
        : b.apellido
        ? `${b.apellido} ${b.nombre}`
        : b.pareja_id || b.jugador_id || "";
      const cmp = nameA.localeCompare(nameB);
      if (cmp !== 0) return cmp;
    }
  }

  // Fallback determinístico final
  const fallbackA = a.jugador1?.apellido
    ? `${a.jugador1.apellido} ${a.jugador1.nombre}`
    : a.apellido
    ? `${a.apellido} ${a.nombre}`
    : a.pareja_id || a.jugador_id || "";
  const fallbackB = b.jugador1?.apellido
    ? `${b.jugador1.apellido} ${b.jugador1.nombre}`
    : b.apellido
    ? `${b.apellido} ${b.nombre}`
    : b.pareja_id || b.jugador_id || "";
  return fallbackA.localeCompare(fallbackB);
}

/**
 * Calcula la tabla general de posiciones (Parejas o Individual) centralizando:
 * PJ (`partidosJugados`), PG (`partidosGanados`), PP (`partidosPerdidos`),
 * Ausencias/WO (`woCount` / `suplenciasUsadas`),
 * SF (`setsGanados`), SC (`setsPerdidos`), DS (`difSets`),
 * GF (`gamesGanados`), GC (`gamesPerdidos`), DG (`difGames`), y Pts (`puntos`).
 */
export function computeTorneoStandings({
  torneo,
  jugadoresInscriptos,
  parejas,
  partidos,
  sistemaPuntuacion,
  onlyPublishedFechas = false,
  fechas = [],
}: {
  torneo: any;
  jugadoresInscriptos: any[];
  parejas: any[];
  partidos: any[];
  sistemaPuntuacion?: string | null;
  onlyPublishedFechas?: boolean;
  fechas?: any[];
}): any[] {
  if (!torneo) return [];

  const activeInscriptos = filterActiveTorneoJugadores(jugadoresInscriptos);
  const countCanchas = resolveTorneoCourtsCount(
    torneo,
    activeInscriptos.length,
    parejas.length
  );
  const isLigaParejas = isLigaParejasTournament(
    torneo,
    sistemaPuntuacion || undefined
  );
  const esPuntosPorSet = isPuntosPorSetTournament(
    torneo,
    sistemaPuntuacion,
    activeInscriptos.length
  );

  const rulesConfig = resolveRulesConfig(
    torneo,
    sistemaPuntuacion,
    activeInscriptos.length,
    parejas.length
  );
  const woSymbolic = parseWoScoreSimbolico(rulesConfig.wo_score_simbolico);

  const validFinalizedMatches = (partidos || []).filter((p) => {
    if (p.estado !== "finalizado") return false;
    if (onlyPublishedFechas && fechas.length > 0) {
      const fObj = fechas.find((f) => f.fecha === p.fecha);
      return fObj?.publicado === true;
    }
    return true;
  });

  // =========================================================================
  // MODALIDAD PAREJAS / LIGA DE PAREJAS
  // =========================================================================
  if (torneo.modalidad === "parejas" || isLigaParejas) {
    const standingsMap = new Map<string, any>();

    (parejas || []).forEach((p) => {
      if (p.jugador1 && p.jugador2) {
        let initialPts = Number((p as any).puntos_iniciales) || 0;
        if (!initialPts && torneo?.notas) {
          const matchTag = torneo.notas.match(
            new RegExp(`\\[PUNTOS_INICIALES_${p.id}:(\\d+(?:\\.\\d+)?)\\]`)
          );
          if (matchTag && matchTag[1]) {
            initialPts = Number(matchTag[1]);
          }
        }

        const manualPos =
          typeof (p as any).posicion_manual === "number" &&
          (p as any).posicion_manual > 0
            ? (p as any).posicion_manual
            : extractPosicionManualFromNotas(torneo?.notas, p.id);

        standingsMap.set(p.id, {
          pareja_id: p.id,
          jugador1_id: p.jugador1_id,
          jugador2_id: p.jugador2_id,
          jugador1: p.jugador1,
          jugador2: p.jugador2,
          posicion_manual: manualPos,
          podio_final:
            (p as any).podio_final ??
            extractPodioFinalFromNotas(torneo?.notas, p.id),
          puntos: initialPts,
          puntos_iniciales: initialPts,
          setsGanados: 0,
          setsPerdidos: 0,
          gamesGanados: 0,
          gamesPerdidos: 0,
          difSets: 0,
          difGames: 0,
          partidosJugados: 0,
          partidosGanados: 0,
          partidosPerdidos: 0,
          woCount: 0,
          suplenciasUsadas: 0,
        });
      }
    });

    // Contabilizar suplencias acumuladas por pareja
    validFinalizedMatches.forEach((p) => {
      const coupleA = parejas.find(
        (cp) =>
          (cp.jugador1_id === p.jugador1_id && cp.jugador2_id === p.jugador2_id) ||
          (cp.jugador1_id === p.jugador2_id && cp.jugador2_id === p.jugador1_id)
      );
      if (coupleA && (p.suplente1_nombre || p.suplente2_nombre)) {
        const s = standingsMap.get(coupleA.id);
        if (s) s.suplenciasUsadas++;
      }

      const coupleB = parejas.find(
        (cp) =>
          (cp.jugador1_id === p.jugador3_id && cp.jugador2_id === p.jugador4_id) ||
          (cp.jugador1_id === p.jugador4_id && cp.jugador2_id === p.jugador3_id)
      );
      if (coupleB && (p.suplente3_nombre || p.suplente4_nombre)) {
        const s = standingsMap.get(coupleB.id);
        if (s) s.suplenciasUsadas++;
      }
    });

    // Procesar estadísticas de cada partido finalizado
    validFinalizedMatches.forEach((p) => {
      const coupleA = parejas.find(
        (cp) =>
          (cp.jugador1_id === p.jugador1_id && cp.jugador2_id === p.jugador2_id) ||
          (cp.jugador1_id === p.jugador2_id && cp.jugador2_id === p.jugador1_id)
      );
      const coupleB = parejas.find(
        (cp) =>
          (cp.jugador1_id === p.jugador3_id && cp.jugador2_id === p.jugador4_id) ||
          (cp.jugador1_id === p.jugador4_id && cp.jugador2_id === p.jugador3_id)
      );

      if (!coupleA || !coupleB) return;

      const standA = standingsMap.get(coupleA.id);
      const standB = standingsMap.get(coupleB.id);
      if (!standA || !standB) return;

      const isAForfeit =
        (p.suplente1_nombre || p.suplente2_nombre) && standA.suplenciasUsadas > 2;
      const isBForfeit =
        (p.suplente3_nombre || p.suplente4_nombre) && standB.suplenciasUsadas > 2;

      let setsP1 = p.sets_pareja1;
      let setsP2 = p.sets_pareja2;
      let gamesP1 = 0;
      let gamesP2 = 0;

      p.sets?.forEach((s: any) => {
        gamesP1 += s.games_pareja1;
        gamesP2 += s.games_pareja2;
      });

      if (isAForfeit && isBForfeit) {
        setsP1 = 0;
        setsP2 = 0;
        gamesP1 = 0;
        gamesP2 = 0;
      } else if (isAForfeit) {
        setsP1 = 0;
        setsP2 = woSymbolic.winnerSets;
        gamesP1 = 0;
        gamesP2 = woSymbolic.winnerGames;
        standA.woCount++;
      } else if (isBForfeit) {
        setsP1 = woSymbolic.winnerSets;
        setsP2 = 0;
        gamesP1 = woSymbolic.winnerGames;
        gamesP2 = 0;
        standB.woCount++;
      }

      const p1Won = setsP1 > setsP2;
      const canchaNumMatch = (p.cancha || "").match(/\d+/);
      const courtIndex = canchaNumMatch ? parseInt(canchaNumMatch[0], 10) : 1;

      const { ptsWin, ptsLose } = getCourtPointsFromConfig(
        rulesConfig,
        courtIndex,
        p.fecha,
        countCanchas
      );

      const woInfractor = extractWOFromNotas(torneo?.notas, p.id);

      // Si el formato es Liga de Parejas o Convencional por partido (no por set ni escalera)
      const useMatchScoreRules =
        isLigaParejas ||
        rulesConfig.formato_competicion === "liga_parejas" ||
        (rulesConfig.formato_competicion === "convencional" && !esPuntosPorSet);

      if (useMatchScoreRules) {
        if (woInfractor === 1) {
          standA.puntos += rulesConfig.puntos_wo_perdedor;
          standB.puntos += rulesConfig.puntos_victoria_2_0;
          standA.setsPerdidos += woSymbolic.winnerSets;
          standB.setsGanados += woSymbolic.winnerSets;
          standA.gamesPerdidos += woSymbolic.winnerGames;
          standB.gamesGanados += woSymbolic.winnerGames;
          standA.partidosJugados++;
          standB.partidosJugados++;
          standA.partidosPerdidos++;
          standB.partidosGanados++;
          standA.woCount++;
        } else if (woInfractor === 2) {
          standA.puntos += rulesConfig.puntos_victoria_2_0;
          standB.puntos += rulesConfig.puntos_wo_perdedor;
          standA.setsGanados += woSymbolic.winnerSets;
          standB.setsPerdidos += woSymbolic.winnerSets;
          standA.gamesGanados += woSymbolic.winnerGames;
          standB.gamesPerdidos += woSymbolic.winnerGames;
          standA.partidosJugados++;
          standB.partidosJugados++;
          standA.partidosGanados++;
          standB.partidosPerdidos++;
          standB.woCount++;
        } else {
          const wentToSTB =
            (setsP1 === 2 && setsP2 === 1) || (setsP1 === 1 && setsP2 === 2);
          if (wentToSTB) {
            standA.puntos += p1Won
              ? rulesConfig.puntos_victoria_2_1
              : rulesConfig.puntos_derrota_1_2;
            standB.puntos += !p1Won
              ? rulesConfig.puntos_victoria_2_1
              : rulesConfig.puntos_derrota_1_2;
          } else {
            standA.puntos += p1Won
              ? rulesConfig.puntos_victoria_2_0
              : rulesConfig.puntos_derrota_0_2;
            standB.puntos += !p1Won
              ? rulesConfig.puntos_victoria_2_0
              : rulesConfig.puntos_derrota_0_2;
          }
          standA.partidosJugados++;
          standB.partidosJugados++;
          if (p1Won) {
            standA.partidosGanados++;
            standB.partidosPerdidos++;
          } else if (setsP2 > setsP1) {
            standB.partidosGanados++;
            standA.partidosPerdidos++;
          }
          standA.setsGanados += setsP1;
          standA.setsPerdidos += setsP2;
          standB.setsGanados += setsP2;
          standB.setsPerdidos += setsP1;
          standA.gamesGanados += gamesP1;
          standA.gamesPerdidos += gamesP2;
          standB.gamesGanados += gamesP2;
          standB.gamesPerdidos += gamesP1;
        }
      } else {
        // Escalera Semanal (puntos por cancha) o Puntos por Set
        if (woInfractor === 1) {
          standA.puntos += rulesConfig.puntos_wo_perdedor;
          standB.puntos += esPuntosPorSet ? woSymbolic.winnerSets : ptsWin;
          standA.setsPerdidos += woSymbolic.winnerSets;
          standB.setsGanados += woSymbolic.winnerSets;
          standA.gamesPerdidos += woSymbolic.winnerGames;
          standB.gamesGanados += woSymbolic.winnerGames;
          standA.partidosJugados++;
          standB.partidosJugados++;
          standA.partidosPerdidos++;
          standB.partidosGanados++;
          standA.woCount++;
        } else if (woInfractor === 2) {
          standA.puntos += esPuntosPorSet ? woSymbolic.winnerSets : ptsWin;
          standB.puntos += rulesConfig.puntos_wo_perdedor;
          standA.setsGanados += woSymbolic.winnerSets;
          standB.setsPerdidos += woSymbolic.winnerSets;
          standA.gamesGanados += woSymbolic.winnerGames;
          standB.gamesPerdidos += woSymbolic.winnerGames;
          standA.partidosJugados++;
          standB.partidosJugados++;
          standA.partidosGanados++;
          standB.partidosPerdidos++;
          standB.woCount++;
        } else {
          standA.partidosJugados++;
          standB.partidosJugados++;
          if (p1Won) {
            standA.partidosGanados++;
            standB.partidosPerdidos++;
          } else if (setsP2 > setsP1) {
            standB.partidosGanados++;
            standA.partidosPerdidos++;
          }
          standA.setsGanados += setsP1;
          standA.setsPerdidos += setsP2;
          standA.gamesGanados += gamesP1;
          standA.gamesPerdidos += gamesP2;
          standA.puntos += esPuntosPorSet ? setsP1 : p1Won ? ptsWin : ptsLose;

          standB.setsGanados += setsP2;
          standB.setsPerdidos += setsP1;
          standB.gamesGanados += gamesP2;
          standB.gamesPerdidos += gamesP1;
          standB.puntos += esPuntosPorSet ? setsP2 : !p1Won ? ptsWin : ptsLose;
        }
      }
    });

    const list = Array.from(standingsMap.values()).map((s) => ({
      ...s,
      difSets: s.setsGanados - s.setsPerdidos,
      difGames: s.gamesGanados - s.gamesPerdidos,
    }));

    const defaultSorter = (a: any, b: any) =>
      compareStandingsByCriterios(
        a,
        b,
        validFinalizedMatches,
        rulesConfig.criterios_desempate
      );

    return applyManualPositions(list, defaultSorter);
  }

  // =========================================================================
  // MODALIDAD INDIVIDUAL (DESAFÍO SEMANAL / ESCALERA / PUNTOS POR SET)
  // =========================================================================
  const standingsMap = new Map<string, any>();
  activeInscriptos.forEach((tj) => {
    if (tj.jugador) {
      let initialPts = Number((tj as any).puntos_iniciales) || 0;
      if (!initialPts && torneo?.notas) {
        const matchTag = torneo.notas.match(
          new RegExp(`\\[PUNTOS_INICIALES_${tj.jugador_id}:(\\d+(?:\\.\\d+)?)\\]`)
        );
        if (matchTag && matchTag[1]) {
          initialPts = Number(matchTag[1]);
        }
      }

      const manualPos =
        typeof (tj as any).posicion_manual === "number" &&
        (tj as any).posicion_manual > 0
          ? (tj as any).posicion_manual
          : extractPosicionManualFromNotas(torneo?.notas, tj.jugador_id);

      standingsMap.set(tj.jugador_id, {
        jugador_id: tj.jugador_id,
        nombre: tj.jugador.nombre,
        apellido: tj.jugador.apellido,
        dni: tj.jugador.dni,
        club: tj.jugador.club ?? null,
        podio_final:
          (tj as any).podio_final ??
          extractPodioFinalFromNotas(torneo?.notas, tj.jugador_id),
        posicion_manual: manualPos,
        puntos: initialPts,
        puntos_iniciales: initialPts,
        setsGanados: 0,
        setsPerdidos: 0,
        gamesGanados: 0,
        gamesPerdidos: 0,
        difSets: 0,
        difGames: 0,
        partidosJugados: 0,
        partidosGanados: 0,
        partidosPerdidos: 0,
        woCount: 0,
        suplenciasUsadas: 0,
      });
    }
  });

  const sortedMatches = [...validFinalizedMatches].sort(
    (a, b) => (a.fecha || 0) - (b.fecha || 0)
  );
  const absenceCountMap = new Map<string, number>();

  sortedMatches.forEach((p) => {
    const canchaNumMatch = (p.cancha || "").match(/\d+/);
    const courtIndex = canchaNumMatch ? parseInt(canchaNumMatch[0], 10) : 1;

    const { ptsWin: ptsWinner, ptsLose: ptsLoser } = getCourtPointsFromConfig(
      rulesConfig,
      courtIndex,
      p.fecha,
      countCanchas
    );

    let gamesP1 = 0;
    let gamesP2 = 0;
    p.sets?.forEach((s: any) => {
      gamesP1 += s.games_pareja1;
      gamesP2 += s.games_pareja2;
    });

    const p1Won = p.sets_pareja1 > p.sets_pareja2;
    const woInfractor = extractWOFromNotas(torneo?.notas, p.id);

    const awardStats = (
      jugId: string | null,
      isWinner: boolean,
      wasAbsent: boolean,
      isTeamWoLoser: boolean,
      isTeamWoWinner: boolean,
      gamesOwn: number,
      gamesOpp: number,
      setsOwn: number,
      setsOpp: number
    ) => {
      if (!jugId) return;
      const s = standingsMap.get(jugId);
      if (!s) return;

      s.partidosJugados++;
      if (isWinner) s.partidosGanados++;
      else s.partidosPerdidos++;

      if (isTeamWoLoser) {
        s.woCount++;
        s.puntos += rulesConfig.puntos_wo_perdedor;
        s.setsPerdidos += woSymbolic.winnerSets;
        s.gamesPerdidos += woSymbolic.winnerGames;
        return;
      }

      if (isTeamWoWinner) {
        s.puntos += esPuntosPorSet ? woSymbolic.winnerSets : ptsWinner;
        s.setsGanados += woSymbolic.winnerSets;
        s.gamesGanados += woSymbolic.winnerGames;
        return;
      }

      if (wasAbsent) {
        const prevAbsences = absenceCountMap.get(jugId) || 0;
        const newAbsences = prevAbsences + 1;
        absenceCountMap.set(jugId, newAbsences);
        s.suplenciasUsadas = newAbsences;

        if (newAbsences > 2) {
          // Ausencia 3+: W.O. individual (puntos_wo_perdedor y pierde simbólico 6-0, 6-0)
          s.woCount++;
          s.puntos += rulesConfig.puntos_wo_perdedor;
          s.setsGanados += 0;
          s.setsPerdidos += woSymbolic.winnerSets;
          s.gamesGanados += 0;
          s.gamesPerdidos += woSymbolic.winnerGames;
        } else {
          s.puntos += esPuntosPorSet ? setsOwn : isWinner ? ptsWinner : ptsLoser;
          s.setsGanados += setsOwn;
          s.setsPerdidos += setsOpp;
          s.gamesGanados += gamesOwn;
          s.gamesPerdidos += gamesOpp;
        }
      } else {
        s.puntos += esPuntosPorSet ? setsOwn : isWinner ? ptsWinner : ptsLoser;
        s.setsGanados += setsOwn;
        s.setsPerdidos += setsOpp;
        s.gamesGanados += gamesOwn;
        s.gamesPerdidos += gamesOpp;
      }
    };

    const team1WoLoser = woInfractor === 1;
    const team2WoLoser = woInfractor === 2;

    awardStats(
      p.jugador1_id,
      team2WoLoser ? true : team1WoLoser ? false : p1Won,
      !!p.suplente1_nombre,
      team1WoLoser,
      team2WoLoser,
      gamesP1,
      gamesP2,
      p.sets_pareja1,
      p.sets_pareja2
    );
    awardStats(
      p.jugador2_id,
      team2WoLoser ? true : team1WoLoser ? false : p1Won,
      !!p.suplente2_nombre,
      team1WoLoser,
      team2WoLoser,
      gamesP1,
      gamesP2,
      p.sets_pareja1,
      p.sets_pareja2
    );
    awardStats(
      p.jugador3_id,
      team1WoLoser ? true : team2WoLoser ? false : !p1Won,
      !!p.suplente3_nombre,
      team2WoLoser,
      team1WoLoser,
      gamesP2,
      gamesP1,
      p.sets_pareja2,
      p.sets_pareja1
    );
    awardStats(
      p.jugador4_id,
      team1WoLoser ? true : team2WoLoser ? false : !p1Won,
      !!p.suplente4_nombre,
      team2WoLoser,
      team1WoLoser,
      gamesP2,
      gamesP1,
      p.sets_pareja2,
      p.sets_pareja1
    );
  });

  const list = Array.from(standingsMap.values()).map((s) => ({
    ...s,
    difSets: s.setsGanados - s.setsPerdidos,
    difGames: s.gamesGanados - s.gamesPerdidos,
  }));

  const defaultSorter = (a: any, b: any) =>
    compareStandingsByCriterios(
      a,
      b,
      validFinalizedMatches,
      rulesConfig.criterios_desempate
    );

  return applyManualPositions(list, defaultSorter);
}

export interface EscaleraSuggestedMatch {
  canchaNumero: number;
  canchaNombre: string;
  jugador1_id: string;
  jugador2_id: string;
  jugador3_id: string;
  jugador4_id: string;
  movimientoA: string;
  movimientoB: string;
}

/**
 * Mecánica de Ascensos y Descensos Semanales (Formato Escalera):
 * Al cerrar una fecha, calcula y sugiere los cruces de la fecha siguiente
 * subiendo de cancha a los ganadores y bajando de cancha a los perdedores
 * (soportando de 2 a 6 canchas tanto en Parejas como en Individual).
 */
export function calcularSugerenciaEscaleraSiguienteFecha({
  partidosFechaAnterior,
  modalidad,
  courtsCount = 3,
}: {
  partidosFechaAnterior: any[];
  modalidad: "parejas" | "individual" | string;
  courtsCount?: number;
}): EscaleraSuggestedMatch[] {
  if (!partidosFechaAnterior || partidosFechaAnterior.length === 0) return [];

  // Ordenar los partidos de la fecha anterior de Cancha 1 a Cancha N
  const sortedPrev = [...partidosFechaAnterior].sort((a, b) => {
    const cA = parseInt((a.cancha || "").match(/\d+/)?.[0] || "99", 10);
    const cB = parseInt((b.cancha || "").match(/\d+/)?.[0] || "99", 10);
    return cA - cB;
  });

  const n = Math.min(sortedPrev.length, Math.max(2, Math.min(6, courtsCount)));
  const activeMatches = sortedPrev.slice(0, n);

  const getWinnerLoser = (m: any) => {
    const p1Won = (m.sets_pareja1 || 0) >= (m.sets_pareja2 || 0);
    if (p1Won) {
      return {
        winner: { j1: m.jugador1_id, j2: m.jugador2_id },
        loser: { j1: m.jugador3_id, j2: m.jugador4_id },
      };
    }
    return {
      winner: { j1: m.jugador3_id, j2: m.jugador4_id },
      loser: { j1: m.jugador1_id, j2: m.jugador2_id },
    };
  };

  const resultsByCourt = activeMatches.map((m, idx) => ({
    courtNum: idx + 1,
    ...getWinnerLoser(m),
  }));

  const suggestions: EscaleraSuggestedMatch[] = [];

  for (let i = 0; i < n; i++) {
    const courtNum = i + 1;
    let teamA: { j1: string; j2: string };
    let teamB: { j1: string; j2: string };
    let movA = "";
    let movB = "";

    if (i === 0) {
      // Cancha 1 (Pista Superior): Ganador Cancha 1 (defiende) vs Ganador Cancha 2 (asciende)
      teamA = resultsByCourt[0].winner;
      movA = "Defiende Cancha 1 (Ganador C1)";
      if (n >= 2) {
        teamB = resultsByCourt[1].winner;
        movB = "⬆ Asciende desde Cancha 2 (Ganador C2)";
      } else {
        teamB = resultsByCourt[0].loser;
        movB = "Permanece en Cancha 1";
      }
    } else if (i === n - 1) {
      // Última Cancha (Base): Perdedor Cancha (N-1) (desciende) vs Perdedor Cancha N (permanece)
      teamA = resultsByCourt[i - 1].loser;
      movA = `⬇ Desciende desde Cancha ${i} (Perdedor C${i})`;
      teamB = resultsByCourt[i].loser;
      movB = `Permanece en Cancha ${courtNum} (Perdedor C${courtNum})`;
    } else {
      // Canchas Intermedias (ej. Cancha 2): Perdedor Cancha (i) (desciende) vs Ganador Cancha (i+2) (asciende)
      teamA = resultsByCourt[i - 1].loser;
      movA = `⬇ Desciende desde Cancha ${i} (Perdedor C${i})`;
      teamB = resultsByCourt[i + 1].winner;
      movB = `⬆ Asciende desde Cancha ${i + 2} (Ganador C${i + 2})`;
    }

    const labelNivel =
      courtNum === 1
        ? "Cancha 1: Élite"
        : courtNum === n
        ? `Cancha ${courtNum}: Base`
        : `Cancha ${courtNum}: Desafío`;

    if (modalidad === "individual") {
      // En modalidad individual cruzamos un jugador de cada dupla que sube/baja para rotar compañero
      suggestions.push({
        canchaNumero: courtNum,
        canchaNombre: labelNivel,
        jugador1_id: teamA.j1,
        jugador2_id: teamB.j2,
        jugador3_id: teamB.j1,
        jugador4_id: teamA.j2,
        movimientoA: `${movA} + ${movB}`,
        movimientoB: `Cruce cruzado individual (${movA} / ${movB})`,
      });
    } else {
      suggestions.push({
        canchaNumero: courtNum,
        canchaNombre: labelNivel,
        jugador1_id: teamA.j1,
        jugador2_id: teamA.j2,
        jugador3_id: teamB.j1,
        jugador4_id: teamB.j2,
        movimientoA: movA,
        movimientoB: movB,
      });
    }
  }

  return suggestions;
}

