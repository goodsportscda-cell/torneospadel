import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const { data: partidos } = await supabase.from('partidos_llave').select('*').eq('llave_id', 'a6c6be45-aa79-4471-a75c-f1511de016b4').order('numero');
  
  console.log("DB Matches Siguiente Info:");
  partidos.forEach(p => {
      if (p.numero >= 1 && p.numero <= 6) {
          const sig = partidos.find(x => x.id === p.partido_siguiente_id);
          console.log(`M${p.numero} next is M${sig?.numero} as ${p.posicion_siguiente}`);
      }
  });
}

debug().catch(console.error);
