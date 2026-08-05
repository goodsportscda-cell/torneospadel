import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSets() {
  const { data: p } = await supabase.from('partidos_llave').select('id, numero').eq('llave_id', 'a6c6be45-aa79-4471-a75c-f1511de016b4');
  if (!p) return;
  const ids = p.map(m => m.id);
  const { data: sets, error } = await supabase.from('sets_partido').select('*').in('partido_llave_id', ids);
  console.log("Sets found:", sets?.length);
  if (sets) {
      sets.forEach(s => console.log(s));
  }
}
checkSets().catch(console.error);
