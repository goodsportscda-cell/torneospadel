import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Use path to .env.local
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  console.log("Fetching finals from 8va Cab...");
  const { data: llaves } = await supabase.from("llaves").select("*, torneos(*)").ilike("torneos.nombre", "%8va%").limit(10);
  
  if (!llaves) return;
  for (const ll of llaves) {
    if (!ll.torneos) continue;
    console.log("Torneo:", ll.torneos.nombre, ll.id);
    const { data: partidos } = await supabase.from("partidos_llave").select("*").eq("llave_id", ll.id);
    const final = partidos?.find(p => p.ronda === 'final');
    console.log("Final match:", final);
  }
}
run();
