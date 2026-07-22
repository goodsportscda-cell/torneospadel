import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://okmmwahmhxuyojdtksnr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q'
);

async function run() {
  const { data, error } = await supabase.from('torneos').delete().is('club_id', null);
  console.log('Delete Error:', error);
  console.log('Delete Data:', data);
}

run();
