import { obtenerPlantilla } from '../src/lib/llaves';

async function debug() {
  const p = obtenerPlantilla(33);
  console.log(`obtenerPlantilla(33) returns cantidad: ${p?.cantidad}`);
  if (p) {
      console.log("Matches:");
      p.partidos.filter(m => m.numero <= 15).forEach(m => {
          console.log(`M${m.numero}: ${m.ref_local} vs ${m.ref_visitante}`);
      });
  }
}

debug().catch(console.error);
