import { obtenerPlantilla, parseRef, CASOS_SOPORTADOS } from './src/lib/llaves.ts';

console.log("Testing parseRef on all templates:");
let errorsCount = 0;
for (const size of CASOS_SOPORTADOS) {
  const plantilla = obtenerPlantilla(size);
  if (!plantilla) continue;
  
  for (const p of plantilla.partidos) {
    const localParsed = parseRef(p.ref_local);
    const visitParsed = parseRef(p.ref_visitante);
    
    if (localParsed.tipo === 'manual') {
      console.log(`[Error] Size ${size}, Match ${p.numero}: ref_local "${p.ref_local}" parsed as manual!`);
      errorsCount++;
    }
    if (visitParsed.tipo === 'manual') {
      console.log(`[Error] Size ${size}, Match ${p.numero}: ref_visitante "${p.ref_visitante}" parsed as manual!`);
      errorsCount++;
    }
  }
}
console.log(`Testing completed. Total parsing errors: ${errorsCount}`);
