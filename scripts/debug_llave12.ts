import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const { data: insc } = await supabase.from('inscripciones').select('id, jugador1:jugadores!inscripciones_jugador1_id_fkey(nombre, apellido), jugador2:jugadores!inscripciones_jugador2_id_fkey(nombre, apellido)');
  
  const getParejaName = (id) => {
      const i = insc.find(x => x.id === id);
      if (!i) return 'Unknown';
      return `${i.jugador1?.apellido} / ${i.jugador2?.apellido}`;
  }
  
  const target1 = '0a49c34d-0094-4979-ae70-66039db03d1b';
  console.log(`0a49c34d... (What was in DB for 1°J): ${getParejaName(target1)}`);
  
  const id1J = '11cf98c6-3cbf-4cfa-b267-7e2090576086';
  const id2J = '963c556f-0fd4-4dcc-9b5e-caf108c44cb5';
  
  console.log(`1°J: ${getParejaName(id1J)}`);
  console.log(`2°J: ${getParejaName(id2J)}`);
  
  const id1A = 'some-id'; // I don't know it, but let's print all of A and J
  
  const t_id = '8b73d288-035e-418a-a013-57053db05b68';
  const { data: zp } = await supabase.from('zonas_parejas').select('*, zonas(nombre)').eq('torneo_id', t_id);
  
  console.log("\nZone J pairs:");
  zp.filter(z => z.zonas.nombre === 'J').forEach(z => {
      console.log(`- ${z.inscripcion_id}: ${getParejaName(z.inscripcion_id)}`);
  });
  
  console.log("\nZone A pairs:");
  zp.filter(z => z.zonas.nombre === 'A').forEach(z => {
      console.log(`- ${z.inscripcion_id}: ${getParejaName(z.inscripcion_id)}`);
  });
}

debug().catch(console.error);
