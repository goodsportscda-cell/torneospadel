import { createClient } from '@supabase/supabase-js';

function generarCuadroGenericoNoSwap(totalParejas: number) {
  const Z = Math.floor(totalParejas / 3);
  const zonesOf4 = totalParejas % 3;
  const getZoneName = (index: number) => {
    let name = "";
    let i = index;
    while (i >= 0) {
      name = String.fromCharCode(65 + (i % 26)) + name;
      i = Math.floor(i / 26) - 1;
    }
    return name;
  };

  const firsts: string[] = [];
  const seconds: string[] = [];
  const thirds: string[] = [];

  for(let i=0; i<Z; i++) {
    const zName = getZoneName(i);
    firsts.push(`1°${zName}`);
    seconds.push(`2°${zName}`);
    if (i < zonesOf4) thirds.push(`3°${zName}`);
  }

  if (seconds.length > 1) {
    const shift = Math.floor(seconds.length / 2);
    const spliced = seconds.splice(0, shift);
    seconds.push(...spliced);
  }
  if (thirds.length > 1) thirds.unshift(thirds.pop()!);

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
            ronda: "previa",
            ref_local: seeds[seedLocal - 1],
            ref_visitante: seeds[seedVisi - 1]
        };
        partidos.push(p);
        currentRefs.push(`G:${p.numero}`);
    }
  }

  let nodesInCurrentRound = N / 2;
  while (nodesInCurrentRound > 1) {
      const nextRefs: string[] = [];
      for (let i = 0; i < nodesInCurrentRound; i += 2) {
          const local = currentRefs[i];
          const visi = currentRefs[i+1];
          if (local === "BYE" && visi === "BYE") nextRefs.push("BYE");
          else if (visi === "BYE") nextRefs.push(local);
          else if (local === "BYE") nextRefs.push(visi);
          else {
              const p = {
                  numero: numPartido++,
                  ronda: "next",
                  ref_local: local,
                  ref_visitante: visi
              };
              partidos.push(p);
              nextRefs.push(`G:${p.numero}`);
          }
      }
      currentRefs = nextRefs;
      nodesInCurrentRound /= 2;
  }

  return partidos;
}

async function debug() {
  console.log("No Swap (33):");
  const p33 = generarCuadroGenericoNoSwap(33);
  p33.filter(m => m.numero <= 15).forEach(m => {
      console.log(`M${m.numero}: ${m.ref_local} vs ${m.ref_visitante}`);
  });
}

debug().catch(console.error);
