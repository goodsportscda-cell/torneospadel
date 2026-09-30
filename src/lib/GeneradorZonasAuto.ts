export interface InscripcionParaZona {
  id: string;
  jugador1: { apellido: string; nombre: string };
  jugador2: { apellido: string; nombre: string };
  franjas_ids: string[];
}

export interface FranjaData {
  id: string;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  label_franja: string;
}

export interface ZonaGenerada {
  nombre: string;
  parejas: InscripcionParaZona[];
  franjaAsignada?: FranjaData;
  franjasCompatibles: FranjaData[];
  canchaSugerida?: string;
}

export function findSharedFranjas(parejas: InscripcionParaZona[], franjas: FranjaData[]): FranjaData[] {
  if (parejas.length === 0) return [];
  const sharedIds = parejas[0].franjas_ids.filter((id) => parejas.every((pareja) => pareja.franjas_ids.includes(id)));
  return sharedIds
    .map((id) => franjas.find((franja) => franja.id === id))
    .filter((franja): franja is FranjaData => Boolean(franja))
    .sort((a, b) => a.dia_nombre.localeCompare(b.dia_nombre) || a.hora_inicio.localeCompare(b.hora_inicio));
}

export function findSharedFranja(parejas: InscripcionParaZona[], franjas: FranjaData[]): FranjaData | undefined {
  return findSharedFranjas(parejas, franjas)[0];
}

function getZoneSizes(total: number): number[] {
  const remainder = total % 3;
  const fours = remainder === 1 ? 1 : remainder === 2 ? 2 : 0;
  const threes = (total - fours * 4) / 3;
  return [...Array(fours).fill(4), ...Array(threes).fill(3)];
}

function combinations<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  const selected: T[] = [];
  const visit = (start: number) => {
    if (selected.length === size) {
      result.push([...selected]);
      return;
    }
    const needed = size - selected.length;
    for (let i = start; i <= items.length - needed; i++) {
      selected.push(items[i]);
      visit(i + 1);
      selected.pop();
    }
  };
  visit(0);
  return result;
}

function scoreGroup(group: InscripcionParaZona[], franjas: FranjaData[]): number {
  const compatible = findSharedFranjas(group, franjas);
  const pairOverlap = group.reduce((sum, pareja, index) => {
    return sum + group.slice(index + 1).reduce((pairSum, other) =>
      pairSum + pareja.franjas_ids.filter((id) => other.franjas_ids.includes(id)).length, 0);
  }, 0);
  const availabilityOptions = group.reduce((sum, pareja) => sum + pareja.franjas_ids.length, 0);

  // First maximize a truly shared time, then pairwise overlap, while keeping
  // the least flexible couples together instead of leaving them for last.
  return compatible.length * 10000 + pairOverlap * 100 - availabilityOptions;
}

export function generarZonasAuto(
  inscripciones: InscripcionParaZona[],
  franjas: FranjaData[],
  canchasDisponibles: number | number[] = 3
): ZonaGenerada[] {
  if (inscripciones.length < 3) return [];

  const courtIds = (Array.isArray(canchasDisponibles)
    ? canchasDisponibles
    : Array.from({ length: Math.max(1, canchasDisponibles) }, (_, index) => index + 1)
  ).filter((id, index, all) => Number.isInteger(id) && id > 0 && all.indexOf(id) === index);
  if (courtIds.length === 0) courtIds.push(1);

  const pending = [...inscripciones];
  const zones: ZonaGenerada[] = [];

  for (const targetSize of getZoneSizes(inscripciones.length)) {
    const mostRestricted = [...pending].sort((a, b) => a.franjas_ids.length - b.franjas_ids.length)[0];
    const possibleGroups = combinations(pending, targetSize)
      .filter((group) => group.some((pareja) => pareja.id === mostRestricted?.id));
    possibleGroups.sort((a, b) => scoreGroup(b, franjas) - scoreGroup(a, franjas));

    // When multiple groups have equal availability, preserve input order for
    // predictable zone labels and seeded positions.
    const bestGroup = possibleGroups[0];
    if (!bestGroup) break;

    const compatible = findSharedFranjas(bestGroup, franjas);
    zones.push({
      nombre: `Zona ${String.fromCharCode(65 + zones.length)}`,
      parejas: bestGroup,
      franjasCompatibles: compatible,
      franjaAsignada: compatible[0],
      canchaSugerida: String(courtIds[zones.length % courtIds.length]),
    });

    const assigned = new Set(bestGroup.map((pareja) => pareja.id));
    for (let index = pending.length - 1; index >= 0; index--) {
      if (assigned.has(pending[index].id)) pending.splice(index, 1);
    }
  }

  return zones;
}
