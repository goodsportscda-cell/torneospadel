import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
let supabaseUrl = '';
let supabaseAnonKey = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/"/g, '');
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) supabaseAnonKey = line.split('=')[1].trim().replace(/"/g, '');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: players } = await supabase
    .from('jugadores')
    .select('*')
    .ilike('apellido', '%perez%')
    .ilike('nombre', '%macarena%');

  if (!players || players.length === 0) {
    console.log("Player not found");
    return;
  }

  for (const player of players) {
    console.log(`\nPlayer: ${player.nombre} ${player.apellido} (${player.id})`);
    
    const { data: ranking, error } = await supabase
      .from('ranking_jugadores')
      .select('*')
      .eq('jugador_id', player.id);

    console.log("\nTournaments:");
    console.log(JSON.stringify(ranking, null, 2));

  }
}

main().catch(console.error);
