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
  
  console.log("Attempting to insert a bracket row...");
  const { data, error } = await supabase
    .from('llaves')
    .insert({
      torneo_id: torneoId,
      cantidad_parejas: 48,
      tamanio_cuadro: 48,
    })
    .select();
    
  if (error) {
    console.error("Insert Failed:");
    console.error(error);
  } else {
    console.log("Insert Successful! Data:");
    console.log(data);
    
    // Clean up
    console.log("Cleaning up inserted test bracket...");
    await supabase.from('llaves').delete().eq('id', data[0].id);
  }
}

run();
