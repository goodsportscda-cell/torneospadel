import { generarCuadroGenerico } from '../src/lib/llaves';

async function debug() {
  console.log("generarCuadroGenerico(32):");
  const p32 = generarCuadroGenerico(32);
  p32.filter(m => m.numero <= 15).forEach(m => {
      console.log(`M${m.numero}: ${m.ref_local} vs ${m.ref_visitante}`);
  });
}

debug().catch(console.error);
