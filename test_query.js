import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://okmmwahmhxuyojdtksnr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q'
);

async function run() {
  const { data, error } = await supabase
    .from("inscripciones")
    .select(`
      *,
      jugador1:jugadores!inscripciones_jugador1_id_fkey(id, nombre, apellido, club, telefono, dni),
      jugador2:jugadores!inscripciones_jugador2_id_fkey(id, nombre, apellido, club, telefono, dni)
    `)
    .eq('torneo_id', 'ba5aec81-98bf-42a9-955b-c900541de59f');
    
  console.log('Error:', error);
  console.log('Data count:', data ? data.length : 0);
  console.log(data);
}

run();
