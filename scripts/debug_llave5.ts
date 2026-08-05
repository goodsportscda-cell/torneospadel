import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const t_id = '8b73d288-035e-418a-a013-57053db05b68';
  
  const { data: llaves } = await supabase.from('llaves').select('*').eq('torneo_id', t_id).single();
  const { data: partidos } = await supabase.from('partidos_llave').select('*').eq('llave_id', llaves.id).order('numero');
  
  const p13 = partidos.find(p => p.numero === 13);
  console.log("Partido 13:", p13);
  
  const { data: z_parejas } = await supabase.from('zonas_parejas').select('inscripcion_id, zona_id, zonas(nombre)').eq('torneo_id', t_id);
  
  const p13_local_zona = z_parejas.find(z => z.inscripcion_id === p13.pareja_local_id);
  const p13_visi_zona = z_parejas.find(z => z.inscripcion_id === p13.pareja_visitante_id);
  
  console.log("Local zone:", p13_local_zona?.zonas?.nombre);
  console.log("Visi zone:", p13_visi_zona?.zonas?.nombre);
  
  // also what is 0a49c34d?
  const { data: allZps } = await supabase.from('zonas_parejas').select('*, zonas(nombre)').eq('inscripcion_id', '0a49c34d-0094-4979-ae70-66039db03d1b');
  console.log("0a49c34d:", allZps);
  
  // Let's get the ranking for zone J
  const { data: zonas } = await supabase.from('zonas').select('id, nombre').eq('torneo_id', t_id);
  const zonaJ = zonas.find(z => z.nombre.includes('J'));
  const { data: zpJ } = await supabase.from('zonas_parejas').select('inscripcion_id').eq('zona_id', zonaJ.id);
  console.log("Teams in Zone J:", zpJ);

}

debug().catch(console.error);
