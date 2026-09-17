interface Match {
  p1: string;
  p2: string;
  p3: string;
  p4: string;
}

function findBestNextDate(players: string[], history: Match[]): Match[] {
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
    addP(m.p1, m.p2);
    addP(m.p3, m.p4);
    addO(m.p1, m.p3); addO(m.p1, m.p4);
    addO(m.p2, m.p3); addO(m.p2, m.p4);
  }

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
  let bestConfig: Match[] | null = null;
  
  for (const part of partitions) {
    const A = part[0];
    const B = part[1];
    const C = part[2];
    const D = part[3];
    
    const ways = [
      [A, B, C, D],
      [A, C, B, D],
      [A, D, B, C]
    ];
    
    for (const w of ways) {
      const m1 = { p1: w[0][0], p2: w[0][1], p3: w[1][0], p4: w[1][1] };
      const m2 = { p1: w[2][0], p2: w[2][1], p3: w[3][0], p4: w[3][1] };
      
      let score = 0;
      
      // Partner penalties (highly penalized if > 0)
      for (const pair of w) {
        const k = [pair[0], pair[1]].sort().join('-');
        const c = partnerCounts[k] || 0;
        score += c * 1000;
      }
      
      // Opponent penalties
      const checkOpp = (m: Match) => {
        const opps = [
          [m.p1, m.p3], [m.p1, m.p4], [m.p2, m.p3], [m.p2, m.p4]
        ];
        for (const pair of opps) {
          const k = [...pair].sort().join('-');
          const c = oppCounts[k] || 0;
          score += c * c;
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
  
  console.log("Best Score:", bestScore);
  return bestConfig!;
}

const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const history = [
  { p1: 'A', p2: 'B', p3: 'C', p4: 'D' }, // Round 1
  { p1: 'E', p2: 'F', p3: 'G', p4: 'H' },
];
console.log(findBestNextDate(players, history));
