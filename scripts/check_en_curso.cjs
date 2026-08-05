const { createClient } = require("@supabase/supabase-js");

const url = process.env.VITE_SUPABASE_URL.replace(/"/g, '');
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY.replace(/"/g, '');

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
      .from("torneos")
      .select("id, nombre, estado, numero_fecha")
      .eq("estado", "en_curso");

  console.log("Error?", error);
  if (data && data.length > 0) {
    console.log("Torneos en curso:", JSON.stringify(data, null, 2));
  } else {
    console.log("No hay torneos en curso");
  }
}

run();
