import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTournament(llaveId: string) {
  const { data: partidos } = await supabase.from('partidos_llave').select('*').eq('llave_id', llaveId);
  if (!partidos) return;

  const numeroToId = new Map(partidos.map(p => [p.numero, p.id]));
  const updates: any[] = [];

  for (const p of partidos) {
      if (p.ref_local?.startsWith('G:')) {
          const num = parseInt(p.ref_local.split(':')[1], 10);
          const origenId = numeroToId.get(num);
          if (origenId) {
              updates.push(
                  supabase.from('partidos_llave').update({
                      partido_siguiente_id: p.id,
                      posicion_siguiente: 'local'
                  }).eq('id', origenId)
              );
          }
      }
      if (p.ref_visitante?.startsWith('G:')) {
          const num = parseInt(p.ref_visitante.split(':')[1], 10);
          const origenId = numeroToId.get(num);
          if (origenId) {
              updates.push(
                  supabase.from('partidos_llave').update({
                      partido_siguiente_id: p.id,
                      posicion_siguiente: 'visitante'
                  }).eq('id', origenId)
              );
          }
      }
  }

  await Promise.all(updates);
  console.log(`Updated partido_siguiente_id for ${updates.length} matches based on DB refs!`);

  // Clear bad data in M13 (1°G vs 1°J) and set good data in M12 (1°F vs G:5)
  const m5 = partidos.find(p => p.numero === 5);
  const m12 = partidos.find(p => p.numero === 12);
  const m13 = partidos.find(p => p.numero === 13);

  if (m5?.ganador_id && m13?.pareja_visitante_id === m5.ganador_id) {
      console.log("Fixing M13 visitante...");
      await supabase.from('partidos_llave').update({ pareja_visitante_id: null }).eq('id', m13.id);
  }
  
  if (m5?.ganador_id && m12) {
      console.log("Propagating M5 winner to M12 visitante...");
      await supabase.from('partidos_llave').update({ pareja_visitante_id: m5.ganador_id }).eq('id', m12.id);
  }
}

fixTournament('a6c6be45-aa79-4471-a75c-f1511de016b4').then(() => console.log("Done")).catch(console.error);
