const { createClient } = require("@supabase/supabase-js");

const url = process.env.VITE_SUPABASE_URL.replace(/"/g, '');
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY.replace(/"/g, '');

const supabase = createClient(url, key);

async function run() {
  const { data: categorias } = await supabase.from("categorias").select("*");
  console.log("Categorias:", JSON.stringify(categorias, null, 2));
}

run();
