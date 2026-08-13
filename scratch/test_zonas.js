const fs = require('fs');

// We need to simulate the objects.
const parejas = [
  { inscripcion_id: "id1", posicion_siembra: 1 },
  { inscripcion_id: "id2", posicion_siembra: 2 },
  { inscripcion_id: "id3", posicion_siembra: 3 },
  { inscripcion_id: "id4", posicion_siembra: 4 }
];

const partidos = [
  {
    id: "m1",
    tipo: "directo",
    pareja_local_id: "id1",
    pareja_visitante_id: "id4",
    ganador_id: "id1",
    estado: "finalizado",
    sets: [{ numero_set: 1, games_local: 6, games_visitante: 0 }]
  },
  {
    id: "m2",
    tipo: "directo",
    pareja_local_id: "id2",
    pareja_visitante_id: "id3",
    ganador_id: "id2",
    estado: "finalizado",
    sets: [{ numero_set: 1, games_local: 6, games_visitante: 0 }]
  },
  {
    id: "m3",
    tipo: "ganadores",
    pareja_local_id: "id1",
    pareja_visitante_id: "id2",
    ganador_id: "id1",
    estado: "finalizado",
    sets: [{ numero_set: 1, games_local: 6, games_visitante: 0 }]
  },
  {
    id: "m4",
    tipo: "perdedores",
    pareja_local_id: "id4",
    pareja_visitante_id: "id3",
    ganador_id: "id4",
    estado: "finalizado",
    sets: [{ numero_set: 1, games_local: 6, games_visitante: 0 }]
  }
];

function calcularTabla(parejas, partidos) {
  const stats = new Map();
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

  const arr = Array.from(stats.values()).map((s) => ({
    ...s,
    difSets: s.setsGanados - s.setsPerdidos,
    difGames: s.gamesAFavor - s.gamesEnContra,
  }));

  const ganadorMatch = partidos.find((p) => p.tipo === "ganadores");
  const perdedoresMatch = partidos.find((p) => p.tipo === "perdedores");

  if (ganadorMatch?.ganador_id && perdedoresMatch?.ganador_id) {
    const g1 = ganadorMatch.ganador_id; 
    const g2 = ganadorMatch.pareja_local_id === g1
      ? ganadorMatch.pareja_visitante_id
      : ganadorMatch.pareja_local_id; 
    const g3 = perdedoresMatch.ganador_id; 
    const g4 = perdedoresMatch.pareja_local_id === g3
      ? perdedoresMatch.pareja_visitante_id
      : perdedoresMatch.pareja_local_id; 

    const bracketRank = new Map();
    if (g1) bracketRank.set(g1, 1);
    if (g2) bracketRank.set(g2, 2);
    if (g3) bracketRank.set(g3, 3);
    if (g4) bracketRank.set(g4, 4);

    arr.sort((a, b) => {
      const rankA = bracketRank.get(a.inscripcion_id) ?? 99;
      const rankB = bracketRank.get(b.inscripcion_id) ?? 99;
      return rankA - rankB;
    });

    return arr;
  }

  const bracketTier = new Map();
  partidos.forEach((p) => {
    if (p.tipo === "ganadores") {
      if (p.pareja_local_id) bracketTier.set(p.pareja_local_id, 1);
      if (p.pareja_visitante_id) bracketTier.set(p.pareja_visitante_id, 1);
    } else if (p.tipo === "perdedores") {
      if (p.pareja_local_id) bracketTier.set(p.pareja_local_id, 2);
      if (p.pareja_visitante_id) bracketTier.set(p.pareja_visitante_id, 2);
    }
  });

  arr.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;

    const tierA = bracketTier.get(a.inscripcion_id) || 3;
    const tierB = bracketTier.get(b.inscripcion_id) || 3;
    if (tierA !== tierB) return tierA - tierB;

    if (b.difSets !== a.difSets) return b.difSets - a.difSets;
    if (b.difGames !== a.difGames) return b.difGames - a.difGames;
    if (b.gamesAFavor !== a.gamesAFavor) return b.gamesAFavor - a.gamesAFavor;

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

console.log(calcularTabla(parejas, partidos));
