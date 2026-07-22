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
  
  // Get tournament
  const { data: torneo } = await supabase
    .from('torneos')
    .select('*')
    .eq('id', torneoId)
    .single();
    
  console.log(`Tournament: "${torneo?.nombre}" (ID: ${torneo?.id}), Estado: ${torneo?.estado}`);
  
  // Get categories
  const { data: categorias } = await supabase
    .from('categorias')
    .select('*')
    .eq('torneo_id', torneoId);
    
  console.log(`\nCategories (${categorias?.length || 0}):`);
  for (const cat of categorias || []) {
    // Get couples count
    const { count: parejasCount } = await supabase
      .from('parejas')
      .select('*', { count: 'exact', head: true })
      .eq('categoria_id', cat.id);
      
    // Get llaves
    const { data: llaves } = await supabase
      .from('llaves')
      .select('*')
      .eq('categoria_id', cat.id);
      
    console.log(`  - Category: "${cat.nombre}" (ID: ${cat.id})`);
    console.log(`    Couples registered: ${parejasCount}`);
    console.log(`    Brackets (llaves) count: ${llaves?.length || 0}`);
    for (const l of llaves || []) {
      console.log(`      * Bracket ID: ${l.id}, Cantidad Parejas: ${l.cantidad_parejas}, Tamanio Cuadro: ${l.tamanio_cuadro}`);
      // Get matches
      const { data: partidos } = await supabase
        .from('partidos_llave')
        .select('*')
        .eq('llave_id', l.id)
        .order('numero');
      console.log(`        Matches count: ${partidos?.length || 0}`);
      if (partidos && partidos.length > 0) {
        console.log(`        First 5 matches:`);
        for (const p of partidos.slice(0, 5)) {
          console.log(`          - Match ${p.numero} (${p.ronda}): Local Ref: ${p.ref_local}, Visitante Ref: ${p.ref_visitante}`);
        }
      }
    }
  }
}

run();
