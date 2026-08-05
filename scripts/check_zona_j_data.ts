import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkZona() {
  const { data: zonas } = await supabase.from('zonas').select('id, nombre').eq('torneo_id', '8b73d288-035e-418a-a013-57053db05b68').eq('nombre', 'Zona J');
  if (!zonas || zonas.length === 0) { console.log('No Zona J'); return; }
  const zonaId = zonas[0].id;
  
  const { data: zp } = await supabase.from('zonas_parejas').select('*').eq('zona_id', zonaId);
  console.log('Parejas:');
  console.log(zp?.map(z => z.inscripcion_id));
  
  const { data: pz } = await supabase.from('partidos_zona').select('*').eq('zona_id', zonaId);
  console.log('Partidos:');
  pz?.forEach(p => console.log(`${p.pareja_local_id} vs ${p.pareja_visitante_id} - Ganador: ${p.ganador_id}, Estado: ${p.estado}`));
}
checkZona().catch(console.error);
