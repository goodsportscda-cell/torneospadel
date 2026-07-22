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
  
  const { data: zones } = await supabase
    .from('zonas')
    .select('id, nombre')
    .eq('torneo_id', torneoId);

  const zoneIds = zones?.map(z => z.id) || [];
  
  const { data: partidos } = await supabase
    .from('partidos_zona')
    .select('*')
    .in('zona_id', zoneIds);

  console.log(`Tournament Group Matches Status:`);
  console.log(`- Total matches: ${partidos?.length || 0}`);
  
  const pending = partidos?.filter(p => p.estado !== 'finalizado') || [];
  const finished = partidos?.filter(p => p.estado === 'finalizado') || [];
  
  console.log(`- Finished matches: ${finished.length}`);
  console.log(`- Pending matches: ${pending.length}`);
  
  if (pending.length > 0) {
    console.log(`Pending matches examples (first 5):`);
    for (const p of pending.slice(0, 5)) {
      const zName = zones.find(z => z.id === p.zona_id)?.nombre;
      console.log(`  * Zone ${zName}, Match ID: ${p.id}, Estado: ${p.estado}`);
    }
  }
}

run();
