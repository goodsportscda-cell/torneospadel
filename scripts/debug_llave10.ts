import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

function calcularTabla(parejas, partidos) {
  const stats = new Map();
  parejas.forEach((p) => {
    stats.set(p.inscripcion_id, {
      inscripcion_id: p.inscripcion_id,
      posicion_siembra: p.posicion_siembra,
      pj: 0, pg: 0, pp: 0, puntos: 0,
      setsGanados: 0, setsPerdidos: 0, difSets: 0,
      gamesAFavor: 0, gamesEnContra: 0, difGames: 0,
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

async function debug() {
  const t_id = '8b73d288-035e-418a-a013-57053db05b68';
  
  const [{ data: zs }, { data: zp }, { data: pz }, { data: sets }] = await Promise.all([
      supabase.from('zonas').select('*').eq('torneo_id', t_id).order('orden'),
      supabase.from('zonas_parejas').select('*'), // will filter in memory
      supabase.from('partidos_zona').select('*'), // will filter in memory
      supabase.from('sets_partido').select('*')
  ]);
  
  const setsZona = {};
  (sets || []).forEach(s => {
      const key = s.partido_id;
      if (!key) return;
      if (!setsZona[key]) setsZona[key] = [];
      setsZona[key].push({ numero_set: s.numero_set, games_local: s.games_local, games_visitante: s.games_visitante });
  });

  const map = {};
  (zs || []).forEach((z) => {
      const partidosDeEstaZona = (pz || []).filter((p) => p.zona_id === z.id);
      const estaFinalizada =
        partidosDeEstaZona.length > 0 &&
        partidosDeEstaZona.every((p) => p.estado === "finalizado");

      if (estaFinalizada) {
        const parejas = (zp || []).filter((zpf) => zpf.zona_id === z.id);
        const partidos = partidosDeEstaZona.map((p) => ({
          id: p.id,
          tipo: p.tipo,
          pareja_local_id: p.pareja_local_id,
          pareja_visitante_id: p.pareja_visitante_id,
          ganador_id: p.ganador_id,
          estado: p.estado,
          sets: setsZona[p.id] ?? [],
        }));
        
        const tabla = calcularTabla(
          parejas.map((zpf) => ({
            inscripcion_id: zpf.inscripcion_id,
            posicion_siembra: zpf.posicion_siembra,
          })),
          partidos,
        );
        
        const ordenIds = tabla.map((t) => t.inscripcion_id);
        map[z.nombre.trim()] = ordenIds;
      }
  });

  console.log("Calculated Zone J Ranking:");
  console.log(map['J']);
  
  console.log("\nWhat is 0a49c34d-0094-4979-ae70-66039db03d1b?");
  for (const [zName, ids] of Object.entries(map)) {
      const pos = ids.indexOf('0a49c34d-0094-4979-ae70-66039db03d1b');
      if (pos !== -1) {
          console.log(`Found in Zone ${zName} at position ${pos + 1}`);
      }
  }
}

debug().catch(console.error);
