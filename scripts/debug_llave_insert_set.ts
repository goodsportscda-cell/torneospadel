import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: llaves } = await supabase.from('llaves').select('id, torneo_id');
  if (!llaves || llaves.length === 0) return;
  
  const llaveId = llaves[0].id;
  const { data: partidos } = await supabase.from('partidos_llave').select('id, numero').eq('llave_id', llaveId);
  
  if (partidos && partidos.length > 0) {
    const partidoId = partidos[0].id;
    console.log(`Intentando insertar set para partido_llave_id: ${partidoId}`);
    const { data, error } = await supabase.from('sets_partido').insert({
      partido_llave_id: partidoId,
      numero_set: 1,
      games_local: 6,
      games_visitante: 4
    }).select();
    
    if (error) {
      console.error('Error al insertar:', error);
    } else {
      console.log('Set insertado:', data);
    }
  }
}

main().catch(console.error);
