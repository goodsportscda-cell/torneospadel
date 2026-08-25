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
  canchaSugerida?: string;
}

export function findSharedFranja(parejas: InscripcionParaZona[], franjas: FranjaData[]): FranjaData | undefined {
  if (parejas.length === 0) return undefined;

  // 1. Buscar si hay una franja presente en TODAS las parejas del grupo
  const sharedIds = parejas[0].franjas_ids.filter(fid =>
    parejas.every(p => p.franjas_ids.includes(fid))
  );

  if (sharedIds.length > 0) {
    return franjas.find(f => f.id === sharedIds[0]);
  }

  // 2. Si ninguna franja coincide en el 100%, buscar la franja compartida por la MAYORÍA de parejas del grupo
  const countMap = new Map<string, number>();
  parejas.forEach(p => {
    p.franjas_ids.forEach(fid => {
      countMap.set(fid, (countMap.get(fid) || 0) + 1);
    });
  });

  let bestFid = "";
  let maxCount = 0;
  for (const [fid, count] of countMap.entries()) {
    if (count > maxCount) {
      maxCount = count;
      bestFid = fid;
    }
  }

  if (bestFid && maxCount >= 2) {
    return franjas.find(f => f.id === bestFid);
  }

  return undefined;
}

export function generarZonasAuto(
  inscripciones: InscripcionParaZona[],
  franjas: FranjaData[],
  canchasDisponibles: number = 3
): ZonaGenerada[] {
  const total = inscripciones.length;
  if (total < 3) return [];

  // Calcular cantidad de zonas de 4 y de 3 (Reglamento APA: Zonas de 4 PRIMERO)
  const remainder = total % 3;
  let zonasDe4 = 0;
  let zonasDe3 = 0;

  if (remainder === 0) {
    zonasDe3 = total / 3;
  } else if (remainder === 1) {
    zonasDe4 = 1;
    zonasDe3 = Math.floor((total - 4) / 3);
  } else if (remainder === 2) {
    zonasDe4 = 2;
    zonasDe3 = Math.floor((total - 8) / 3);
  }

  // Zonas de 4 PRIMERO, luego Zonas de 3
  const targetSizes: number[] = [
    ...Array(zonasDe4).fill(4),
    ...Array(zonasDe3).fill(3)
  ];

  const zonasGeneradas: ZonaGenerada[] = [];
  let inscripcionesPendientes = [...inscripciones];

  for (let zoneIdx = 0; zoneIdx < targetSizes.length; zoneIdx++) {
    const targetSize = targetSizes[zoneIdx];
    if (inscripcionesPendientes.length === 0) break;

    let bestGroup: InscripcionParaZona[] = [];
    let bestFranja: FranjaData | undefined = undefined;

    // Buscar franjas por popularidad entre las parejas pendientes restantes
    const franjasOrdenadas = [...franjas].sort((a, b) => {
      const countA = inscripcionesPendientes.filter(p => p.franjas_ids.includes(a.id)).length;
      const countB = inscripcionesPendientes.filter(p => p.franjas_ids.includes(b.id)).length;
      return countB - countA;
    });

    for (const f of franjasOrdenadas) {
      const deEstaFranja = inscripcionesPendientes.filter(p => p.franjas_ids.includes(f.id));
      if (deEstaFranja.length >= targetSize) {
        bestGroup = deEstaFranja.slice(0, targetSize);
        bestFranja = f;
        break;
      } else if (deEstaFranja.length > bestGroup.length) {
        bestGroup = deEstaFranja;
        bestFranja = f;
      }
    }

    // Si no se completó el targetSize exacto en una sola franja, completar con parejas pendientes con mayor coincidencia
    if (bestGroup.length < targetSize) {
      const selectedIds = new Set(bestGroup.map(p => p.id));
      const faltantes = inscripcionesPendientes.filter(p => !selectedIds.has(p.id));

      faltantes.sort((a, b) => {
        const scoreA = bestGroup.reduce((sum, bg) => sum + bg.franjas_ids.filter(fid => a.franjas_ids.includes(fid)).length, 0);
        const scoreB = bestGroup.reduce((sum, bg) => sum + bg.franjas_ids.filter(fid => b.franjas_ids.includes(fid)).length, 0);
        return scoreB - scoreA;
      });

      const needed = targetSize - bestGroup.length;
      bestGroup = [...bestGroup, ...faltantes.slice(0, needed)];
    }

    // Determinar la franja compartida o representativa para este grupo de parejas
    const franjaFinal = findSharedFranja(bestGroup, franjas) || bestFranja;
    const nombre = `Zona ${String.fromCharCode(65 + zoneIdx)}`;

    zonasGeneradas.push({
      nombre,
      parejas: bestGroup,
      franjaAsignada: franjaFinal,
      canchaSugerida: String((zoneIdx % canchasDisponibles) + 1),
    });

    const asignadosIds = new Set(bestGroup.map(p => p.id));
    inscripcionesPendientes = inscripcionesPendientes.filter(p => !asignadosIds.has(p.id));
  }

  // Remanente en caso extremo
  if (inscripcionesPendientes.length > 0 && zonasGeneradas.length > 0) {
    const ultimaZona = zonasGeneradas[zonasGeneradas.length - 1];
    ultimaZona.parejas.push(...inscripcionesPendientes);
    ultimaZona.franjaAsignada = findSharedFranja(ultimaZona.parejas, franjas) || ultimaZona.franjaAsignada;
  }

  return zonasGeneradas;
}
