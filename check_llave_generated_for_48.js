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
  const torneoId = 'fa177f5b-3203-489a-a2fd-bdf74adb7f04';
  
  // Find all brackets for this tournament
  const { data: llaves, error } = await supabase
    .from('llaves')
    .select('*')
    .eq('torneo_id', torneoId);
    
  if (error) {
    console.error('Error fetching llaves:', error);
    return;
  }
  
  console.log(`Found ${llaves?.length || 0} brackets for tournament.`);
  for (const l of llaves || []) {
    console.log(`\nBracket ID: ${l.id}, Category ID: ${l.categoria_id}, Cantidad Parejas: ${l.cantidad_parejas}, Tamanio Cuadro: ${l.tamanio_cuadro}`);
    
    // Fetch matches
    const { data: partidos } = await supabase
      .from('partidos_llave')
      .select('*, pareja_local:parejas!partidos_llave_pareja_local_id_fkey(id, jugador1_id, jugador2_id), pareja_visitante:parejas!partidos_llave_pareja_visitante_id_fkey(id, jugador1_id, jugador2_id)')
      .eq('llave_id', l.id)
      .order('numero');
      
    console.log(`Matches count: ${partidos?.length || 0}`);
    for (const p of partidos || []) {
      console.log(`  - Match ${p.numero} (${p.ronda}): Local: ${p.ref_local} (${p.pareja_local_id}), Visi: ${p.ref_visitante} (${p.pareja_visitante_id})`);
    }
  }
}

run();
