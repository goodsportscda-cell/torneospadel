import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const t_id = '8b73d288-035e-418a-a013-57053db05b68';
  
  // Find Zone J
  const { data: zonas } = await supabase.from('zonas').select('id, nombre').eq('torneo_id', t_id);
  const zonaJ = zonas.find(z => z.nombre.includes('J'));
  
  if (zonaJ) {
    console.log("Zona J:", zonaJ);
    // Find players in Zone J
    const { data: zp } = await supabase.from('zonas_parejas').select('inscripcion_id').eq('zona_id', zonaJ.id);
    console.log("Teams in Zone J:", zp);
    
    // Check if the problematic ID is in Zone J
    const targetId = '0a49c34d-0094-4979-ae70-66039db03d1b';
    const isInZone = zp.some(z => z.inscripcion_id === targetId);
    console.log(`Is target ID ${targetId} in Zone J?`, isInZone);
    
    // Find what zone the target ID belongs to
    const { data: allZp } = await supabase.from('zonas_parejas').select('zona_id').eq('inscripcion_id', targetId);
    if (allZp && allZp.length > 0) {
        const zoneId = allZp[0].zona_id;
        const { data: zone } = await supabase.from('zonas').select('nombre').eq('id', zoneId).single();
        console.log(`Target ID belongs to zone:`, zone?.nombre);
    }
  }
}

debug().catch(console.error);
