import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkZonaJ() {
  const torneoId = '8b73d288-035e-418a-a013-57053db05b68';
  const { data: zonas } = await supabase.from('zonas').select('*').eq('torneo_id', torneoId).eq('nombre', 'Zona J');
  if (!zonas || zonas.length === 0) {
      console.log("No zona J");
      return;
  }
  const zonaJ = zonas[0];
  console.log("Zona J ID:", zonaJ.id);

  const { data: parejas } = await supabase.from('zonas_parejas').select('*, inscripcion:inscripciones(id, jugador1:jugadores!inscripciones_jugador1_id_fkey(nombre, apellido), jugador2:jugadores!inscripciones_jugador2_id_fkey(nombre, apellido))').eq('zona_id', zonaJ.id);
  console.log(JSON.stringify(parejas, null, 2));

  const { data: partidos } = await supabase.from('partidos_zona').select('*').eq('zona_id', zonaJ.id);
  console.log("Partidos:");
  partidos?.forEach(p => console.log(p.pareja_local_id, p.pareja_visitante_id, p.ganador_id, p.estado));
}
checkZonaJ().catch(console.error);
