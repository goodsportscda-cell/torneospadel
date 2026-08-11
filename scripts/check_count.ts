import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://okmmwahmhxuyojdtksnr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data: rankings, count } = await supabase.from('ranking_jugadores')
        .select('*', { count: 'exact', head: true });
    
    console.log(`Total records in ranking_jugadores: ${count}`);
}

inspect();
