import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: llaves } = await supabase.from('llaves').select('id, torneo_id');
  console.log('Llaves:', llaves);
  if (!llaves || llaves.length === 0) return;
  
  const llaveId = llaves[0].id;
  const { data: partidos } = await supabase.from('partidos_llave').select('id, numero').eq('llave_id', llaveId);
  console.log(`Partidos de la llave ${llaveId}:`, partidos?.length);
  
  if (partidos && partidos.length > 0) {
    const ids = partidos.map(p => p.id);
    const { data: sets } = await supabase.from('sets_partido').select('*').in('partido_llave_id', ids);
    console.log('Sets en partidos_llave:', sets);
  }
}

main().catch(console.error);
