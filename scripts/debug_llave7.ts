import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const t_id = '8b73d288-035e-418a-a013-57053db05b68';
  
  // Find Zone J
  const { data: zonas } = await supabase.from('zonas').select('id, nombre').eq('torneo_id', t_id);
  console.log("Zones:");
  for (const z of zonas) {
    const n = z.nombre.trim().toUpperCase().replace(/ZONA\s+/i, "");
    console.log(`- Original: "${z.nombre}", Normalized: "${n}"`);
  }
}

debug().catch(console.error);
