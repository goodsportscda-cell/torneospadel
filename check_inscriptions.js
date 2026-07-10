import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const getEnvVar = (key) => {
  const match = envFile.match(new RegExp(`${key}\\s*=\\s*["']?([^"'\r\n]+)["']?`));
  return match ? match[1] : null;
};

const supabase = createClient(
  getEnvVar('VITE_SUPABASE_URL'),
  getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY')
);

async function run() {
  const { data: torneos } = await supabase.from('torneos').select('id, nombre').ilike('nombre', '%Gran Slam 7C%');
  if (torneos && torneos.length > 0) {
    const torneoId = torneos[0].id;
    console.log(`Found tournament: ${torneos[0].nombre} (${torneoId})`);
    const { data: inscripciones, error } = await supabase
      .from('inscripciones')
      .select('*, jugador1:jugadores!inscripciones_jugador1_id_fkey(nombre, apellido), jugador2:jugadores!inscripciones_jugador2_id_fkey(nombre, apellido)')
      .eq('torneo_id', torneoId)
      .order('created_at', { ascending: false });
    
    if (error) console.error(error);
    console.log(`Found ${inscripciones ? inscripciones.length : 0} inscriptions in inscripciones table`);
    console.log(JSON.stringify(inscripciones, null, 2));

    const { data: indJugadores } = await supabase
      .from('torneo_individual_jugadores')
      .select('*')
      .eq('torneo_id', torneoId);
    
    console.log(`Found ${indJugadores ? indJugadores.length : 0} inscriptions in torneo_individual_jugadores table`);
  } else {
    console.log("Tournament not found");
  }
}
run();
