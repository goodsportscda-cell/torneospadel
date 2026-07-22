import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { obtenerPlantilla, parseRef } from './src/lib/llaves.ts';
import { calcularTabla } from './src/lib/zonas.ts';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .map(line => line.replace('\r', ''))
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [k, ...v] = line.split('=');
      return [k, v.join('=').replace(/^"|"$/g, '')];
    })
);

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const torneoId = 'fa177f5b-3203-489a-a2fd-bdf74adb7f04';
  
  // Fetch tournament and registrations
  const { data: torneo } = await supabase.from('torneos').select('*').eq('id', torneoId).single();
  const { data: inscripciones } = await supabase
    .from('inscripciones')
    .select('id, jugador1:jugadores!inscripciones_jugador1_id_fkey(nombre, apellido), jugador2:jugadores!inscripciones_jugador2_id_fkey(nombre, apellido)')
    .eq('torneo_id', torneoId)
    .eq('estado', 'confirmada');

  const totalParejas = inscripciones.length;
  console.log(`Tournament: ${torneo.nombre}`);
  console.log(`Total couples (inscriptions): ${totalParejas}`);
  
  const plantilla = obtenerPlantilla(totalParejas);
  if (!plantilla) {
    console.log("No template found!");
    return;
  }
  console.log(`Template found for size ${plantilla.cantidad}. Matches count: ${plantilla.partidos.length}`);

  // Fetch zones and rankings to simulate resolution
  const { data: zonas } = await supabase.from('zonas').select('*').eq('torneo_id', torneoId).order('orden');
  const zoneIds = zonas?.map(z => z.id) || [];
  const { data: zonasParejas } = await supabase.from('zonas_parejas').select('*').in('zona_id', zoneIds);
  const { data: partidosZona } = await supabase.from('partidos_zona').select('*').in('zona_id', zoneIds);
  const { data: sets } = await supabase.from('sets_partido').select('*').in('partido_id', partidosZona.map(p => p.id));
  
  const setsZona = {};
  for (const s of sets || []) {
    if (!setsZona[s.partido_id]) setsZona[s.partido_id] = [];
    setsZona[s.partido_id].push(s);
  }

  // Calculate rankings
  const rankings = {};
  for (const z of zonas || []) {
    const partidosDeEstaZona = partidosZona.filter(p => p.zona_id === z.id);
    const estaFinalizada = partidosDeEstaZona.length > 0 && partidosDeEstaZona.every(p => p.estado === 'finalizado');
    
    // Even if not finalized, let's calculate ranking to see current standings
    const parejas = zonasParejas.filter(zp => zp.zona_id === z.id);
    const partidos = partidosDeEstaZona.map(p => ({
      id: p.id,
      tipo: p.tipo,
      pareja_local_id: p.pareja_local_id,
      pareja_visitante_id: p.pareja_visitante_id,
      ganador_id: p.ganador_id,
      estado: p.estado,
      sets: setsZona[p.id] || []
    }));
    
    const tabla = calcularTabla(
      parejas.map(zp => ({
        inscripcion_id: zp.inscripcion_id,
        posicion_siembra: zp.posicion_siembra
      })),
      partidos
    );
    
    rankings[z.nombre.trim()] = tabla.map(t => t.inscripcion_id);
  }

  // Print generated matches layout
  console.log("\nMatches layout simulation:");
  const firstRound = plantilla.partidos.filter(p => p.ronda === 'dieciseisavos' || p.ronda === 'previa');
  const parejaLabel = (id) => {
    if (!id) return 'BYE';
    const ins = inscripciones.find(x => x.id === id);
    if (!ins) return '?';
    return `${ins.jugador1?.apellido || '?'}/${ins.jugador2?.apellido || '?'}`;
  };

  for (const p of firstRound) {
    const localRef = parseRef(p.ref_local);
    const visitRef = parseRef(p.ref_visitante);
    
    let localName = p.ref_local;
    let visitName = p.ref_visitante;
    
    if (localRef.tipo === 'clasificado') {
      const rank = rankings[localRef.zona];
      const id = rank ? rank[localRef.posicion - 1] : null;
      localName = `${p.ref_local} (${parejaLabel(id)})`;
    }
    if (visitRef.tipo === 'clasificado') {
      const rank = rankings[visitRef.zona];
      const id = rank ? rank[visitRef.posicion - 1] : null;
      visitName = `${p.ref_visitante} (${parejaLabel(id)})`;
    }
    
    console.log(`Match ${p.numero}: ${localName} vs ${visitName}`);
  }
}

run();
