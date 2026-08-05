import { createClient } from '@supabase/supabase-js';

const totalParejas = 33;
const Z = Math.floor(totalParejas / 3);
const zonesOf4 = totalParejas % 3;

function getZoneName(index: number): string {
let name = "";
let i = index;
while (i >= 0) {
  name = String.fromCharCode(65 + (i % 26)) + name;
  i = Math.floor(i / 26) - 1;
}
return name;
}

const firsts: string[] = [];
const seconds: string[] = [];
const thirds: string[] = [];

for(let i=0; i<Z; i++) {
const zName = getZoneName(i);
firsts.push(`1°${zName}`);
seconds.push(`2°${zName}`);
if (i < zonesOf4) {
  thirds.push(`3°${zName}`);
}
}

if (seconds.length > 1) {
const shift = Math.floor(seconds.length / 2);
const spliced = seconds.splice(0, shift);
seconds.push(...spliced);
}
if (thirds.length > 1) {
thirds.unshift(thirds.pop()!);
}

const seeds = [...firsts, ...seconds, ...thirds];
const Q = seeds.length;

let N = 2;
while (N < Q) N *= 2;

let rounds = [1, 2];
for (let i = 4; i <= N; i *= 2) {
  let nextRounds = [];
  for (let j = 0; j < rounds.length; j++) {
      nextRounds.push(rounds[j]);
      nextRounds.push(i + 1 - rounds[j]);
  }
  rounds = nextRounds;
}

const partidos = [];
let numPartido = 1;
let currentRefs: string[] = [];

const standardRoundNames = ["final", "semifinal", "cuartos", "octavos", "dieciseisavos", "previa"];
let numRounds = Math.log2(N);
let currentLevelRoundNameIndex = numRounds - 1;

for (let i = 0; i < N; i += 2) {
const seedLocal = rounds[i];
const seedVisi = rounds[i+1];

const localEsBye = seedLocal > Q;
const visiEsBye = seedVisi > Q;

if (localEsBye && visiEsBye) {
    currentRefs.push("BYE");
} else if (visiEsBye) {
    currentRefs.push(seeds[seedLocal - 1]);
} else if (localEsBye) {
    currentRefs.push(seeds[seedVisi - 1]);
} else {
    const p = {
        numero: numPartido++,
        ronda: standardRoundNames[currentLevelRoundNameIndex] || "previa",
        ref_local: seeds[seedLocal - 1],
        ref_visitante: seeds[seedVisi - 1]
    };
    partidos.push(p);
    currentRefs.push(`G:${p.numero}`);
}
}

const firstRoundMatches = partidos.filter(p => !p.ref_local.startsWith("G:") && !p.ref_visitante.startsWith("G:"));
for (let i = 0; i < firstRoundMatches.length; i++) {
 const p = firstRoundMatches[i];
 if (p.ref_local !== "BYE" && p.ref_visitante !== "BYE") {
     const localZone = p.ref_local.match(/°([A-Z]+)/)?.[1];
     const visiZone = p.ref_visitante.match(/°([A-Z]+)/)?.[1];
     if (localZone && visiZone && localZone === visiZone) {
         for (let j = 0; j < firstRoundMatches.length; j++) {
             if (i === j) continue;
             const p2 = firstRoundMatches[j];
             if (p2.ref_local !== "BYE" && p2.ref_visitante !== "BYE") {
                 const l2Zone = p2.ref_local.match(/°([A-Z]+)/)?.[1];
                 const v2Zone = p2.ref_visitante.match(/°([A-Z]+)/)?.[1];
                 if (localZone !== v2Zone && l2Zone !== visiZone) {
                     const temp = p.ref_visitante;
                     p.ref_visitante = p2.ref_visitante;
                     p2.ref_visitante = temp;
                     break;
                 }
             }
         }
     }
 }
}

let nodesInCurrentRound = N / 2;
currentLevelRoundNameIndex--;

while (nodesInCurrentRound > 1) {
  const nextRefs: string[] = [];
  const rondaActual = standardRoundNames[currentLevelRoundNameIndex] || "previa";
  
  for (let i = 0; i < nodesInCurrentRound; i += 2) {
      const local = currentRefs[i];
      const visi = currentRefs[i+1];
      
      if (local === "BYE" && visi === "BYE") {
          nextRefs.push("BYE");
      } else if (visi === "BYE") {
          nextRefs.push(local);
      } else if (local === "BYE") {
          nextRefs.push(visi);
      } else {
          const p = {
              numero: numPartido++,
              ronda: rondaActual,
              ref_local: local,
              ref_visitante: visi
          };
          partidos.push(p);
          nextRefs.push(`G:${p.numero}`);
      }
  }
  currentRefs = nextRefs;
  nodesInCurrentRound /= 2;
  currentLevelRoundNameIndex--;
}

console.log("Seeds:", seeds);
console.log("Rounds:", rounds);
const match13 = partidos.find(p => p.numero === 13);
console.log("Match 13 in script:", match13);

const matchWith1J = partidos.find(p => p.ref_local === '1°J' || p.ref_visitante === '1°J');
console.log("Match with 1J:", matchWith1J);

// And wait, if in database Match 13 is ref_local=1°G, ref_visitante=1°J
// Let's see if 1°J was originally somewhere else and got swapped!
console.log("All partods:", partidos.filter(p => p.numero >= 1 && p.numero <= 16));
