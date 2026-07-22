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

// Custom resolver from Llaves.tsx
function resolverRefSiFinalizada(ref, rankings) {
  if (!ref) return undefined;
  const parsed = parseRef(ref);
  if (parsed.tipo !== "clasificado") return undefined;

  const zonaNombreNorm = parsed.zona.trim().toUpperCase();
  const ranking = Object.entries(rankings).find(([nombre]) => {
    const n = nombre.trim().toUpperCase().replace(/ZONA\s+/i, "");
    return n === zonaNombreNorm;
  })?.[1];

  if (!ranking) return undefined;
  return ranking[parsed.posicion - 1] || null;
}

async function run() {
  const torneoId = 'fa177f5b-3203-489a-a2fd-bdf74adb7f04';
  
  // Fetch tournament and registrations
  const { data: torneo } = await supabase.from('torneos').select('*').eq('id', torneoId).single();
  const { data: inscripciones } = await supabase
    .from('inscripciones')
    .select('id')
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
  console.log(`Using template for size ${plantilla.cantidad}. Matches count: ${plantilla.partidos.length}`);

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
    
    if (estaFinalizada) {
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
  }

  // Let's delete any existing bracket to prevent duplicates
  const { data: existingLlaves } = await supabase.from('llaves').select('id').eq('torneo_id', torneoId);
  if (existingLlaves && existingLlaves.length > 0) {
    console.log(`Deleting existing ${existingLlaves.length} brackets...`);
    await supabase.from('llaves').delete().eq('torneo_id', torneoId);
  }

  // 1. Create llave record
  const { data: nuevaLlave, error: lErr } = await supabase
    .from("llaves")
    .insert({
      torneo_id: torneoId,
      tamanio_cuadro: plantilla.cantidad,
      cantidad_parejas: totalParejas,
    })
    .select()
    .single();

  if (lErr) {
    console.error("Error creating bracket:", lErr);
    return;
  }
  console.log("Bracket created successfully. ID:", nuevaLlave.id);

  // 2. Insert partidos
  const partidosToInsert = plantilla.partidos.map((p) => ({
    llave_id: nuevaLlave.id,
    numero: p.numero,
    ronda: p.ronda,
    ref_local: p.ref_local,
    ref_visitante: p.ref_visitante,
  }));

  const { data: partidosInsertados, error: pErr } = await supabase
    .from("partidos_llave")
    .insert(partidosToInsert)
    .select();

  if (pErr) {
    console.error("Error inserting bracket matches:", pErr);
    return;
  }
  console.log(`Inserted ${partidosInsertados.length} matches into database.`);

  // 3. Map match numbers to database IDs
  const numeroToId = new Map();
  partidosInsertados.forEach((p) => {
    numeroToId.set(p.numero, p.id);
  });

  // 4. Resolve references for finalized zones
  const updates = [];
  for (const p of partidosInsertados) {
    const localId = resolverRefSiFinalizada(p.ref_local, rankings);
    const visiId = resolverRefSiFinalizada(p.ref_visitante, rankings);
    
    if (localId !== undefined || visiId !== undefined) {
      const payload = {};
      if (localId !== undefined) payload.pareja_local_id = localId;
      if (visiId !== undefined) payload.pareja_visitante_id = visiId;
      
      updates.push(
        supabase.from("partidos_llave").update(payload).eq("id", p.id)
      );
    }
  }

  // 5. Connect matches
  for (const p of plantilla.partidos) {
    const localRef = parseRef(p.ref_local);
    const visiRef = parseRef(p.ref_visitante);
    
    if (localRef.tipo === "ganador") {
      const origenId = numeroToId.get(localRef.numeroPartido);
      if (origenId) {
        updates.push(
          supabase
            .from("partidos_llave")
            .update({
              partido_siguiente_id: numeroToId.get(p.numero),
              posicion_siguiente: "local",
            })
            .eq("id", origenId)
        );
      }
    }
    if (visiRef.tipo === "ganador") {
      const origenId = numeroToId.get(visiRef.numeroPartido);
      if (origenId) {
        updates.push(
          supabase
            .from("partidos_llave")
            .update({
              partido_siguiente_id: numeroToId.get(p.numero),
              posicion_siguiente: "visitante",
            })
            .eq("id", origenId)
        );
      }
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
    console.log(`Applied ${updates.length} updates for connections and/or finished zones.`);
  }

  console.log("Bracket generation completed successfully!");
}

run();
