import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const { data: partidos } = await supabase.from('partidos_llave').select('numero, ref_local, ref_visitante, partido_siguiente_id, created_at, updated_at').eq('llave_id', 'a6c6be45-aa79-4471-a75c-f1511de016b4').order('numero');
  
  console.log("DB Matches details:");
  partidos.forEach(p => {
      console.log(`M${p.numero}: ${p.ref_local} vs ${p.ref_visitante} | created: ${p.created_at} | updated: ${p.updated_at}`);
  });
}

debug().catch(console.error);
