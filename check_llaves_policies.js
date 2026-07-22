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
  const { data: llavesPol, error: llavesErr } = await supabase.rpc('execute_sql', { 
    query: "SELECT * FROM pg_policies WHERE tablename = 'llaves';" 
  });
  console.log('LLaves policies:', llavesPol || llavesErr);

  const { data: partidosPol, error: partidosErr } = await supabase.rpc('execute_sql', { 
    query: "SELECT * FROM pg_policies WHERE tablename = 'partidos_llave';" 
  });
  console.log('Partidos Llave policies:', partidosPol || partidosErr);
}

run();
