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
  const { data: llaves, error } = await supabase
    .from('llaves')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching llaves:', error);
    return;
  }

  console.log(`Found ${llaves?.length || 0} recent brackets:`);
  for (const l of llaves || []) {
    const { data: torneo } = await supabase
      .from('torneos')
      .select('id, nombre, estado')
      .eq('id', l.torneo_id)
      .single();

    console.log(`\nBracket ID: ${l.id}`);
    console.log(`Tournament: "${torneo?.nombre}" (ID: ${torneo?.id}), Estado: ${torneo?.estado}`);
    console.log(`Cantidad Parejas: ${l.cantidad_parejas}, Tamanio Cuadro: ${l.tamanio_cuadro}`);
    
    // Get matches count
    const { data: partidos } = await supabase
      .from('partidos_llave')
      .select('*')
      .eq('llave_id', l.id)
      .order('numero');
    
    console.log(`Partidos count: ${partidos?.length || 0}`);
    if (partidos && partidos.length > 0) {
      console.log('Matches list (first 10):');
      for (const p of partidos.slice(0, 10)) {
        console.log(`  - Match ${p.numero} (${p.ronda}): Local Ref: ${p.ref_local} (${p.pareja_local_id}), Visitante Ref: ${p.ref_visitante} (${p.pareja_visitante_id})`);
      }
    }
  }
}

run();
