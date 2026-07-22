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
  
  // 1. Get Categories
  const { data: categorias } = await supabase
    .from('categorias')
    .select('*');
  const catMap = {};
  if (categorias) {
    for (const c of categorias) {
      catMap[c.id] = c.nombre;
    }
  }

  // 2. Count confirmed inscriptions per category in this tournament
  const { data: inscripciones, error } = await supabase
    .from('inscripciones')
    .select('id, categoria_id, estado')
    .eq('torneo_id', torneoId)
    .eq('estado', 'confirmada');

  if (error) {
    console.error('Error fetching inscriptions:', error);
    return;
  }

  const counts = {};
  for (const ins of inscripciones || []) {
    const catName = catMap[ins.categoria_id] || ins.categoria_id || 'Unknown';
    counts[catName] = (counts[catName] || 0) + 1;
  }

  console.log(`\nConfirmed Inscriptions per Category in tournament:`);
  for (const [catName, count] of Object.entries(counts)) {
    console.log(`  - Category: ${catName}, Count: ${count}`);
  }

  // 3. Let's also check the actual zones mapped to each category
  const { data: zonas } = await supabase
    .from('zonas')
    .select('id, nombre, categoria_id')
    .eq('torneo_id', torneoId);

  const zonesByCat = {};
  for (const z of zonas || []) {
    const catName = catMap[z.categoria_id] || z.categoria_id || 'Unknown';
    if (!zonesByCat[catName]) zonesByCat[catName] = [];
    zonesByCat[catName].push(z.nombre);
  }

  console.log(`\nZones configured per Category in tournament:`);
  for (const [catName, list] of Object.entries(zonesByCat)) {
    console.log(`  - Category: ${catName}, Zones: ${list.sort().join(', ')}`);
  }
}

run();
