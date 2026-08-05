const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('c:\\Users\\Hp\\.gemini\\antigravity-ide\\scratch\\good-padel\\.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('torneos').select('id, nombre, estado, numero_fecha, categoria_id, tipo, multiplicador_puntos').eq('numero_fecha', 4);
  console.log(JSON.stringify(data, null, 2));
  
  if (data && data.length > 0) {
      const { data: puntos } = await supabase.from('ranking_jugadores').select('*').in('torneo_id', data.map(t => t.id));
      console.log('Puntos para la 4ta fecha:', puntos.length);
  }
}
run();
