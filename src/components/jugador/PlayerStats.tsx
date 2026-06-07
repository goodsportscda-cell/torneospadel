import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Target, Trophy, Flame, ShieldAlert, Handshake, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  jugadorId: string;
};

type PartidoJugado = {
  id: string;
  ganador_id: string | null;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  fecha_hora: string | null;
  tipo: "zona" | "llave";
};

export function PlayerStats({ jugadorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    jugados: 0,
    ganados: 0,
    winRate: 0,
    forma: [] as ("V" | "D")[],
    streak: 0,
    setsGanados: 0,
    setsPerdidos: 0,
    gamesGanados: 0,
    gamesPerdidos: 0,
    mejorCompanero: null as string | null,
    nemesis: null as string | null,
  });

  useEffect(() => {
    if (!jugadorId) return;

    const cargar = async () => {
      setLoading(true);
      try {
        // 1. Obtener todas las inscripciones del jugador
        const { data: ins1 } = await supabase.from("inscripciones").select("id, jugador1_id, jugador2_id, torneo_id").eq("jugador1_id", jugadorId);
        const { data: ins2 } = await supabase.from("inscripciones").select("id, jugador1_id, jugador2_id, torneo_id").eq("jugador2_id", jugadorId);
        
        const misInscripciones = [...(ins1 ?? []), ...(ins2 ?? [])];
        const misInscripcionesIds = misInscripciones.map(i => i.id);

        if (misInscripcionesIds.length === 0) {
          setLoading(false);
          return;
        }

        // Map para buscar rápidamente mi inscripción y saber con quién jugué
        const misInscripcionesMap = new Map(misInscripciones.map(i => [i.id, i]));

        // 2. Buscar partidos finalizados
        const { data: pz1 } = await supabase.from("partidos_zona").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora").in("pareja_local_id", misInscripcionesIds).eq("estado", "finalizado");
        const { data: pz2 } = await supabase.from("partidos_zona").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora").in("pareja_visitante_id", misInscripcionesIds).eq("estado", "finalizado");
        const { data: pl1 } = await supabase.from("partidos_llave").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora").in("pareja_local_id", misInscripcionesIds).eq("estado", "finalizado");
        const { data: pl2 } = await supabase.from("partidos_llave").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora").in("pareja_visitante_id", misInscripcionesIds).eq("estado", "finalizado");

        // Deduplicar partidos por ID
        const uniquePartidosMap = new Map<string, PartidoJugado>();
        [...(pz1 || []), ...(pz2 || [])].forEach(p => uniquePartidosMap.set(p.id, { ...p, tipo: "zona" }));
        [...(pl1 || []), ...(pl2 || [])].forEach(p => uniquePartidosMap.set(p.id, { ...p, tipo: "llave" }));
        const partidos = Array.from(uniquePartidosMap.values());

        if (partidos.length === 0) {
          setLoading(false);
          return;
        }

        // Ordenar por fecha: Más recientes primero
        partidos.sort((a, b) => {
          if (!a.fecha_hora) return 1;
          if (!b.fecha_hora) return -1;
          return new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime();
        });

        // 3. Buscar todos los sets jugados por estos partidos
        const matchIds = partidos.map(p => p.id);
        const { data: dbSets } = await supabase
          .from("sets_partido")
          .select("*")
          .or(`partido_id.in.(${matchIds.join(",")}),partido_llave_id.in.(${matchIds.join(",")})`);

        const setsMap = new Map<string, any[]>();
        dbSets?.forEach(s => {
          const key = s.partido_id || s.partido_llave_id;
          if (!key) return;
          const list = setsMap.get(key) ?? [];
          list.push(s);
          setsMap.set(key, list);
        });

        // 4. Buscar inscripciones de los rivales para poder computar compañeros y rivales
        const rivalesInscripcionesIds = new Set<string>();
        partidos.forEach(p => {
          if (p.pareja_local_id && !misInscripcionesIds.includes(p.pareja_local_id)) rivalesInscripcionesIds.add(p.pareja_local_id);
          if (p.pareja_visitante_id && !misInscripcionesIds.includes(p.pareja_visitante_id)) rivalesInscripcionesIds.add(p.pareja_visitante_id);
        });

        const { data: dbRivalesInscripciones } = await supabase
          .from("inscripciones")
          .select("id, jugador1_id, jugador2_id")
          .in("id", Array.from(rivalesInscripcionesIds));
        const rivalesInscripcionesMap = new Map(dbRivalesInscripciones?.map(i => [i.id, i]));

        // 5. Cálculos de estadísticas
        let ganados = 0;
        let setsGanados = 0;
        let setsPerdidos = 0;
        let gamesGanados = 0;
        let gamesPerdidos = 0;
        const forma: ("V" | "D")[] = [];

        // Para racha (streak)
        let streak = 0;
        let streakActive = true;

        // Para Compañeros y Rivales
        const companerosStats = new Map<string, { ganados: number; jugados: number }>();
        const rivalesStats = new Map<string, { perdidosParaMi: number; jugados: number }>(); // partidos perdidos por el rival (victorias mías)

        partidos.forEach((p, idx) => {
          const soyLocal = misInscripcionesIds.includes(p.pareja_local_id);
          const miInscId = soyLocal ? p.pareja_local_id : p.pareja_visitante_id;
          const suInscId = soyLocal ? p.pareja_visitante_id : p.pareja_local_id;

          const gano = p.ganador_id === miInscId;
          
          if (gano) {
            ganados++;
            if (streakActive) streak++;
          } else {
            streakActive = false;
          }

          if (idx < 5) {
            forma.unshift(gano ? "V" : "D"); // El más reciente a la derecha
          }

          // Computar sets y games
          const matchSets = setsMap.get(p.id) ?? [];
          matchSets.forEach(s => {
            const gamesYo = soyLocal ? s.games_local : s.games_visitante;
            const gamesRival = soyLocal ? s.games_visitante : s.games_local;

            gamesGanados += gamesYo;
            gamesPerdidos += gamesRival;

            if (gamesYo > gamesRival) {
              setsGanados++;
            } else if (gamesRival > gamesYo) {
              setsPerdidos++;
            }
          });

          // Compañeros Stats
          const miInsc = misInscripcionesMap.get(miInscId!);
          if (miInsc) {
            const companeroId = miInsc.jugador1_id === jugadorId ? miInsc.jugador2_id : miInsc.jugador1_id;
            const cStat = companerosStats.get(companeroId) ?? { ganados: 0, jugados: 0 };
            cStat.jugados++;
            if (gano) cStat.ganados++;
            companerosStats.set(companeroId, cStat);
          }

          // Rivales Stats
          const suInsc = rivalesInscripcionesMap.get(suInscId!);
          if (suInsc) {
            [suInsc.jugador1_id, suInsc.jugador2_id].forEach(rId => {
              const rStat = rivalesStats.get(rId) ?? { perdidosParaMi: 0, jugados: 0 };
              rStat.jugados++;
              if (gano) rStat.perdidosParaMi++; // si gané yo, el rival perdió contra mí
              rivalesStats.set(rId, rStat);
            });
          }
        });

        // Encontrar mejor compañero (mínimo 2 partidos)
        let mejorCompaneroId: string | null = null;
        let maxCompWinRate = -1;
        companerosStats.forEach((stat, id) => {
          if (stat.jugados >= 2) {
            const rate = stat.ganados / stat.jugados;
            if (rate > maxCompWinRate) {
              maxCompWinRate = rate;
              mejorCompaneroId = id;
            }
          }
        });

        // Encontrar Némesis (contra quien perdí más porcentaje de veces, mínimo 2 partidos)
        // Significa que el rival tiene alto perdidosParaMi de 0 (o sea, ganó él). Buscamos el menor rate de victorias mías.
        let nemesisId: string | null = null;
        let minMyWinRate = 2; // inicializar arriba de 1
        rivalesStats.forEach((stat, id) => {
          if (stat.jugados >= 2) {
            const myWinRate = stat.perdidosParaMi / stat.jugados;
            if (myWinRate < minMyWinRate) {
              minMyWinRate = myWinRate;
              nemesisId = id;
            }
          }
        });

        // Resolver nombres de jugadores destacados en paralelo
        const idsResolving = [mejorCompaneroId, nemesisId].filter(Boolean) as string[];
        let mejorCompaneroNombre: string | null = null;
        let nemesisNombre: string | null = null;

        if (idsResolving.length > 0) {
          const { data: dbNombres } = await supabase
            .from("jugadores")
            .select("id, nombre, apellido")
            .in("id", idsResolving);

          dbNombres?.forEach(j => {
            const fullName = `${j.nombre} ${j.apellido}`;
            if (j.id === mejorCompaneroId) mejorCompaneroNombre = fullName;
            if (j.id === nemesisId) nemesisNombre = fullName;
          });
        }

        const jugados = partidos.length;
        const winRate = jugados > 0 ? Math.round((ganados / jugados) * 100) : 0;

        setStats({
          jugados,
          ganados,
          winRate,
          forma,
          streak,
          setsGanados,
          setsPerdidos,
          gamesGanados,
          gamesPerdidos,
          mejorCompanero: mejorCompaneroNombre,
          nemesis: nemesisNombre,
        });

      } catch (error) {
        console.error("Error al cargar estadísticas avanzadas:", error);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [jugadorId]);

  if (loading) {
    return <div className="animate-pulse h-32 bg-muted rounded-xl"></div>;
  }

  if (stats.jugados === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Tarjetas Principales de Rendimiento */}
      <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Mi Rendimiento Global
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center justify-center p-3 bg-card rounded-lg border shadow-sm">
              <Trophy className="h-5 w-5 text-amber-500 mb-1" />
              <span className="text-2xl font-black">{stats.ganados}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Victorias</span>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-card rounded-lg border shadow-sm">
              <Target className="h-5 w-5 text-blue-500 mb-1" />
              <span className="text-2xl font-black">{stats.jugados}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Partidos</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 bg-primary/15 rounded-lg border border-primary/30 shadow-sm col-span-2 md:col-span-1">
              <Percent className="h-5 w-5 text-primary mb-1" />
              <span className="text-2xl font-black text-primary">{stats.winRate}%</span>
              <span className="text-[10px] text-primary/80 uppercase font-bold tracking-wider">Win Rate</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 bg-card rounded-lg border shadow-sm col-span-2 md:col-span-1">
              <span className="text-sm font-bold mb-2">Últimos 5</span>
              <div className="flex gap-1.5">
                {stats.forma.length > 0 ? (
                  stats.forma.map((r, i) => (
                    <Badge 
                      key={i} 
                      variant={r === "V" ? "default" : "secondary"}
                      className={`w-6 h-6 p-0 flex items-center justify-center text-[10px] font-black ${
                        r === "V" ? "bg-green-600 hover:bg-green-600 text-white" : ""
                      }`}
                    >
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1.5">Forma</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Racha y Sets / Destacados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estadísticas de Sets, Games y Racha */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
              Estadísticas de Juego y Racha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {/* Racha Actual */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-950/35">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-600 fill-current" />
                <span className="text-sm font-semibold text-orange-900 dark:text-orange-300">Racha Actual</span>
              </div>
              <span className="text-xl font-black text-orange-600">{stats.streak} {stats.streak === 1 ? 'partido' : 'partidos'}</span>
            </div>

            {/* Sets y Games */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg border">
                <p className="text-muted-foreground uppercase font-bold text-[9px] tracking-wider mb-1">Sets Jugados</p>
                <p className="text-sm font-bold">
                  {stats.setsGanados}G / {stats.setsPerdidos}P
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Diferencia: {stats.setsGanados - stats.setsPerdidos >= 0 ? "+" : ""}{stats.setsGanados - stats.setsPerdidos}
                </p>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg border">
                <p className="text-muted-foreground uppercase font-bold text-[9px] tracking-wider mb-1">Games (Puntos de set)</p>
                <p className="text-sm font-bold">
                  {stats.gamesGanados} / {stats.gamesPerdidos}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Diferencia: {stats.gamesGanados - stats.gamesPerdidos >= 0 ? "+" : ""}{stats.gamesGanados - stats.gamesPerdidos}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Destacados (Compañero y Némesis) */}
        {(stats.mejorCompanero || stats.nemesis) ? (
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Compañeros y Rivales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {stats.mejorCompanero && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                  <div className="bg-green-100 dark:bg-green-950/20 p-1.5 rounded-md text-green-600 shrink-0">
                    <Handshake className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Compañero Ideal</p>
                    <p className="text-sm font-bold truncate text-foreground">{stats.mejorCompanero}</p>
                  </div>
                </div>
              )}

              {stats.nemesis && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                  <div className="bg-destructive/10 p-1.5 rounded-md text-destructive shrink-0">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Némesis (Rival más difícil)</p>
                    <p className="text-sm font-bold truncate text-foreground">{stats.nemesis}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-dashed flex items-center justify-center p-6 text-center text-xs text-muted-foreground">
            Disputa más partidos con diferentes compañeros y rivales para habilitar la sección de química y destacados.
          </Card>
        )}
      </div>
    </div>
  );
}
