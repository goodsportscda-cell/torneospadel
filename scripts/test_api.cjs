const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
const envFile = fs.readFileSync(envPath, 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/"/g, '');
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/"/g, '');
});

async function main() {
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const llavesRes = await fetch(`${supabaseUrl}/rest/v1/llaves?select=id,torneo_id&limit=1`, { headers });
  const llaves = await llavesRes.json();
  console.log('llaves:', llaves);
  if (!llaves || llaves.length === 0) return;

  const llaveId = llaves[0].id;

  // Get a partido
  const partidosRes = await fetch(`${supabaseUrl}/rest/v1/partidos_llave?select=id,numero&llave_id=eq.${llaveId}&limit=1`, { headers });
  const partidos = await partidosRes.json();
  
  if (partidos && partidos.length > 0) {
    const partidoId = partidos[0].id;
    console.log(`Intentando insertar set para partido_llave_id: ${partidoId}`);
    
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/sets_partido`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        partido_llave_id: partidoId,
        numero_set: 1,
        games_local: 6,
        games_visitante: 4
      })
    });
    
    if (!insertRes.ok) {
      console.error('Error al insertar:', await insertRes.text());
    } else {
      console.log('Set insertado:', await insertRes.json());
    }
  }
}

main().catch(console.error);
