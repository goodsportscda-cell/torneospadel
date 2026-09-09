import { supabase } from "@/integrations/supabase/client";

export type Instancia =
  | "campeon"
  | "subcampeon"
  | "semifinal"
  | "cuartos"
  | "octavos"
  | "dieciseisavos"
  | "treintaidosavos"
  | "zona";

export const INSTANCIA_LABEL: Record<Instancia, string> = {
  campeon: "Campeón",
  subcampeon: "Subcampeón",
  semifinal: "Semifinal",
  cuartos: "Cuartos",
  octavos: "Octavos",
  dieciseisavos: "16avos",
  treintaidosavos: "32avos",
  zona: "Fase de zona",
};

type RondaLlave =
  | "previa"
  | "dieciseisavos"
  | "octavos"
  | "cuartos"
  | "semifinal"
  | "final";

// Mapeo de ronda perdida a instancia para puntaje

const RONDA_A_INSTANCIA_PERDIDA: Record<RondaLlave, Instancia> = {
  previa: "treintaidosavos",
  dieciseisavos: "dieciseisavos",
  octavos: "octavos",
  cuartos: "cuartos",
  semifinal: "semifinal",
  final: "subcampeon",
};

const RONDA_A_INSTANCIA_GANADA: Record<RondaLlave, Instancia> = {
  previa: "dieciseisavos",
  dieciseisavos: "octavos",
  octavos: "cuartos",
  cuartos: "semifinal",
  semifinal: "subcampeon",
  final: "campeon",
};

/**
 * Calcula y guarda los puntos de ranking para todos los jugadores
 * de un torneo finalizado. Borra puntos previos del torneo y los recalcula.
 */
export async function calcularRankingTorneo(torneoId: string): Promise<{
  ok: boolean;
  jugadoresConPuntos: number;
  error?: string;
}> {
  try {
    // 1. Datos del torneo
    const { data: torneo, error: errT } = await supabase
      .from("torneos")
      .select("id, fecha_inicio, categoria_id, genero, categoria_libre, tipo, numero_fecha, multiplicador_puntos")
      .eq("id", torneoId)
      .maybeSingle();
    if (errT) throw errT;
    if (!torneo) throw new Error("Torneo no encontrado");

    const anio = new Date(torneo.fecha_inicio).getFullYear();

    // 1b. Resolver género desde la categoría si el torneo no lo tiene seteado
    let generoTorneo: string | null = torneo.genero ?? null;
    if (!generoTorneo && torneo.categoria_id) {
      const { data: cat } = await supabase
        .from("categorias")
        .select("genero")
        .eq("id", torneo.categoria_id)
        .maybeSingle();
      if (cat?.genero) generoTorneo = cat.genero;
    }

    // Multiplicador (default 1, fecha 4 suele ser 2)
    const multiplicador = Number(torneo.multiplicador_puntos ?? 1) || 1;

    // 2. Cargar tabla de puntos
    const { data: puntosCfg, error: errP } = await supabase
      .from("puntos_ranking")
      .select("instancia, puntos");
    if (errP) throw errP;
    const puntosMap = new Map<string, number>();
    (puntosCfg ?? []).forEach((p) => puntosMap.set(p.instancia, p.puntos));

    // 3. Inscripciones del torneo (parejas) con jugadores
    const { data: inscripciones, error: errI } = await supabase
      .from("inscripciones")
      .select("id, jugador1_id, jugador2_id")
      .eq("torneo_id", torneoId);
    if (errI) throw errI;

    const inscripcionToJugadores = new Map<string, [string, string]>();
    (inscripciones ?? []).forEach((i) =>
      inscripcionToJugadores.set(i.id, [i.jugador1_id, i.jugador2_id])
    );

    // 4. Determinar instancia alcanzada por cada inscripción
    const inscripcionInstancia = new Map<string, Instancia>();

    // 4a. Llaves del torneo
    const { data: llaves } = await supabase
      .from("llaves")
      .select("id, created_at")
      .eq("torneo_id", torneoId)
      .order("created_at", { ascending: false });

    let llaveId = null;
    let partidos: any[] | null = null;

    if (llaves && llaves.length > 0) {
      for (const ll of llaves) {
        const { data: p } = await supabase
          .from("partidos_llave")
          .select("id, ronda, pareja_local_id, pareja_visitante_id, ganador_id, estado, partido_siguiente_id")
          .eq("llave_id", ll.id);
        
        if (p && p.length > 0) {
          llaveId = ll.id;
          partidos = p;
          break;
        }
      }
    }

    if (llaveId && partidos) {
      const partidoMap = new Map();
      partidos.forEach((p) => partidoMap.set(p.id, p));

      partidos
        .filter((p) => p.estado === "finalizado" && p.ganador_id)
        .forEach((p) => {
          // Asignar al perdedor
          const perdedor =
            p.pareja_local_id === p.ganador_id
              ? p.pareja_visitante_id
              : p.pareja_local_id;
          
          if (perdedor) {
            let instanciaPerdida = RONDA_A_INSTANCIA_PERDIDA[p.ronda as RondaLlave];
            if (p.ronda === "previa") {
              const sig = partidoMap.get(p.partido_siguiente_id);
              if (sig) {
                if (sig.ronda === "octavos") instanciaPerdida = "dieciseisavos";
                else if (sig.ronda === "cuartos") instanciaPerdida = "octavos";
                else if (sig.ronda === "semifinal") instanciaPerdida = "cuartos";
              }
            }
            const actual = inscripcionInstancia.get(perdedor);
            if (!actual || instanciaPeso(instanciaPerdida) > instanciaPeso(actual)) {
              inscripcionInstancia.set(perdedor, instanciaPerdida);
            }
          }

          // Asignar al ganador
          let instanciaGanada = RONDA_A_INSTANCIA_GANADA[p.ronda as RondaLlave];
          if (p.ronda === "previa") {
            const sig = partidoMap.get(p.partido_siguiente_id);
            if (sig) {
              if (sig.ronda === "octavos") instanciaGanada = "octavos";
              else if (sig.ronda === "cuartos") instanciaGanada = "cuartos";
              else if (sig.ronda === "semifinal") instanciaGanada = "semifinal";
            }
          }
          const actualG = inscripcionInstancia.get(p.ganador_id);
          if (!actualG || instanciaPeso(instanciaGanada) > instanciaPeso(actualG)) {
             inscripcionInstancia.set(p.ganador_id, instanciaGanada);
          }
        });
    }

    // 4b. Las inscripciones que NO llegaron al cuadro → "zona"
    (inscripciones ?? []).forEach((i) => {
      if (!inscripcionInstancia.has(i.id)) {
        inscripcionInstancia.set(i.id, "zona");
      }
    });

    // 5. Borrar puntos previos del torneo
    await supabase.from("ranking_jugadores").delete().eq("torneo_id", torneoId);

    // 6. Insertar puntos por jugador
    const filas: {
      jugador_id: string;
      torneo_id: string;
      inscripcion_id: string;
      instancia: Instancia;
      puntos: number;
      anio: number;
      categoria_id: string | null;
      genero: string | null;
    }[] = [];

    for (const [inscId, instancia] of inscripcionInstancia.entries()) {
      const jugadores = inscripcionToJugadores.get(inscId);
      if (!jugadores) continue;
      const puntosBase = puntosMap.get(instancia) ?? 0;
      const puntos = Math.round(puntosBase * multiplicador);
      jugadores.forEach((jugadorId) => {
        filas.push({
          jugador_id: jugadorId,
          torneo_id: torneoId,
          inscripcion_id: inscId,
          instancia,
          puntos,
          anio,
          categoria_id: torneo.categoria_id,
          genero: generoTorneo,
        });
      });
    }

    if (filas.length > 0) {
      const { error: errIns } = await supabase
        .from("ranking_jugadores")
        .insert(filas);
      if (errIns) throw errIns;
    }

    // Recalcular todos los ascensos del año para mantener puntos transferidos consistentes
    await recalcularTodosLosAscensos(anio);

    return { ok: true, jugadoresConPuntos: filas.length };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      jugadoresConPuntos: 0,
      error: e instanceof Error ? e.message : "Error desconocido",
    };
  }
}

