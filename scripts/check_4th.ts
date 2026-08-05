import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const envFile = fs.readFileSync("c:\\Users\\Hp\\.gemini\\antigravity-ide\\scratch\\good-padel\\.env", "utf8");
const env: Record<string, string> = {};
envFile.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length > 0) env[key.trim()] = rest.join("=").trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: torneos } = await supabase
    .from("torneos")
    .select("id, nombre, estado, numero_fecha, categoria_id, tipo, multiplicador_puntos")
    .eq("numero_fecha", 4);

  console.log("Torneos 4ta fecha:", JSON.stringify(torneos, null, 2));

  if (torneos && torneos.length > 0) {
    const ids = torneos.map((t: any) => t.id);
    const { data: ranking } = await supabase
      .from("ranking_jugadores")
      .select("*")
      .in("torneo_id", ids);

    console.log("Registros de ranking:", ranking?.length);
    console.log("Sample de ranking:", ranking?.slice(0, 3));
  }
}

run();
