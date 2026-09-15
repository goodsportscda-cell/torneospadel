export interface MatchHistory {
  jugador1_id: string;
  jugador2_id: string;
  jugador3_id: string;
  jugador4_id: string;
}

export interface ProposedMatch {
  cancha: string;
  jugador1_id: string;
  jugador2_id: string;
  jugador3_id: string;
  jugador4_id: string;
}

/**
 * Motor inteligente que lee el historial de partidos y calcula los cruces óptimos para la nueva fecha
 * Minimizando (o evitando al 100%) las repeticiones de parejas y rivales.
 */
export function generateIntelligentAmericanoMatches(
  players: string[],
  history: MatchHistory[]
): ProposedMatch[] {
  if (players.length !== 8) {
    throw new Error("El generador inteligente solo soporta 8 jugadores");
  }

  // Count partner frequencies
  const partnerCounts: Record<string, number> = {};
  const oppCounts: Record<string, number> = {};
  
  for (const m of history) {
    const addP = (a: string, b: string) => {
      const k = [a,b].sort().join('-');
      partnerCounts[k] = (partnerCounts[k] || 0) + 1;
    };
    const addO = (a: string, b: string) => {
      const k = [a,b].sort().join('-');
      oppCounts[k] = (oppCounts[k] || 0) + 1;
    };
    addP(m.jugador1_id, m.jugador2_id);
    addP(m.jugador3_id, m.jugador4_id);
    addO(m.jugador1_id, m.jugador3_id); addO(m.jugador1_id, m.jugador4_id);
    addO(m.jugador2_id, m.jugador3_id); addO(m.jugador2_id, m.jugador4_id);
  }

  // Generate all possible partitions of 8 players into 4 pairs (105 partitions)
  const partitions: string[][][] = [];
  
  function getPartitions(available: string[], current: string[][]) {
    if (available.length === 0) {
      partitions.push([...current]);
      return;
    }
    const first = available[0];
    for (let i = 1; i < available.length; i++) {
      const pair = [first, available[i]];
      const nextAvailable = available.filter(p => p !== first && p !== available[i]);
      current.push(pair);
      getPartitions(nextAvailable, current);
      current.pop();
    }
  }
  
  getPartitions(players, []);
  
  let bestScore = Infinity;
  let bestConfig: MatchHistory[] | null = null;
  
  for (const part of partitions) {
    const A = part[0];
    const B = part[1];
    const C = part[2];
    const D = part[3];
    
    // There are 3 ways to form 2 courts from 4 pairs
    const ways = [
      [A, B, C, D],
      [A, C, B, D],
      [A, D, B, C]
    ];
    
    for (const w of ways) {
      const m1 = { jugador1_id: w[0][0], jugador2_id: w[0][1], jugador3_id: w[1][0], jugador4_id: w[1][1] };
      const m2 = { jugador1_id: w[2][0], jugador2_id: w[2][1], jugador3_id: w[3][0], jugador4_id: w[3][1] };
      
      let score = 0;
      
      // Partner penalties (highly penalized if they already played together)
      for (const pair of w) {
        const k = [pair[0], pair[1]].sort().join('-');
        const c = partnerCounts[k] || 0;
        score += c * 1000; // Unacceptable to repeat partners unless strictly forced
      }
      
      // Opponent penalties
      const checkOpp = (m: MatchHistory) => {
        const opps = [
          [m.jugador1_id, m.jugador3_id], [m.jugador1_id, m.jugador4_id], 
          [m.jugador2_id, m.jugador3_id], [m.jugador2_id, m.jugador4_id]
        ];
        for (const pair of opps) {
          const k = [...pair].sort().join('-');
          const c = oppCounts[k] || 0;
          // In a perfect W(8), players face each other 2 times over 7 matches.
          // We want to keep this uniform.
          score += c * c; // Quadratic penalty for opponents (2 -> 4 penalty)
        }
      };
      checkOpp(m1);
      checkOpp(m2);
      
      if (score < bestScore) {
        bestScore = score;
        bestConfig = [m1, m2];
      }
    }
  }

  if (!bestConfig) {
      throw new Error("No se pudo generar una combinación");
  }

  // Convert to proposed matches
  return [
    {
      cancha: "Cancha 1: Élite",
      ...bestConfig[0]
    },
    {
      cancha: "Cancha 2: Desafío",
      ...bestConfig[1]
    }
  ];
}
