// Calcula la distribución de zonas según el reglamento APA:
// - cantidad de zonas = floor(total / 3)
// - resto (0, 1 o 2) → esas zonas se convierten en zonas de 4
//
// Ejemplos:
//  9 → [3, 3, 3]                  (3 zonas, resto 0)
// 10 → [4, 3, 3]                  (3 zonas, resto 1)
// 11 → [4, 4, 3]                  (3 zonas, resto 2)
// 12 → [3, 3, 3, 3]               (4 zonas, resto 0)
// 25 → [4, 3, 3, 3, 3, 3, 3, 3]   (8 zonas, resto 1 → 7 de 3 + 1 de 4)
// 26 → [4, 4, 3, 3, 3, 3, 3, 3]   (8 zonas, resto 2 → 6 de 3 + 2 de 4)
export function calcularDistribucionZonas(totalParejas: number): number[] {
  if (totalParejas < 3) return [];
  const cantidadZonas = Math.floor(totalParejas / 3);
  const resto = totalParejas % 3; // 0, 1 o 2
  const zonas: number[] = Array.from({ length: cantidadZonas }, () => 3);
  for (let i = 0; i < resto; i++) {
    zonas[i] = 4;
  }
  return zonas;
}

export function nombreZona(indice: number): string {
  // A, B, C... Z, luego AA, AB...
  if (indice < 26) return String.fromCharCode(65 + indice);
  const primero = Math.floor(indice / 26) - 1;
  const segundo = indice % 26;
  return String.fromCharCode(65 + primero) + String.fromCharCode(65 + segundo);
}

// Genera el fixture de una zona según su tamaño
// Zona de 3 → 1v2, 2v3, 1v3 (todos vs todos, clasifican 2)
// Zona de 4 → 1v4, 2v3, ganador vs ganador, perdedor vs perdedor (clasifican 3)
export type FixturePartido = {
  orden: number;
  tipo: "directo" | "ganadores" | "perdedores";
  posicion_local: number | null;
  posicion_visitante: number | null;
};

export function generarFixture(tamanio: 3 | 4): FixturePartido[] {
  if (tamanio === 3) {
    return [
      { orden: 1, tipo: "directo", posicion_local: 1, posicion_visitante: 2 },
      { orden: 2, tipo: "directo", posicion_local: 2, posicion_visitante: 3 },
      { orden: 3, tipo: "directo", posicion_local: 1, posicion_visitante: 3 },
    ];
  }
  return [
    { orden: 1, tipo: "directo", posicion_local: 1, posicion_visitante: 4 },
    { orden: 2, tipo: "directo", posicion_local: 2, posicion_visitante: 3 },
    { orden: 3, tipo: "ganadores", posicion_local: null, posicion_visitante: null },
    { orden: 4, tipo: "perdedores", posicion_local: null, posicion_visitante: null },
  ];
}

// Tipo para el cálculo de tabla de posiciones
export type StatsPareja = {
  inscripcion_id: string;
  posicion_siembra: number;
  pj: number; // partidos jugados
  pg: number; // partidos ganados
  pp: number; // partidos perdidos
  puntos: number; // 2 por ganado, 1 por perdido (típico padel)
  setsGanados: number;
  setsPerdidos: number;
  difSets: number;
  gamesAFavor: number;
  gamesEnContra: number;
  difGames: number;
};

export type PartidoConSets = {
  id: string;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  ganador_id: string | null;
  estado: string;
  sets: { numero_set: number; games_local: number; games_visitante: number }[];
};

// Calcula tabla de posiciones de una zona
export function calcularTabla(
  parejas: { inscripcion_id: string; posicion_siembra: number }[],
  partidos: PartidoConSets[],
): StatsPareja[] {
  const stats = new Map<string, StatsPareja>();
  parejas.forEach((p) => {
    stats.set(p.inscripcion_id, {
      inscripcion_id: p.inscripcion_id,
      posicion_siembra: p.posicion_siembra,
      pj: 0,
      pg: 0,
      pp: 0,
      puntos: 0,
      setsGanados: 0,
      setsPerdidos: 0,
      difSets: 0,
      gamesAFavor: 0,
      gamesEnContra: 0,
      difGames: 0,
    });
  });

  partidos.forEach((p) => {
    if (p.estado !== "finalizado" || !p.pareja_local_id || !p.pareja_visitante_id) return;
    const local = stats.get(p.pareja_local_id);
    const visitante = stats.get(p.pareja_visitante_id);
    if (!local || !visitante) return;

    let setsLocal = 0;
    let setsVisitante = 0;
    p.sets.forEach((s) => {
      local.gamesAFavor += s.games_local;
      local.gamesEnContra += s.games_visitante;
      visitante.gamesAFavor += s.games_visitante;
      visitante.gamesEnContra += s.games_local;
      if (s.games_local > s.games_visitante) setsLocal++;
      else if (s.games_visitante > s.games_local) setsVisitante++;
    });

    local.setsGanados += setsLocal;
    local.setsPerdidos += setsVisitante;
    visitante.setsGanados += setsVisitante;
    visitante.setsPerdidos += setsLocal;

    local.pj++;
    visitante.pj++;

    if (p.ganador_id === p.pareja_local_id) {
      local.pg++;
      local.puntos += 2;
      visitante.pp++;
      visitante.puntos += 1;
    } else if (p.ganador_id === p.pareja_visitante_id) {
      visitante.pg++;
      visitante.puntos += 2;
      local.pp++;
      local.puntos += 1;
    }
  });

  // Calcula diferencias
  const arr = Array.from(stats.values()).map((s) => ({
    ...s,
    difSets: s.setsGanados - s.setsPerdidos,
    difGames: s.gamesAFavor - s.gamesEnContra,
  }));

  // Ordena por: puntos, dif sets, dif games, games a favor, head-to-head
  arr.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.difSets !== a.difSets) return b.difSets - a.difSets;
    if (b.difGames !== a.difGames) return b.difGames - a.difGames;
    if (b.gamesAFavor !== a.gamesAFavor) return b.gamesAFavor - a.gamesAFavor;
    // Head-to-head: buscar partido entre ellos
    const partidoDirecto = partidos.find(
      (p) =>
        p.estado === "finalizado" &&
        ((p.pareja_local_id === a.inscripcion_id && p.pareja_visitante_id === b.inscripcion_id) ||
          (p.pareja_local_id === b.inscripcion_id && p.pareja_visitante_id === a.inscripcion_id)),
    );
    if (partidoDirecto?.ganador_id === a.inscripcion_id) return -1;
    if (partidoDirecto?.ganador_id === b.inscripcion_id) return 1;
    return 0;
  });

  return arr;
}
