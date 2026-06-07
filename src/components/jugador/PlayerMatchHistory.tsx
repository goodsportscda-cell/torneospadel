import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList, Calendar, Trophy, User } from "lucide-react";

type Props = {
  jugadorId: string;
};

type SetScore = {
  numero_set: number;
  games_local: number;
  games_visitante: number;
};

type MatchDisplay = {
  id: string;
  tipo: "zona" | "llave";
  nombreTorneo: string;
  fase: string; // ej: "Zona A" o "Octavos"
  fecha: string | null;
  companero: string;
  oponentes: string;
  sets: SetScore[];
  resultado: "V" | "D"; // Victoria o Derrota
};

export function PlayerMatchHistory({ jugadorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [partidos, setPartidos] = useState<MatchDisplay[]>([]);

  useEffect(() => {
    if (!jugadorId) return;

    const load = async () => {
      setLoading(true);
      try {
        // 1. Obtener mis inscripciones
        const { data: ins1 } = await supabase.from("inscripciones").select("id, jugador1_id, jugador2_id, torneo_id").eq("jugador1_id", jugadorId);
        const { data: ins2 } = await supabase.from("inscripciones").select("id, jugador1_id, jugador2_id, torneo_id").eq("jugador2_id", jugadorId);
        
        const misInscripciones = [...(ins1 ?? []), ...(ins2 ?? [])];
        const misInscripcionesIds = misInscripciones.map(i => i.id);

        if (misInscripcionesIds.length === 0) {
          setPartidos([]);
          setLoading(false);
          return;
        }

        const misInscripcionesMap = new Map(misInscripciones.map(i => [i.id, i]));

        // 2. Buscar partidos de zona (finalizados)
        const { data: pz1 } = await supabase
          .from("partidos_zona")
          .select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora, zona_id, estado")
          .in("pareja_local_id", misInscripcionesIds)
          .eq("estado", "finalizado");
        
        const { data: pz2 } = await supabase
          .from("partidos_zona")
          .select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora, zona_id, estado")
          .in("pareja_visitante_id", misInscripcionesIds)
          .eq("estado", "finalizado");

        // 3. Buscar partidos de llave (finalizados)
        const { data: pl1 } = await supabase
          .from("partidos_llave")
          .select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora, llave_id, ronda, estado")
          .in("pareja_local_id", misInscripcionesIds)
          .eq("estado", "finalizado");
        
        const { data: pl2 } = await supabase
          .from("partidos_llave")
          .select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora, llave_id, ronda, estado")
          .in("pareja_visitante_id", misInscripcionesIds)
          .eq("estado", "finalizado");

        // Unificar y deduplicar partidos
        const mapPartidos = new Map<string, any>();
        [...(pz1 ?? []), ...(pz2 ?? [])].forEach(p => mapPartidos.set(p.id, { ...p, tipo: "zona" }));
        [...(pl1 ?? []), ...(pl2 ?? [])].forEach(p => mapPartidos.set(p.id, { ...p, tipo: "llave" }));

        const rawPartidos = Array.from(mapPartidos.values());

        if (rawPartidos.length === 0) {
          setPartidos([]);
          setLoading(false);
          return;
        }

        // Obtener todos los IDs de inscripciones y torneos/zonas involucrados
        const todosInscripcionesIds = new Set<string>();
        const zonaIds = new Set<string>();
        const llaveIds = new Set<string>();
        const matchIds = rawPartidos.map(p => p.id);

        rawPartidos.forEach(p => {
          if (p.pareja_local_id) todosInscripcionesIds.add(p.pareja_local_id);
          if (p.pareja_visitante_id) todosInscripcionesIds.add(p.pareja_visitante_id);
          if (p.tipo === "zona" && p.zona_id) zonaIds.add(p.zona_id);
          if (p.tipo === "llave" && p.llave_id) llaveIds.add(p.llave_id);
        });

        // Cargar datos en paralelo para optimizar
        const [
          { data: dbInscripciones },
          { data: dbZonas },
          { data: dbLlaves },
          { data: dbSets }
        ] = await Promise.all([
          supabase.from("inscripciones").select("id, jugador1_id, jugador2_id, torneo_id").in("id", Array.from(todosInscripcionesIds)),
          supabase.from("zonas").select("id, nombre, torneo_id").in("id", Array.from(zonaIds)),
          supabase.from("llaves").select("id, torneo_id").in("id", Array.from(llaveIds)),
          supabase.from("sets_partido").select("*").or(`partido_id.in.(${matchIds.join(",")}),partido_llave_id.in.(${matchIds.join(",")})`)
        ]);

        // Mapear datos secundarios
        const inscripcionesMap = new Map(dbInscripciones?.map(i => [i.id, i]));
        const zonasMap = new Map(dbZonas?.map(z => [z.id, z]));
        const llavesMap = new Map(dbLlaves?.map(l => [l.id, l]));

        // Cargar nombres de torneos
        const torneoIds = new Set<string>();
        dbInscripciones?.forEach(i => torneoIds.add(i.torneo_id));
        const { data: dbTorneos } = await supabase.from("torneos").select("id, nombre").in("id", Array.from(torneoIds));
        const torneosMap = new Map(dbTorneos?.map(t => [t.id, t.nombre]));

        // Cargar nombres de jugadores
        const jugadorIds = new Set<string>();
        dbInscripciones?.forEach(i => {
          jugadorIds.add(i.jugador1_id);
          jugadorIds.add(i.jugador2_id);
        });
        const { data: dbJugadores } = await supabase.from("jugadores").select("id, nombre, apellido").in("id", Array.from(jugadorIds));
        const jugadoresMap = new Map(dbJugadores?.map(j => [j.id, `${j.nombre} ${j.apellido}`]));
        const jugadoresApellidoMap = new Map(dbJugadores?.map(j => [j.id, j.apellido]));

        // Mapear sets por partido ID
        const setsMap = new Map<string, SetScore[]>();
        dbSets?.forEach(s => {
          const key = s.partido_id || s.partido_llave_id;
          if (!key) return;
          const list = setsMap.get(key) ?? [];
          list.push({
            numero_set: s.numero_set,
            games_local: s.games_local,
            games_visitante: s.games_visitante
          });
          setsMap.set(key, list);
        });

        // Ordenar sets de cada partido
        setsMap.forEach((list) => {
          list.sort((a, b) => a.numero_set - b.numero_set);
        });

        // Formatear listado final
        const listaFormatted: MatchDisplay[] = rawPartidos.map((p) => {
          // Identificar si yo soy local o visitante
          const soyLocal = misInscripcionesIds.includes(p.pareja_local_id);
          const miInscId = soyLocal ? p.pareja_local_id : p.pareja_visitante_id;
          const suInscId = soyLocal ? p.pareja_visitante_id : p.pareja_local_id;

          const miInsc = inscripcionesMap.get(miInscId);
          const suInsc = inscripcionesMap.get(suInscId);

          // Nombre del torneo
          const tId = miInsc?.torneo_id || "";
          const nombreTorneo = torneosMap.get(tId) ?? "Torneo Desconocido";

          // Nombre de la fase
          let fase = "";
          if (p.tipo === "zona") {
            const z = zonasMap.get(p.zona_id);
            fase = z ? z.nombre : "Zona";
          } else {
            const l = llavesMap.get(p.llave_id);
            const rondaFormat = p.ronda === "previa" ? "Ronda Previa" :
                                p.ronda === "dieciseisavos" ? "1/16 Final" :
                                p.ronda === "octavos" ? "Octavos" :
                                p.ronda === "cuartos" ? "Cuartos" :
                                p.ronda === "semifinal" ? "Semifinal" : "Final";
            fase = rondaFormat;
          }

          // Resolver compañero
          let companero = "—";
          if (miInsc) {
            const companeroId = miInsc.jugador1_id === jugadorId ? miInsc.jugador2_id : miInsc.jugador1_id;
            companero = jugadoresMap.get(companeroId) ?? "—";
          }

          // Resolver oponentes
          let oponentes = "—";
          if (suInsc) {
            const o1 = jugadoresApellidoMap.get(suInsc.jugador1_id) ?? "?";
            const o2 = jugadoresApellidoMap.get(suInsc.jugador2_id) ?? "?";
            oponentes = `${o1} / ${o2}`;
          }

          // Sets score
          const matchSets = setsMap.get(p.id) ?? [];

          // Resultado (Victoria/Derrota)
          const ganeYo = p.ganador_id === miInscId;
          const resultado = ganeYo ? "V" : "D";

          return {
            id: p.id,
            tipo: p.tipo,
            nombreTorneo,
            fase,
            fecha: p.fecha_hora,
            companero,
            oponentes,
            sets: matchSets,
            resultado
          };
        });

        // Ordenar cronológicamente (más recientes primero)
        listaFormatted.sort((a, b) => {
          if (!a.fecha) return 1;
          if (!b.fecha) return -1;
          return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        setPartidos(listaFormatted);
      } catch (error) {
        console.error("Error al cargar historial de partidos:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [jugadorId]);

  const fmtFecha = (iso: string | null) => {
    if (!iso) return "Sin fecha";
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short"
    });
  };

  if (loading) {
    return (
      <Card className="h-48 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (partidos.length === 0) {
    return null;
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Mi Historial de Partidos
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {partidos.map((p) => {
            const won = p.resultado === "V";
            return (
              <div 
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border hover:bg-muted/30 transition-colors text-sm"
              >
                {/* Resultado Badge Lateral */}
                <div 
                  className={`w-1 h-10 rounded-full shrink-0 ${
                    won ? "bg-green-500" : "bg-destructive"
                  }`}
                />

                {/* Detalles de Match */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-xs font-bold text-muted-foreground truncate max-w-[170px]">
                      {p.nombreTorneo}
                    </p>
                    <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                      <Calendar className="h-2.5 w-2.5" />
                      {fmtFecha(p.fecha)}
                    </span>
                  </div>
                  
                  {/* Oponentes y Compañero */}
                  <p className="font-bold text-foreground mt-0.5 truncate">
                    vs {p.oponentes}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <User className="h-3 w-3 shrink-0" /> con {p.companero}
                  </p>
                </div>

                {/* Marcador de Sets y Estado */}
                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                  <Badge 
                    variant={won ? "default" : "secondary"} 
                    className={`text-[10px] h-5 px-1.5 font-bold ${
                      won ? "bg-green-600 hover:bg-green-600" : "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/10"
                    }`}
                  >
                    {won ? "Victoria" : "Derrota"}
                  </Badge>
                  <div className="flex gap-1 font-mono text-xs">
                    {p.sets.length > 0 ? (
                      p.sets.map((s, idx) => (
                        <span 
                          key={idx} 
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            s.games_local > s.games_visitante 
                              ? (p.resultado === "V" ? "bg-green-500/10 text-green-600 font-extrabold" : "bg-muted text-muted-foreground")
                              : (p.resultado === "D" ? "bg-green-500/10 text-green-600 font-extrabold" : "bg-muted text-muted-foreground")
                          }`}
                        >
                          {p.resultado === "V" ? `${s.games_local}-${s.games_visitante}` : `${s.games_visitante}-${s.games_local}`}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">S/D</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
