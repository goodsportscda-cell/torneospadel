import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("Checking categories in DB...");
    const { data: allCategories, error: err1 } = await supabase.from('categorias').select('*');
    if (err1) console.error("Error fetching categories:", err1);
    
    // find duplicates
    const catGroups = new Map();
    for (const c of allCategories || []) {
        const key = `${c.nombre}-${c.genero}`;
        if (!catGroups.has(key)) catGroups.set(key, []);
        catGroups.get(key).push(c);
    }
    
    console.log("DUPLICATE CATEGORIES:");
    for (const [key, cats] of catGroups.entries()) {
        if (cats.length > 1) {
            console.log(`-- ${key} --`);
            cats.forEach(c => console.log(`   ID: ${c.id}, Club: ${c.club_id}, Tipo: ${c.tipo}`));
        }
    }

    console.log("\nChecking Benjamín Ceriani...");
    const { data: players } = await supabase.from('jugadores').select('*').ilike('nombre', '%Benjam%').ilike('apellido', '%Ceriani%');
    if (players && players.length > 0) {
        for (const p of players) {
            console.log(`Found ${p.nombre} ${p.apellido}, ID: ${p.id}`);
            const { data: rankings, error: rErr } = await supabase.from('ranking_jugadores')
                .select('*')
                .eq('jugador_id', p.id);
            
            console.log("Rankings:");
            for (const r of rankings || []) {
                const cat = allCategories?.find(c => c.id === r.categoria_id);
                console.log(`- Pts: ${r.puntos}, CatID: ${r.categoria_id} (Nombre: ${cat?.nombre}, Genero: ${cat?.genero}, Tipo: ${cat?.tipo}), TorneoID: ${r.torneo_id}`);
            }
            
            const { data: ascensos } = await supabase.from('ascensos').select('*').eq('jugador_id', p.id);
            console.log("Ascensos:", ascensos);
        }
    } else {
        console.log("Benjamín Ceriani not found.");
    }
}

inspect();
