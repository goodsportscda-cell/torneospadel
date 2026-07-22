import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .map(line => line.replace('\r', ''))
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [k, ...v] = line.split('=');
      return [k, v.join('=').replace(/^"|"$/g, '')];
    })
);

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: torneos } = await supabase
    .from('torneos')
    .select('id, nombre, estado')
    .order('fecha_inicio', { ascending: false });
  
  for (const t of torneos || []) {
    const { count } = await supabase
      .from('zonas')
      .select('*', { count: 'exact', head: true })
      .eq('torneo_id', t.id);
    if (count && count > 0) {
      console.log(`Torneo con zonas: ${t.nombre} (${t.id}) - Zonas: ${count}`);
      
      const { data: llaves } = await supabase
        .from('llaves')
        .select('*')
        .eq('torneo_id', t.id);
      
      console.log(`Llaves generadas: ${llaves?.length ? 'Si' : 'No'} (Cantidad parejas: ${llaves?.[0]?.cantidad_parejas || 0})`);
      break;
    }
  }

  if (torneos && torneos.length > 0) {
    const id = torneos[0].id;
    console.log(`\nTorneo más reciente: ${torneos[0].nombre} (${id})`);

    const { data: inscripciones } = await supabase
      .from('inscripciones')
      .select('id, estado')
      .eq('torneo_id', id)
      .eq('estado', 'confirmada');
    
    console.log(`Inscripciones confirmadas: ${inscripciones?.length}`);

    const { data: zonas } = await supabase
      .from('zonas')
      .select('id, nombre, tamanio')
      .eq('torneo_id', id);
    
    console.log(`Zonas: ${zonas?.length}`);
    if (zonas) {
      console.log(zonas);
    }
  }
}
run();
