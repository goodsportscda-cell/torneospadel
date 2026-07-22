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
  const userId = 'bcc4ebc9-85c8-4b3b-ae09-3c2e52e401b0';
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('User roles for bcc4ebc9-85c8-4b3b-ae09-3c2e52e401b0:');
  console.log(data);
}

run();
