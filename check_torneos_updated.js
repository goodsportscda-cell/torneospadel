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
  const { data: torneos, error } = await supabase
    .from('torneos')
    .select('id, nombre, estado, updated_at, created_at')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log("Recent Torneos:");
  for (const t of torneos || []) {
    // Check if there are llaves
    const { data: llaves } = await supabase
      .from('llaves')
      .select('id, cantidad_parejas, tamanio_cuadro, creado:created_at')
      .eq('torneo_id', t.id);

    console.log(`- Tournament: "${t.nombre}" (ID: ${t.id})`);
    console.log(`  Estado: ${t.estado}, Created: ${t.created_at}, Updated: ${t.updated_at}`);
    console.log(`  Brackets (llaves): ${llaves?.length || 0}`);
    for (const l of llaves || []) {
      console.log(`    * Bracket ID: ${l.id}, Parejas: ${l.cantidad_parejas}, Cuadro: ${l.tamanio_cuadro}, Created: ${l.creado}`);
    }
  }
}

run();
