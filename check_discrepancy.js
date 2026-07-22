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
  
  // Confirmed registrations
  const { data: inscripciones } = await supabase
    .from('inscripciones')
    .select('id')
    .eq('torneo_id', torneoId)
    .eq('estado', 'confirmada');

  // Couples in zones
  const { data: zones } = await supabase
    .from('zonas')
    .select('id')
    .eq('torneo_id', torneoId);

  const zoneIds = zones?.map(z => z.id) || [];
  let zonasParejasCount = 0;
  if (zoneIds.length > 0) {
    const { count } = await supabase
      .from('zonas_parejas')
      .select('*', { count: 'exact', head: true })
      .in('zona_id', zoneIds);
    zonasParejasCount = count || 0;
  }

  console.log(`Discrepancy Analysis for Tournament:`);
  console.log(`- Confirmed Inscriptions count: ${inscripciones?.length}`);
  console.log(`- Couples in zones (zonas_parejas) count: ${zonasParejasCount}`);
}

run();