export async function recalcularTodosLosAscensos(anio: number): Promise<void> {
  try {
    // 1. Obtener todos los ascensos de este año ordenados cronológicamente
    const { data: ascensos, error: errA } = await supabase
      .from("ascensos")
      .select("id, jugador_id, categoria_origen_id, categoria_destino_id")
      .eq("anio", anio)
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true });

    if (errA) throw errA;
    if (!ascensos || ascensos.length === 0) return;

    // 2. Obtener todos los puntos de ranking_jugadores del año
    const { data: rankingData, error: errR } = await supabase
      .from("ranking_jugadores")
      .select("jugador_id, categoria_id, puntos")
      .eq("anio", anio);

    if (errR) throw errR;

    // Mapa de puntos acumulados por jugador y categoría: Map<jugador_id, Map<categoria_id, puntos>>
    const puntosPorJugador = new Map<string, Map<string, number>>();

    // Poblar con los puntos base de torneos
    (rankingData ?? []).forEach((r) => {
      if (!r.categoria_id) return;
      if (!puntosPorJugador.has(r.jugador_id)) {
        puntosPorJugador.set(r.jugador_id, new Map());
      }
      const catMap = puntosPorJugador.get(r.jugador_id)!;
      catMap.set(r.categoria_id, (catMap.get(r.categoria_id) ?? 0) + r.puntos);
    });

    // 3. Procesar ascensos cronológicamente actualizando los puntos transferidos
    for (const asc of ascensos) {
      const pId = asc.jugador_id;
      const catOrig = asc.categoria_origen_id;
      const catDest = asc.categoria_destino_id;

      // Puntos actuales en la categoría origen (torneos + posibles transferencias previas)
      const catMap = puntosPorJugador.get(pId) ?? new Map<string, number>();
      const ptsOrigen = catMap.get(catOrig) ?? 0;
      const ptsTransferidos = Math.floor(ptsOrigen / 2);

      // Actualizar en la base de datos
      const { error: errUpd } = await supabase
        .from("ascensos")
        .update({
          puntos_origen: ptsOrigen,
          puntos_transferidos: ptsTransferidos,
        })
        .eq("id", asc.id);

      if (errUpd) {
        console.error(`Error al recalcular ascenso ${asc.id}:`, errUpd);
      }

      // Sumar los puntos transferidos a la categoría destino para futuros ascensos encadenados
      if (!puntosPorJugador.has(pId)) {
        puntosPorJugador.set(pId, new Map());
      }
      const destCatMap = puntosPorJugador.get(pId)!;
      destCatMap.set(catDest, (destCatMap.get(catDest) ?? 0) + ptsTransferidos);
    }
  } catch (err) {
    console.error("Error en recalcularTodosLosAscensos:", err);
  }
}


function instanciaPeso(i: Instancia): number {
  const orden: Instancia[] = [
    "zona",
    "treintaidosavos",
    "dieciseisavos",
    "octavos",
    "cuartos",
    "semifinal",
    "subcampeon",
    "campeon",
  ];
  return orden.indexOf(i);
}
