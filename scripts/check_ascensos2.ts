import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data: rankings } = await supabase.from('ranking_jugadores')
        .select('*')
        .eq('jugador_id', '2e25dfa1-f93c-4ae2-a1a4-14eee6d7630b');
    
    console.log("Rankings for Ceriani:");
    for (const r of rankings || []) {
        console.log(`- Pts: ${r.puntos}, Year: ${r.anio}, Created: ${r.created_at}, Torneo: ${r.torneo_id}`);
    }
}

inspect();
