import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const t_id = '8b73d288-035e-418a-a013-57053db05b68';
  
  const { data: zonas } = await supabase.from('zonas').select('id, nombre').eq('torneo_id', t_id);
  console.log("Zones:");
  zonas.forEach(z => console.log(z.nombre));
  
  const zonaA = zonas.find(z => z.nombre === 'A');
  const zonaJ = zonas.find(z => z.nombre === 'J');
  
  const { data: pz } = await supabase.from('partidos_zona').select('*').in('zona_id', zonas.map(z => z.id));
  const { data: zp } = await supabase.from('zonas_parejas').select('*').in('zona_id', zonas.map(z => z.id));
  
  // Is it possible that "J" is matching something else?
  const rankings = {};
  zonas.forEach((z) => {
      const n = z.nombre.trim();
      const partidosDeEstaZona = pz.filter((p) => p.zona_id === z.id);
      const estaFinalizada =
        partidosDeEstaZona.length > 0 &&
        partidosDeEstaZona.every((p) => p.estado === "finalizado");
        
      rankings[n] = { finalizada: estaFinalizada };
  });
  
  console.log("Rankings finalizadas:");
  console.log(rankings);
}

debug().catch(console.error);
