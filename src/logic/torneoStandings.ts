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
