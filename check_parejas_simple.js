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
    .select('*')
    .eq('torneo_id', torneoId)
    .order('nombre');

  const zoneIds = zones?.map(z => z.id) || [];
  const zoneMap = {};
  for (const z of zones || []) {
    zoneMap[z.id] = z.nombre;
  }

  const { data: zp, error } = await supabase
    .from('zonas_parejas')
    .select('*')
    .in('zona_id', zoneIds)
    .order('posicion_siembra');

  if (error) {
    console.error('Error fetching zonas_parejas:', error);
    return;
  }

  console.log(`Found ${zp?.length || 0} zonas_parejas records.`);
  
  // Group by zone name
  const grouped = {};
  for (const record of zp || []) {
    const zoneName = zoneMap[record.zona_id] || record.zona_id;
    if (!grouped[zoneName]) grouped[zoneName] = [];
    grouped[zoneName].push(record);
  }

  for (const [zName, list] of Object.entries(grouped).sort()) {
    console.log(`Zone ${zName}: ${list.length} couples`);
    for (const r of list) {
      console.log(`  - Posicion: ${r.posicion_siembra}, Inscripcion ID: ${r.inscripcion_id}`);
    }
  }
}

run();
