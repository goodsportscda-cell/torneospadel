import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFrontendLogic() {
  const llId = 'fae00179-8283-45da-99e6-43e859b9a6b0'; // Bracket for match 6
  const { data: pl } = await supabase.from('partidos_llave').select('*').eq('llave_id', llId).order('numero');
  if (!pl) { console.log("No pl"); return; }
  
  const ids = pl.map(p => p.id);
  const { data: sets, error } = await supabase.from('sets_partido').select('*').in('partido_llave_id', ids);
  
  console.log("Error:", error);
  console.log("Sets count:", sets?.length);
  console.log("Sets for match 6 (a9333abf-0850-4bf0-a1cd-d2d3dab823fe):", sets?.filter(s => s.partido_llave_id === 'a9333abf-0850-4bf0-a1cd-d2d3dab823fe'));
}
checkFrontendLogic().catch(console.error);
