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
  const { data: zones, error } = await supabase
    .from('zonas')
    .select('id, nombre, orden')
    .eq('torneo_id', torneoId)
    .order('orden');

  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log("Zones in Database for fa177f5b-3203-489a-a2fd-bdf74adb7f04:");
  zones.forEach(z => {
    console.log(`- ID: ${z.id}, Nombre: "${z.nombre}", Orden: ${z.orden}`);
  });
}

run();
