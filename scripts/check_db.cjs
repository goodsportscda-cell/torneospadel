const { createClient } = require("@supabase/supabase-js");

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing credentials", url, key);
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const { data: torneos } = await supabase
    .from("torneos")
    .select("id, nombre, estado, numero_fecha, categoria_id, tipo, multiplicador_puntos")
    .eq("numero_fecha", 4);

  console.log("Torneos 4ta fecha:", JSON.stringify(torneos, null, 2));

  if (torneos && torneos.length > 0) {
    const ids = torneos.map((t) => t.id);
    const { data: ranking } = await supabase
      .from("ranking_jugadores")
      .select("*")
      .in("torneo_id", ids);

    console.log("Registros de ranking:", ranking?.length);
    console.log("Sample de ranking:", ranking?.slice(0, 3));
  }
}

run();
