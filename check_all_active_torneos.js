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
    .select('id, nombre, estado, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log("All Torneos:");
  for (const t of torneos || []) {
    const { count: insCount } = await supabase
      .from('inscripciones')
      .select('*', { count: 'exact', head: true })
      .eq('torneo_id', t.id)
      .eq('estado', 'confirmada');

    const { data: zones } = await supabase
      .from('zonas')
      .select('id')
      .eq('torneo_id', t.id);

    const { count: llavesCount } = await supabase
      .from('llaves')
      .select('*', { count: 'exact', head: true })
      .eq('torneo_id', t.id);

    if (insCount > 0 || (zones && zones.length > 0) || llavesCount > 0) {
      console.log(`- Tournament: "${t.nombre}" (ID: ${t.id})`);
      console.log(`  Estado: ${t.estado}, Confirmed Inscriptions: ${insCount}, Zones: ${zones?.length || 0}, Brackets: ${llavesCount}`);
    }
  }
}

run();
