import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: llaves } = await supabase.from("llaves").select("*, torneos(*)").ilike("torneos.nombre", "%8va%").limit(10);
  
  if (!llaves) return;
  for (const ll of llaves) {
    if (!ll.torneos) continue;
    console.log("Torneo:", ll.torneos.nombre, "Llave:", ll.id);
    const { data: partidos } = await supabase.from("partidos_llave").select("*").eq("llave_id", ll.id);
    const final = partidos?.find(p => p.ronda === 'final');
    if (final) {
        console.log("Final match:", final);
    } else {
        console.log("NO FINAL MATCH FOUND with ronda='final'");
    }
  }
}
run();
