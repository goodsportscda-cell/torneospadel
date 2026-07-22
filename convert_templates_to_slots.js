import { obtenerPlantilla, parseRef } from './src/lib/llaves.ts';

function templateToSlots(partidos) {
  // Find N from the round matches
  const diecis = partidos.filter(p => p.ronda === 'dieciseisavos');
  const octavos = partidos.filter(p => p.ronda === 'octavos');
  const cuartos = partidos.filter(p => p.ronda === 'cuartos');
  const semis = partidos.filter(p => p.ronda === 'semifinal');
  
  let N = 4;
  let firstRound = [];
  let cfg = null;
  
  if (diecis.length > 0) {
    N = 32;
    firstRound = diecis;
    cfg = { name: 'dieciseisavos', count: 16, startNum: 33 };
  } else if (octavos.length > 0) {
    N = 16;
    firstRound = octavos;
    cfg = { name: 'octavos', count: 8, startNum: 49 };
  } else if (cuartos.length > 0) {
    N = 8;
    firstRound = cuartos;
    cfg = { name: 'cuartos', count: 4, startNum: 57 };
  } else {
    N = 4;
    firstRound = semis;
    cfg = { name: 'semifinal', count: 2, startNum: 61 };
  }
  
  // Reconstruct the N slots
  const slots = Array(N).fill('BYE');
  
  // The second round matches (or first round matches) help us place them.
  // Let's build the tree backwards!
  // In the final round config:
  const roundConfig = {
    32: [
      { name: "dieciseisavos", count: 16, startNum: 33 },
      { name: "octavos", count: 8, startNum: 49 }
    ],
    16: [
      { name: "octavos", count: 8, startNum: 49 }
    ],
    8: [
      { name: "cuartos", count: 4, startNum: 57 }
    ],
    4: [
      { name: "semifinal", count: 2, startNum: 61 }
    ]
  }[N];
  
  // Let's map each match number to its refs in the template
  const matchMap = new Map();
  partidos.forEach(p => {
    matchMap.set(p.numero, p);
  });
  
  // We want to fill the slots [0...N-1].
  // Each slot pair (2*i, 2*i+1) corresponds to first round match: (cfg.startNum + i).
  // If (cfg.startNum + i) exists in partidos:
  //   slots[2*i] = match.ref_local
  //   slots[2*i+1] = match.ref_visitante
  // If it does NOT exist, it means this was a BYE slot in the first round!
  // The winner of this slot pair goes directly to the next round.
  // Let's trace which next round match references G:(cfg.startNum + i) or references a direct seed!
  // In the next round (say, octavos for N=32, which is startNum 49 to 56):
  // Each match (49 + j) corresponds to two slots in the next round:
  // - local: can be G:(33 + 2*j) or a direct seed (e.g. "1°A")
  // - visitante: can be G:(33 + 2*j + 1) or a direct seed
  // So:
  // - For the local slot of next-round match (49 + j):
  //   If it is a direct seed (like "1°A"), it means the first round match (33 + 2*j) was a BYE,
  //   so slots[2*(2*j)] = seed, slots[2*(2*j) + 1] = "BYE" (or vice-versa).
  // - For the visitante slot of next-round match:
  //   If it is a direct seed, the first round match was a BYE.
  
  if (N === 32) {
    for (let j = 0; j < 8; j++) {
      const nextMatch = matchMap.get(49 + j);
      if (!nextMatch) continue;
      
      // Local slot of octavos match (49 + j) corresponds to first-round match (33 + 2*j)
      const localRef = nextMatch.ref_local;
      const mLocalNum = 33 + 2*j;
      const mLocal = matchMap.get(mLocalNum);
      if (mLocal) {
        slots[2 * (2*j)] = mLocal.ref_local;
        slots[2 * (2*j) + 1] = mLocal.ref_visitante;
      } else {
        // It was a BYE. The seed is localRef.
        slots[2 * (2*j)] = localRef;
        slots[2 * (2*j) + 1] = "BYE";
      }
      
      // Visitante slot corresponds to (33 + 2*j + 1)
      const visiRef = nextMatch.ref_visitante;
      const mVisiNum = 33 + 2*j + 1;
      const mVisi = matchMap.get(mVisiNum);
      if (mVisi) {
        slots[2 * (2*j + 1)] = mVisi.ref_local;
        slots[2 * (2*j + 1) + 1] = mVisi.ref_visitante;
      } else {
        slots[2 * (2*j + 1)] = visiRef;
        slots[2 * (2*j + 1) + 1] = "BYE";
      }
    }
  } else if (N === 16) {
    for (let j = 0; j < 4; j++) {
      const nextMatch = matchMap.get(57 + j); // cuartos
      if (!nextMatch) continue;
      
      const localRef = nextMatch.ref_local;
      const mLocalNum = 49 + 2*j;
      const mLocal = matchMap.get(mLocalNum);
      if (mLocal) {
        slots[2 * (2*j)] = mLocal.ref_local;
        slots[2 * (2*j) + 1] = mLocal.ref_visitante;
      } else {
        slots[2 * (2*j)] = localRef;
        slots[2 * (2*j) + 1] = "BYE";
      }
      
      const visiRef = nextMatch.ref_visitante;
      const mVisiNum = 49 + 2*j + 1;
      const mVisi = matchMap.get(mVisiNum);
      if (mVisi) {
        slots[2 * (2*j + 1)] = mVisi.ref_local;
        slots[2 * (2*j + 1) + 1] = mVisi.ref_visitante;
      } else {
        slots[2 * (2*j + 1)] = visiRef;
        slots[2 * (2*j + 1) + 1] = "BYE";
      }
    }
  } else if (N === 8) {
    for (let j = 0; j < 2; j++) {
      const nextMatch = matchMap.get(61 + j); // semis
      if (!nextMatch) continue;
      
      const localRef = nextMatch.ref_local;
      const mLocalNum = 57 + 2*j;
      const mLocal = matchMap.get(mLocalNum);
      if (mLocal) {
        slots[2 * (2*j)] = mLocal.ref_local;
        slots[2 * (2*j) + 1] = mLocal.ref_visitante;
      } else {
        slots[2 * (2*j)] = localRef;
        slots[2 * (2*j) + 1] = "BYE";
      }
      
      const visiRef = nextMatch.ref_visitante;
      const mVisiNum = 57 + 2*j + 1;
      const mVisi = matchMap.get(mVisiNum);
      if (mVisi) {
        slots[2 * (2*j + 1)] = mVisi.ref_local;
        slots[2 * (2*j + 1) + 1] = mVisi.ref_visitante;
      } else {
        slots[2 * (2*j + 1)] = visiRef;
        slots[2 * (2*j + 1) + 1] = "BYE";
      }
    }
  } else if (N === 4) {
    const finalMatch = matchMap.get(64);
    if (finalMatch) {
      const mLocal = matchMap.get(61);
      if (mLocal) {
        slots[0] = mLocal.ref_local;
        slots[1] = mLocal.ref_visitante;
      } else {
        slots[0] = finalMatch.ref_local;
        slots[1] = "BYE";
      }
      const mVisi = matchMap.get(62);
      if (mVisi) {
        slots[2] = mVisi.ref_local;
        slots[3] = mVisi.ref_visitante;
      } else {
        slots[2] = finalMatch.ref_visitante;
        slots[3] = "BYE";
      }
    }
  }
  
  return slots;
}

console.log("Reconstructed Slots from existing templates:");
for (const size of [6, 8, 12, 14, 16, 18, 21, 23, 24, 25, 26, 28, 30, 36, 41, 42, 47, 48]) {
  const p = obtenerPlantilla(size);
  if (p) {
    const s = templateToSlots(p.partidos);
    console.log(`- ${size}: [${s.map(x => `"${x}"`).join(', ')}]`);
  }
}
