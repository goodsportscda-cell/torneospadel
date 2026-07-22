import { parseRef } from './src/lib/llaves.ts';

function buildBracket(slots, totalParejas) {
  const L = slots.length;
  // Determine N (power of 2: 4, 8, 16, 32)
  let N = 4;
  while (N < L) N *= 2;
  
  // Pad slots to length N with BYEs
  const currentSlots = [...slots];
  while (currentSlots.length < N) {
    currentSlots.push("BYE");
  }
  
  console.log(`Building bracket for N = ${N} from slots:`, currentSlots);
  
  const matches = [];
  
  // Official match numbering and round names for N=32
  const roundConfig = {
    32: [
      { name: "dieciseisavos", count: 16, startNum: 33 },
      { name: "octavos", count: 8, startNum: 49 },
      { name: "cuartos", count: 4, startNum: 57 },
      { name: "semifinal", count: 2, startNum: 61 },
      { name: "final", count: 1, startNum: 64 }
    ],
    16: [
      { name: "octavos", count: 8, startNum: 49 },
      { name: "cuartos", count: 4, startNum: 57 },
      { name: "semifinal", count: 2, startNum: 61 },
      { name: "final", count: 1, startNum: 64 }
    ],
    8: [
      { name: "cuartos", count: 4, startNum: 57 },
      { name: "semifinal", count: 2, startNum: 61 },
      { name: "final", count: 1, startNum: 64 }
    ],
    4: [
      { name: "semifinal", count: 2, startNum: 61 },
      { name: "final", count: 1, startNum: 64 }
    ]
  }[N];
  
  let roundSlots = [...currentSlots];
  
  for (const cfg of roundConfig) {
    const nextSlots = [];
    for (let i = 0; i < roundSlots.length; i += 2) {
      const local = roundSlots[i];
      const visi = roundSlots[i + 1];
      
      const localEsBye = local === "BYE" || !local;
      const visiEsBye = visi === "BYE" || !visi;
      
      if (localEsBye && visiEsBye) {
        nextSlots.push("BYE");
      } else if (visiEsBye) {
        nextSlots.push(local);
      } else if (localEsBye) {
        nextSlots.push(visi);
      } else {
        const matchNum = cfg.startNum + (i / 2);
        matches.push({
          numero: matchNum,
          ronda: cfg.name,
          ref_local: local,
          ref_visitante: visi
        });
        nextSlots.push(`G:${matchNum}`);
      }
    }
    roundSlots = nextSlots;
  }
  
  return matches;
}

// Test with 48 couples slots
const slots48 = [
  "1°A", "2°B", "2°O", "1°P", "1°I", "2°J", "2°G", "1°H",
  "1°E", "2°F", "2°K", "1°L", "1°M", "2°N", "2°C", "1°D",
  "1°C", "2°D", "2°M", "1°N", "1°K", "2°L", "2°E", "1°F",
  "1°G", "2°H", "2°I", "1°J", "1°O", "2°P", "2°A", "1°B"
];

console.log("\n48 Couples Bracket:");
const m48 = buildBracket(slots48, 48);
m48.forEach(m => console.log(`Match ${m.numero} (${m.ronda}): ${m.ref_local} vs ${m.ref_visitante}`));
