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
  console.log("Updating has_role function...");
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
      RETURNS BOOLEAN
      LANGUAGE SQL
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.perfiles
          WHERE id = _user_id AND (
            (_role = 'admin' AND rol IN ('super_admin', 'club_admin')) OR
            (_role = 'user' AND rol = 'jugador')
          )
        )
      $$;
    `
  });
  
  if (error) {
    console.error("Error updating has_role:");
    console.error(error);
  } else {
    console.log("Successfully updated has_role function!");
    console.log(data);
  }
}

run();
