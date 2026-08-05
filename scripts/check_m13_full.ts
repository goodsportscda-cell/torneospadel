import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatch() {
  const { data: p } = await supabase.from('partidos_llave').select('*').eq('id', 'd9472b9e-703a-4cfb-9e90-98b1f6242768').single();
  console.log(p);
}
checkMatch().catch(console.error);
