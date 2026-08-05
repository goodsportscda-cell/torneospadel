const { createClient } = require("@supabase/supabase-js");

const url = process.env.VITE_SUPABASE_URL.replace(/"/g, '');
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY.replace(/"/g, '');

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
      .from("ranking_jugadores")
      .select("jugador_id, puntos, torneo_id, categoria_id, genero, anio")
      .eq("anio", 2026)
      .eq("genero", "caballeros");

  console.log("Error?", error);
  console.log("Data length:", data?.length);
  if (data && data.length > 0) {
    console.log("Sample:", data[0]);
  }
}

run();
