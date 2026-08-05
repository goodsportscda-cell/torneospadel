import { createClient } from '@supabase/supabase-js';
import { generarCuadroGenerico } from '../src/lib/llaves';

async function debug() {
  const partidos = generarCuadroGenerico(33);
  
  console.log("generarCuadroGenerico(33) using actual imported code:");
  partidos.filter(p => p.numero <= 15).forEach(p => {
      console.log(`M${p.numero}: ${p.ref_local} vs ${p.ref_visitante}`);
  });
}

debug().catch(console.error);
