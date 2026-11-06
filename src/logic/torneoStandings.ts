/**
 * Lógica compartida para cálculo, ordenamiento y fijación manual de posiciones
 * en Torneos Individuales / Desafíos Semanales y Torneos de Parejas.
 */

export interface StandingItemWithManualPos {
  jugador_id?: string;
  pareja_id?: string;
  posicion_manual?: number | null;
  puntos: number;
  difSets?: number;
  difGames: number;
  apellido?: string;
  nombre?: string;
  jugador1?: { apellido?: string; nombre?: string } | null;
  [key: string]: any;
}

/**
 * Extrae la posición manual fijada en las notas del torneo como capa de persistencia resiliente.
 */
export function extractPosicionManualFromNotas(notas: string | null | undefined, id: string): number | null {
  if (!notas || !id) return null;
  const match = notas.match(new RegExp(`\\[POSICION_MANUAL_${id}:(\\d+)\\]`));
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Añade o remueve la etiqueta [POSICION_MANUAL_id:pos] en el texto de notas del torneo.
 */
export function updatePosicionManualInNotas(notas: string | null | undefined, id: string, pos: number | null): string {
  let currentNotas = (notas || "").trim();
  const regex = new RegExp(`\\[POSICION_MANUAL_${id}:\\d+\\]\\s*`, "g");
  currentNotas = currentNotas.replace(regex, "").trim();

  if (pos !== null && pos > 0) {
    currentNotas = `${currentNotas} [POSICION_MANUAL_${id}:${pos}]`.trim();
  }
  return currentNotas;
}

/**
 * Extrae el podio asignado (1: Oro, 2: Plata, 3: Bronce) fijado en notas como capa resiliente.
 */
export function extractPodioFinalFromNotas(notas: string | null | undefined, id: string): number | null {
  if (!notas || !id) return null;
  const match = notas.match(new RegExp(`\\[PODIO_FINAL_${id}:([123])\\]`));
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Añade o remueve la etiqueta [PODIO_FINAL_id:podio] en el texto de notas del torneo.
 */
export function updatePodioFinalInNotas(notas: string | null | undefined, id: string, podio: number | null): string {
  let currentNotas = (notas || "").trim();
  const regex = new RegExp(`\\[PODIO_FINAL_${id}:[123]\\]\\s*`, "g");
  currentNotas = currentNotas.replace(regex, "").trim();

  if (podio !== null && (podio === 1 || podio === 2 || podio === 3)) {
    currentNotas = `${currentNotas} [PODIO_FINAL_${id}:${podio}]`.trim();
  }
  return currentNotas;
}

/**
 * Extrae la foto asociada a un partido fijada en notas como capa de persistencia resiliente.
 */
export function extractFotoFromNotas(notas: string | null | undefined, matchId: string): string | null {
  if (!notas || !matchId) return null;
  const match = notas.match(new RegExp(`\\[FOTO_${matchId}:([^\\]]+)\\]`));
  return match && match[1] ? match[1].trim() : null;
}

export type FotoPosition = { x: number; y: number };

export function extractFotoPositionFromNotas(notas: string | null | undefined, matchId: string): FotoPosition | null {
  if (!notas || !matchId) return null;
  const match = notas.match(new RegExp(`\\[FOTO_POS_${matchId}:(\\d{1,3}),(\\d{1,3})\\]`));
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

export function updateFotoPositionInNotas(notas: string | null | undefined, matchId: string, position: FotoPosition): string {
  const regex = new RegExp(`\\[FOTO_POS_${matchId}:\\d{1,3},\\d{1,3}\\]\\s*`, "g");
  const currentNotas = (notas || "").replace(regex, "").trim();
  const x = Math.max(0, Math.min(100, Math.round(position.x)));
  const y = Math.max(0, Math.min(100, Math.round(position.y)));
  return `${currentNotas} [FOTO_POS_${matchId}:${x},${y}]`.trim();
}

/**
 * Añade o remueve la etiqueta [FOTO_matchId:url] en el texto de notas del torneo.
 */
export function updateFotoInNotas(notas: string | null | undefined, matchId: string, fotoUrl: string | null): string {
  let currentNotas = (notas || "").trim();
  const regex = new RegExp(`\\[FOTO_${matchId}:[^\\]]+\\]\\s*`, "g");
  currentNotas = currentNotas.replace(regex, "").trim();

  if (fotoUrl && fotoUrl.trim().length > 0) {
    currentNotas = `${currentNotas} [FOTO_${matchId}:${fotoUrl.trim()}]`.trim();
  }
  return currentNotas;
}

/**
 * Aplica el ordenamiento de posiciones combinando las posiciones manuales forzadas
 * con el orden matemático habitual de los participantes sin posición fija.
 * 
 * - Los participantes con `posicion_manual` ocupan prioritariamente la casilla solicitada (1-indexed).
 * - Los participantes sin posición manual rellenan las casillas vacías restantes en estricto orden matemático
 *   (puntos, diferencia de sets, diferencia de games, desempate alfabético).
 */
export function applyManualPositions<T extends StandingItemWithManualPos>(
  items: T[],
  defaultSorter: (a: T, b: T) => number
): (T & { rank_calculado: number; posicion_manual?: number | null })[] {
  if (!items || items.length === 0) return [];

  // Separar forzados y no forzados
  const forcedItems = items.filter((item) => typeof item.posicion_manual === "number" && item.posicion_manual > 0);
  const unforcedItems = items.filter((item) => !item.posicion_manual || item.posicion_manual <= 0);

  // Ordenar no forzados según la regla matemática habitual
  unforcedItems.sort(defaultSorter);

  // Ordenar forzados por la posición asignada de menor a mayor
  forcedItems.sort((a, b) => (a.posicion_manual as number) - (b.posicion_manual as number));

  const total = items.length;
  const slots: (T | null)[] = new Array(total).fill(null);

  // Colocar elementos forzados en su casilla (1-indexed -> 0-indexed)
  forcedItems.forEach((item) => {
    let targetIdx = (item.posicion_manual as number) - 1;
    if (targetIdx < 0) targetIdx = 0;
    if (targetIdx >= total) targetIdx = total - 1;

    // Si la casilla ya está ocupada por otra posición manual idéntica, buscar la más cercana libre
    if (slots[targetIdx] !== null) {
      let foundIdx = -1;
      for (let i = targetIdx + 1; i < total; i++) {
        if (slots[i] === null) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx === -1) {
        for (let i = targetIdx - 1; i >= 0; i--) {
          if (slots[i] === null) {
            foundIdx = i;
            break;
          }
        }
      }
      if (foundIdx !== -1) {
        targetIdx = foundIdx;
      }
    }

    slots[targetIdx] = item;
  });

  // Rellenar las casillas vacías con los jugadores no forzados en su orden matemático
  let unforcedIdx = 0;
  for (let i = 0; i < total; i++) {
    if (slots[i] === null && unforcedIdx < unforcedItems.length) {
      slots[i] = unforcedItems[unforcedIdx++];
    }
  }

  // Si sobrara alguno por desborde
  while (unforcedIdx < unforcedItems.length) {
    slots.push(unforcedItems[unforcedIdx++]);
  }

  return (slots.filter(Boolean) as T[]).map((item, idx) => ({
    ...item,
    rank_calculado: idx + 1,
  }));
}

/**
 * Detecta si un torneo pertenece a la modalidad "Liga de Parejas (Ida y Vuelta + Super Day)".
 */
export function isLigaParejasTournament(
  torneo: any,
  sistemaPuntuacion?: string
): boolean {
  if (!torneo) return false;
  return Boolean(
    torneo.modalidad === "liga_parejas" ||
    sistemaPuntuacion === "liga_parejas" ||
    torneo.sistema_puntuacion === "liga_parejas" ||
    torneo.notas?.includes("[SISTEMA:liga_parejas]")
  );
}

/**
 * Extrae si un partido tuvo Walkover (W.O.) y qué pareja fue la infractora (1 o 2).
 */
export function extractWOFromNotas(
  notas: string | null | undefined,
  partidoId: string
): 1 | 2 | null {
  if (!notas || !partidoId) return null;
  const match = notas.match(new RegExp(`\\[WO_${partidoId}:([12])\\]`));
  if (match && match[1]) {
    return parseInt(match[1], 10) as 1 | 2;
  }
  return null;
}

/**
 * Actualiza o remueve la etiqueta [WO_partidoId:team] en las notas del torneo.
 */
export function updateWOInNotas(
  notas: string | null | undefined,
  partidoId: string,
  woTeam: 1 | 2 | null
): string {
  let currentNotas = (notas || "").trim();
  const regex = new RegExp(`\\[WO_${partidoId}:[12]\\]\\s*`, "g");
  currentNotas = currentNotas.replace(regex, "").trim();

  if (woTeam === 1 || woTeam === 2) {
    currentNotas = `${currentNotas} [WO_${partidoId}:${woTeam}]`.trim();
  }
  return currentNotas;
}

/**
 * Criterio de desempate oficial de Liga de Parejas:
 * 1) Puntos totales
 * 2) Enfrentamiento directo (Head-to-Head)
 * 3) Diferencia de sets
 * 4) Diferencia de games
 * 5) Games a favor o alfabético
 */
export function compareLigaParejasStandings(a: any, b: any, matches: any[] = []): number {
  // 1. Puntos Totales
  if (b.puntos !== a.puntos) {
    return b.puntos - a.puntos;
  }

  // 2. Enfrentamiento directo (Head-to-head)
  if (matches && matches.length > 0) {
    // Buscar enfrentamientos entre a y b
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

    if (directMatches.length > 0) {
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

      // Si uno ganó más partidos directos que el otro
      if (aWins !== bWins) {
        return bWins - aWins;
      }

      // Si empataron en victorias directas (ej: 1 victoria c/u), comparar sets directos
      if (aSetsH2H !== bSetsH2H) {
        return bSetsH2H - aSetsH2H;
      }

      // Comparar games directos
      if (aGamesH2H !== bGamesH2H) {
        return bGamesH2H - aGamesH2H;
      }
    }
  }

  // 3. Diferencia de sets general
  const difSetsA = typeof a.difSets === "number" ? a.difSets : (a.setsGanados || 0) - (a.setsPerdidos || 0);
  const difSetsB = typeof b.difSets === "number" ? b.difSets : (b.setsGanados || 0) - (b.setsPerdidos || 0);
  if (difSetsB !== difSetsA) {
    return difSetsB - difSetsA;
  }

  // 4. Diferencia de games general
  const difGamesA = typeof a.difGames === "number" ? a.difGames : (a.gamesGanados || 0) - (a.gamesPerdidos || 0);
  const difGamesB = typeof b.difGames === "number" ? b.difGames : (b.gamesGanados || 0) - (b.gamesPerdidos || 0);
  if (difGamesB !== difGamesA) {
    return difGamesB - difGamesA;
  }

  // 5. Mayor cantidad de games a favor
  if ((b.gamesGanados || 0) !== (a.gamesGanados || 0)) {
    return (b.gamesGanados || 0) - (a.gamesGanados || 0);
  }

  // Desempate alfabético
  const nameA = a.jugador1?.apellido ? `${a.jugador1.apellido} ${a.jugador1.nombre}` : a.pareja_id || "";
  const nameB = b.jugador1?.apellido ? `${b.jugador1.apellido} ${b.jugador1.nombre}` : b.pareja_id || "";
  return nameA.localeCompare(nameB);
}

/**
 * Tabla Berger oficial para 6 parejas (10 Fechas: 5 de Ida + 5 de Vuelta).
 * Retorna los pares de índices [pA, pB] para cada fecha (1 a 10) y cada cancha (1 a 3).
 */
export const LIGA_6_PAREJAS_SCHEDULE: { fecha: number; canchas: [number, number][] }[] = [
  // Ida
  { fecha: 1, canchas: [[0, 5], [1, 4], [2, 3]] },
  { fecha: 2, canchas: [[0, 4], [5, 3], [1, 2]] },
  { fecha: 3, canchas: [[0, 3], [4, 2], [5, 1]] },
  { fecha: 4, canchas: [[0, 2], [3, 1], [4, 5]] },
  { fecha: 5, canchas: [[0, 1], [2, 5], [3, 4]] },
  // Vuelta
  { fecha: 6, canchas: [[5, 0], [4, 1], [3, 2]] },
  { fecha: 7, canchas: [[4, 0], [3, 5], [2, 1]] },
  { fecha: 8, canchas: [[3, 0], [2, 4], [1, 5]] },
  { fecha: 9, canchas: [[2, 0], [1, 3], [5, 4]] },
  { fecha: 10, canchas: [[1, 0], [5, 2], [4, 3]] },
];

/**
 * Tabla Berger oficial para 8 parejas (14 Fechas: 7 de Ida + 7 de Vuelta).
 * Retorna los pares de índices [pA, pB] para cada fecha (1 a 14) y cada cancha (1 a 4).
 */
export const LIGA_8_PAREJAS_SCHEDULE: { fecha: number; canchas: [number, number][] }[] = [
  // Ida (Fechas 1 a 7)
  { fecha: 1, canchas: [[0, 7], [1, 6], [2, 5], [3, 4]] },
  { fecha: 2, canchas: [[0, 6], [7, 5], [1, 4], [2, 3]] },
  { fecha: 3, canchas: [[0, 5], [6, 4], [7, 3], [1, 2]] },
  { fecha: 4, canchas: [[0, 4], [5, 3], [6, 2], [7, 1]] },
  { fecha: 5, canchas: [[0, 3], [4, 2], [5, 1], [6, 7]] },
  { fecha: 6, canchas: [[0, 2], [3, 1], [4, 7], [5, 6]] },
  { fecha: 7, canchas: [[0, 1], [2, 7], [3, 6], [4, 5]] },
  // Vuelta (Fechas 8 a 14)
  { fecha: 8, canchas: [[7, 0], [6, 1], [5, 2], [4, 3]] },
  { fecha: 9, canchas: [[6, 0], [5, 7], [4, 1], [3, 2]] },
  { fecha: 10, canchas: [[5, 0], [4, 6], [3, 7], [2, 1]] },
  { fecha: 11, canchas: [[4, 0], [3, 5], [2, 6], [1, 7]] },
  { fecha: 12, canchas: [[3, 0], [2, 4], [1, 5], [7, 6]] },
  { fecha: 13, canchas: [[2, 0], [1, 3], [7, 4], [6, 5]] },
  { fecha: 14, canchas: [[1, 0], [7, 2], [6, 3], [5, 4]] },
];

/**
 * Genera la estructura de partidos de una fecha regular para Liga de Parejas
 * (soporta 6 parejas / 3 canchas / 10 fechas y 8 parejas / 4 canchas / 14 fechas).
 */
export function getLigaParejasMatchupsForFecha(
  fechaNum: number,
  parejas: { id: string; jugador1_id: string; jugador2_id: string }[]
): { cancha: string; jugador1_id: string; jugador2_id: string; jugador3_id: string; jugador4_id: string }[] {
  const is8Parejas = parejas.length >= 8;
  const maxFecha = is8Parejas ? 14 : 10;
  if (parejas.length < 6 || fechaNum < 1 || fechaNum > maxFecha) return [];
  const schedule = is8Parejas ? LIGA_8_PAREJAS_SCHEDULE : LIGA_6_PAREJAS_SCHEDULE;
  const scheduleItem = schedule.find((s) => s.fecha === fechaNum);
  if (!scheduleItem) return [];

  return scheduleItem.canchas.map(([idxA, idxB], courtIdx) => {
    const pA = parejas[idxA];
    const pB = parejas[idxB];
    return {
      cancha: `Cancha ${courtIdx + 1}`,
      jugador1_id: pA.jugador1_id,
      jugador2_id: pA.jugador2_id,
      jugador3_id: pB.jugador1_id,
      jugador4_id: pB.jugador2_id,
    };
  });
}

/**
 * Genera los cruces oficiales para el Super Day (3 canchas para 6 parejas o 4 canchas para 8 parejas):
 * - Cancha 1: 1° vs 2° (Gran Final)
 * - Cancha 2: 3° vs 4° (Duelo por el Podio)
 * - Cancha 3: 5° vs 6° (Permanencia / Copa Plata)
 * - Cancha 4 (si hay 8 parejas): 7° vs 8° (Permanencia)
 */
export function getSuperDayMatchups(
  sortedParejas: { id?: string; jugador1_id: string; jugador2_id: string }[]
): { cancha: string; jugador1_id: string; jugador2_id: string; jugador3_id: string; jugador4_id: string }[] {
  if (sortedParejas.length < 6) return [];

  const p1 = sortedParejas[0];
  const p2 = sortedParejas[1];
  const p3 = sortedParejas[2];
  const p4 = sortedParejas[3];
  const p5 = sortedParejas[4];
  const p6 = sortedParejas[5];

  const baseMatches = [
    {
      cancha: "Cancha 1: Gran Final (1° vs 2°)",
      jugador1_id: p1.jugador1_id,
      jugador2_id: p1.jugador2_id,
      jugador3_id: p2.jugador1_id,
      jugador4_id: p2.jugador2_id,
    },
    {
      cancha: "Cancha 2: Duelo por el Podio (3° vs 4°)",
      jugador1_id: p3.jugador1_id,
      jugador2_id: p3.jugador2_id,
      jugador3_id: p4.jugador1_id,
      jugador4_id: p4.jugador2_id,
    },
    {
      cancha: sortedParejas.length >= 8 ? "Cancha 3: Copa Plata (5° vs 6°)" : "Cancha 3: Permanencia (5° vs 6°)",
      jugador1_id: p5.jugador1_id,
      jugador2_id: p5.jugador2_id,
      jugador3_id: p6.jugador1_id,
      jugador4_id: p6.jugador2_id,
    },
  ];

  if (sortedParejas.length >= 8) {
    const p7 = sortedParejas[6];
    const p8 = sortedParejas[7];
    baseMatches.push({
      cancha: "Cancha 4: Permanencia (7° vs 8°)",
      jugador1_id: p7.jugador1_id,
      jugador2_id: p7.jugador2_id,
      jugador3_id: p8.jugador1_id,
      jugador4_id: p8.jugador2_id,
    });
  }

  return baseMatches;
}

const INACTIVE_PLAYER_STATES = new Set([
  "inactivo",
  "inactiva",
  "baja",
  "eliminado",
  "eliminada",
  "reemplazado",
  "reemplazada",
]);

/**
 * Filtra únicamente jugadoras/es activos y elimina cualquier duplicado por `jugador_id`.
 */
export function filterActiveTorneoJugadores<
  T extends { jugador_id?: string | null; estado?: string | null; activo?: boolean | null }
>(inscriptos: T[] | null | undefined): T[] {
  if (!Array.isArray(inscriptos)) return [];
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of inscriptos) {
    const jId = item?.jugador_id?.trim();
    if (!jId || seen.has(jId)) continue;
    if (item.activo === false) continue;
    const estadoNorm = (item.estado || "").trim().toLowerCase();
    if (estadoNorm && INACTIVE_PLAYER_STATES.has(estadoNorm)) continue;
    seen.add(jId);
    result.push(item);
  }

  return result;
}

/**
 * Determina la cantidad de canchas del torneo respetando la configuración explícita (`canchas_count`, de 2 a 6 canchas).
 * Mantiene el candado de 3 canchas únicamente para el torneo histórico 7ma Damas (1a7f0618-f3aa-4b2f-90a8-e9887ca4a3a6).
 */
export function resolveTorneoCourtsCount(
  torneo: any,
  activePlayersCount?: number,
  parejasCount?: number
): number {
  if (!torneo) return 3;
  // Candado específico para el torneo 7ma Damas individual de 12 jugadoras donde la vista TV alteró canchas_count
  if (torneo.id === "1a7f0618-f3aa-4b2f-90a8-e9887ca4a3a6") {
    return 3;
  }

  const configured = Number(torneo.canchas_count);
  if (Number.isFinite(configured) && configured >= 2 && configured <= 6) {
    return Math.round(configured);
  }

  if (typeof parejasCount === "number" && parejasCount >= 4) {
    return Math.max(2, Math.min(6, Math.ceil(parejasCount / 2)));
  }

  if (typeof activePlayersCount === "number" && activePlayersCount >= 8) {
    return Math.max(2, Math.min(6, Math.ceil(activePlayersCount / 4)));
  }

  const raw = Number(torneo.canchas_disponibles ?? 3);
  if (isNaN(raw) || raw < 2) return 3;
  return Math.max(2, Math.min(6, Math.round(raw)));
}

/**
 * Determina si el torneo utiliza el sistema de puntos por set (Americano 2 canchas / 8 jugadores)
 * evitando falsos positivos cuando `canchas_count` fue modificado por la vista de TV en torneos de 12 jugadoras.
 */
export function isPuntosPorSetTournament(
  torneo: any,
  sistemaPuntuacion?: string | null,
  activePlayersCount?: number
): boolean {
  if (!torneo) return false;
  if (isLigaParejasTournament(torneo, sistemaPuntuacion)) return false;
  if (
    sistemaPuntuacion === "puntos_por_set" ||
    torneo?.sistema_puntuacion === "puntos_por_set" ||
    torneo?.notas?.includes("[SISTEMA:puntos_por_set]")
  ) {
    return true;
  }
  if ((activePlayersCount ?? 0) >= 12 || Number(torneo?.canchas_disponibles) === 3) {
    return false;
  }
  return Number(torneo?.canchas_count) === 2;
}


