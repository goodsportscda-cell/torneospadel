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

export function generarZonasAuto(
  inscripciones: InscripcionParaZona[],
  franjas: FranjaData[],
  canchasDisponibles: number = 3
): ZonaGenerada[] {
  const total = inscripciones.length;
  if (total < 3) return [];

  // Calcular cantidad de zonas de 3 y de 4
  const remainder = total % 3;
  let zonasDe4 = 0;
  let zonasDe3 = 0;

  if (remainder === 0) {
    zonasDe3 = total / 3;
  } else if (remainder === 1) {
    zonasDe4 = 1;
    zonasDe3 = (total - 4) / 3;
  } else if (remainder === 2) {
    zonasDe4 = 2;
    zonasDe3 = (total - 8) / 3;
  }

  const zonasGeneradas: ZonaGenerada[] = [];
  let inscripcionesPendientes = [...inscripciones];

  const totalZonas = zonasDe3 + zonasDe4;
  let zoneIdx = 0;

  // Mapa de parejas a franjas
  const franjaParejasMap = new Map<string, InscripcionParaZona[]>();
  for (const f of franjas) {
    franjaParejasMap.set(f.id, []);
  }

  for (const insc of inscripcionesPendientes) {
    for (const fid of insc.franjas_ids) {
      if (franjaParejasMap.has(fid)) {
        franjaParejasMap.get(fid)!.push(insc);
      }
    }
  }

  // Ordenar franjas por la que más parejas tiene
  const franjasOrdenadas = [...franjas].sort((a, b) => {
    return franjaParejasMap.get(b.id)!.length - franjaParejasMap.get(a.id)!.length;
  });

  // Intentamos agrupar por franja primero
  for (const f of franjasOrdenadas) {
    if (zoneIdx >= totalZonas) break;
    
    let targetSize = zoneIdx < zonasDe3 ? 3 : 4;
    
    // Obtenemos parejas compatibles que sigan pendientes
    const posibles = (franjaParejasMap.get(f.id) || []).filter(p => 
      inscripcionesPendientes.some(pend => pend.id === p.id)
    );

    if (posibles.length >= targetSize) {
      // Formamos zona
      const zonaParejas = posibles.slice(0, targetSize);
      zonasGeneradas.push({
        nombre: `Zona ${String.fromCharCode(65 + zoneIdx)}`,
        parejas: zonaParejas,
        franjaAsignada: f,
        canchaSugerida: String((zoneIdx % canchasDisponibles) + 1)
      });
      
      // Remover de pendientes
      const asignadosIds = zonaParejas.map(p => p.id);
      inscripcionesPendientes = inscripcionesPendientes.filter(p => !asignadosIds.includes(p.id));
      
      zoneIdx++;
    }
  }

  // Si quedaron zonas sin armar o parejas colgadas, las agrupamos forzadamente
  while (zoneIdx < totalZonas && inscripcionesPendientes.length > 0) {
    let targetSize = zoneIdx < zonasDe3 ? 3 : 4;
    // Por si quedan menos que el targetSize pero hay que armar igual
    if (inscripcionesPendientes.length < targetSize && zoneIdx === totalZonas - 1) {
      targetSize = inscripcionesPendientes.length;
    }
    
    const zonaParejas = inscripcionesPendientes.slice(0, targetSize);
    zonasGeneradas.push({
      nombre: `Zona ${String.fromCharCode(65 + zoneIdx)}`,
      parejas: zonaParejas,
      franjaAsignada: undefined, // Sin franja en común
      canchaSugerida: String((zoneIdx % canchasDisponibles) + 1)
    });
    
    inscripcionesPendientes = inscripcionesPendientes.slice(targetSize);
    zoneIdx++;
  }

  // Si por alguna razón de remanentes quedaron sueltos, meterlos en la última zona
  if (inscripcionesPendientes.length > 0 && zonasGeneradas.length > 0) {
    zonasGeneradas[zonasGeneradas.length - 1].parejas.push(...inscripcionesPendientes);
  }

  return zonasGeneradas;
}
