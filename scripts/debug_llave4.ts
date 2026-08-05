import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const { data: torneos } = await supabase.from('torneos').select('id, nombre').ilike('nombre', '%8va%Cab%');
  if (!torneos || torneos.length === 0) {
    console.log("Torneo no encontrado");
    return;
  }
  const t = torneos[0];
  console.log("Torneo:", t.nombre, t.id);

  const { data: llave } = await supabase.from('llaves').select('*').eq('torneo_id', t.id).single();
  if (!llave) {
    console.log("No hay llave");
    return;
  }
  console.log("Llave:", llave.cantidad_parejas, llave.tamanio_cuadro);

  const { data: partidos } = await supabase.from('partidos_llave').select('*').eq('llave_id', llave.id).order('numero');
  console.log("Partidos con J:");
  partidos?.filter(p => p.ref_local?.includes('J') || p.ref_visitante?.includes('J')).forEach(p => {
    console.log(`Partido ${p.numero} (${p.ronda}): ${p.ref_local} vs ${p.ref_visitante} | LocalID: ${p.pareja_local_id} VisiID: ${p.pareja_visitante_id} | GanadorID: ${p.ganador_id}`);
  });
  
  const { data: zonas } = await supabase.from('zonas').select('id, nombre').eq('torneo_id', t.id);
  console.log(`Total zonas: ${zonas.length}`);
  const zonaJ = zonas.find(z => z.nombre.includes('J'));
  
  if (zonaJ) {
    console.log("Zona J:", zonaJ);
    const { data: pz } = await supabase.from('partidos_zona').select('*').eq('zona_id', zonaJ.id);
    console.log("Partidos Zona J:");
    pz?.forEach(p => {
       console.log(`- ${p.estado} | ${p.pareja_local_id} vs ${p.pareja_visitante_id} | Ganador: ${p.ganador_id}`);
    });
  } else {
      console.log("No hay zona J");
  }

}

debug().catch(console.error);
