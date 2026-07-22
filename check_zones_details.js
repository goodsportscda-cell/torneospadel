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
    .select('*')
    .order('created_at', { ascending: false });

  console.log(`Found ${torneos?.length || 0} tournaments:`);
  for (const t of torneos || []) {
    const { count: zonesCount } = await supabase
      .from('zonas')
      .select('*', { count: 'exact', head: true })
      .eq('torneo_id', t.id);
    
    // Get total couples in zones for this tournament
    // First get zone ids
    const { data: zones } = await supabase
      .from('zonas')
      .select('id')
      .eq('torneo_id', t.id);
    const zoneIds = zones?.map(z => z.id) || [];
    
    let couplesCount = 0;
    if (zoneIds.length > 0) {
      const { count } = await supabase
        .from('zonas_parejas')
        .select('*', { count: 'exact', head: true })
        .in('zona_id', zoneIds);
      couplesCount = count || 0;
    }

    console.log(`Tournament: "${t.nombre}" (ID: ${t.id}), Estado: ${t.estado}, Zonas: ${zonesCount || 0}, Parejas en Zonas: ${couplesCount}`);
  }
}

run();
