import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatch() {
  const { data: p } = await supabase.from('partidos_llave').select('*').eq('numero', 2).order('created_at', { ascending: false }).limit(5);
  console.log("partidos 2:", p);
  
  if (p && p.length > 0) {
    const { data: sets } = await supabase.from('sets_partido').select('*').eq('partido_llave_id', p[0].id);
    console.log("sets para p[0]:", sets);
  }
}
checkMatch().catch(console.error);
