const { createClient } = require("@supabase/supabase-js");

const url = process.env.VITE_SUPABASE_URL.replace(/"/g, '');
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY.replace(/"/g, '');

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
      .from("torneos")
      .select("id, nombre, club_id")
      .eq("numero_fecha", 4);

  console.log("Error?", error);
  console.log("Data length:", data?.length);
  if (data && data.length > 0) {
    console.log("Torneos:", JSON.stringify(data, null, 2));
  }
}

run();
