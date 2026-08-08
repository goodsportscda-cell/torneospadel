import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixFinales() {
  console.log("Buscando partidos de finales finalizados...");

  const { data: finales, error } = await supabase
    .from("partidos_llave")
    .select("id, llave_id, ganador_id, pareja_local_id, pareja_visitante_id")
    .eq("ronda", "final")
    .not("ganador_id", "is", null);

  if (error) {
    console.error("Error al buscar finales:", error);
    return;
  }

  if (!finales || finales.length === 0) {
    console.log("No se encontraron finales con ganador asignado.");
    return;
  }

  console.log(`Se encontraron ${finales.length} finales finalizadas.`);

  for (const final of finales) {
    if (!final.pareja_local_id || !final.pareja_visitante_id) {
      console.log(`Final ID ${final.id} no tiene ambas parejas asignadas. Saltando...`);
      continue;
    }

    const perdedor_id =
      final.ganador_id === final.pareja_local_id
        ? final.pareja_visitante_id
        : final.pareja_local_id;

    console.log(`\nProcesando final ID ${final.id} (Llave ID: ${final.llave_id})`);
    console.log(` - Ganador (Campeón): ${final.ganador_id}`);
    console.log(` - Perdedor (Subcampeón): ${perdedor_id}`);

    // Update Campeón
    const { error: err1 } = await supabase
      .from("inscripciones")
      .update({ estado: "campeon" })
      .eq("id", final.ganador_id);
    
    if (err1) {
      console.error(`Error actualizando Campeón ${final.ganador_id}:`, err1);
    } else {
      console.log(` ✓ Campeón actualizado exitosamente.`);
    }

    // Update Subcampeón
    const { error: err2 } = await supabase
      .from("inscripciones")
      .update({ estado: "subcampeon" })
      .eq("id", perdedor_id);
    
    if (err2) {
      console.error(`Error actualizando Subcampeón ${perdedor_id}:`, err2);
    } else {
      console.log(` ✓ Subcampeón actualizado exitosamente.`);
    }
  }

  console.log("\nProceso de corrección de finales completado.");
}

fixFinales();
