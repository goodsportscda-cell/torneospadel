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
  const { data: profiles, error } = await supabase
    .from('perfiles')
    .select('*')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log("Profiles in Database:");
  console.log(profiles);
}

run();
