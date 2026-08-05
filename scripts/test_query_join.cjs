const { createClient } = require("@supabase/supabase-js");

const url = process.env.VITE_SUPABASE_URL.replace(/"/g, '');
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY.replace(/"/g, '');

const supabase = createClient(url, key);

async function run() {
  const clubId = "b6e587f6-f7f0-4b5b-9a91-f4a0fb8a1190";
  const { data, error } = await supabase
      .from("ranking_jugadores")
      .select("jugador_id, puntos, categoria_id, genero, torneos!inner(club_id)")
      .eq("torneos.club_id", clubId)
      .eq("anio", 2026);

  console.log("Error?", error);
  console.log("Data length:", data?.length);
  if (data && data.length > 0) {
    console.log("Sample:", data[0]);
  }
}

run();
