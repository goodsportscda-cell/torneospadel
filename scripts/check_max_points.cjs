const { createClient } = require("@supabase/supabase-js");

const url = process.env.VITE_SUPABASE_URL.replace(/"/g, '');
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY.replace(/"/g, '');

const supabase = createClient(url, key);

async function run() {
  const { data: torneos } = await supabase
    .from("torneos")
    .select("id")
    .eq("numero_fecha", 4);

  if (torneos && torneos.length > 0) {
    const ids = torneos.map((t) => t.id);
    const { data: ranking } = await supabase
      .from("ranking_jugadores")
      .select("puntos, instancia")
      .in("torneo_id", ids)
      .order("puntos", { ascending: false })
      .limit(10);

    console.log("Top 10 highest points for 4ta fecha:");
    console.log(JSON.stringify(ranking, null, 2));
  }
}

run();
