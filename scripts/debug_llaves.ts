import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLlaves() {
  const { data: torneos } = await supabase.from('torneos').select('*').order('created_at', { ascending: false }).limit(1);
  if (!torneos || torneos.length === 0) return;
  const torneoId = torneos[0].id;
  console.log("Torneo:", torneos[0].nombre, torneoId);
  
  const { data: categorias } = await supabase.from('categorias').select('*').eq('torneo_id', torneoId);
  console.log("Categorias:", categorias?.length);
  
  // Find a bracket
  const { data: llaves } = await supabase.from('llaves').select('*').limit(10);
  
  // Find one that has sets
  for (const ll of llaves || []) {
    const { data: pl } = await supabase.from('partidos_llave').select('*').eq('llave_id', ll.id).order('numero');
    if (!pl || pl.length === 0) continue;
    
    const ids = pl.map(p => p.id);
    const { data: sets } = await supabase.from('sets_partido').select('*').in('partido_llave_id', ids);
    
    if (sets && sets.length > 0) {
      console.log(`Llave ${ll.id} has ${sets.length} sets`);
      console.log("First match with sets:", sets[0].partido_llave_id);
      break;
    }
  }
}
debugLlaves().catch(console.error);
