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
      .select("id")
      .eq("torneo_id", torneoId);

    if (llaves && llaves.length > 0) {
      const llaveId = llaves[0].id;
      const { data: partidos } = await supabase
        .from("partidos_llave")
        .select(
          "id, ronda, pareja_local_id, pareja_visitante_id, ganador_id, estado"
        )
        .eq("llave_id", llaveId);

      // Para cada inscripción que estuvo en el cuadro, calcular su mejor ronda perdida
      // o si fue campeón
      const finales = (partidos ?? []).filter((p) => p.ronda === "final");
      const final = finales[0];

      // Campeón y subcampeón
      if (final && final.estado === "finalizado" && final.ganador_id) {
        inscripcionInstancia.set(final.ganador_id, "campeon");
        const perdedor =
          final.pareja_local_id === final.ganador_id
            ? final.pareja_visitante_id
            : final.pareja_local_id;
        if (perdedor) inscripcionInstancia.set(perdedor, "subcampeon");
      } else if (final) {
        // Si la final no está jugada, los dos finalistas (si los hay) cuentan como subcampeón mínimo
        if (final.pareja_local_id)
          inscripcionInstancia.set(final.pareja_local_id, "subcampeon");
        if (final.pareja_visitante_id)
          inscripcionInstancia.set(final.pareja_visitante_id, "subcampeon");
      }

      // Resto de rondas: para cada partido finalizado, el perdedor "cae" en esa ronda
      (partidos ?? [])
        .filter((p) => p.ronda !== "final" && p.estado === "finalizado" && p.ganador_id)
        .forEach((p) => {
          const perdedor =
            p.pareja_local_id === p.ganador_id
              ? p.pareja_visitante_id
              : p.pareja_local_id;
          if (!perdedor) return;
          const instancia = RONDA_A_INSTANCIA_PERDIDA[p.ronda as RondaLlave];
          // Solo asignar si no tiene una mejor ya
          const actual = inscripcionInstancia.get(perdedor);
          if (!actual || instanciaPeso(instancia) > instanciaPeso(actual)) {
            inscripcionInstancia.set(perdedor, instancia);
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
