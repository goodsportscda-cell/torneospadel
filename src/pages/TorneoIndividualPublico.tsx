import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Trophy,
  Calendar,
  Users,
  DollarSign,
  ArrowLeft,
  Award,
  CalendarDays,
  Globe,
  FileText,
  UserCheck,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];
type TorneoJugador = Database["public"]["Tables"]["torneo_individual_jugadores"]["Row"] & { jugador?: Jugador };
type PartidoInd = Database["public"]["Tables"]["partidos_individuales"]["Row"] & {
  jugador1?: Jugador | null;
  jugador2?: Jugador | null;
  jugador3?: Jugador | null;
  jugador4?: Jugador | null;
  sets?: SetPartidoInd[];
};
type SetPartidoInd = Database["public"]["Tables"]["sets_partido_individual"]["Row"];
type TorneoFecha = Database["public"]["Tables"]["torneo_individual_fechas"]["Row"];
type TorneoPago = Database["public"]["Tables"]["torneo_individual_pagos"]["Row"];

interface PlayerStanding {
  jugador_id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  club: string | null;
  puntos: number;
  setsGanados: number;
  setsPerdidos: number;
  gamesGanados: number;
  gamesPerdidos: number;
  difGames: number;
  partidosJugados: number;
}

export default function TorneoIndividualPublico() {
  const { id } = useParams<{ id: string }>();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [loading, setLoading] = useState(true);

  // Data lists
  const [jugadoresInscriptos, setJugadoresInscriptos] = useState<TorneoJugador[]>([]);
  const [fechas, setFechas] = useState<TorneoFecha[]>([]);
  const [pagos, setPagos] = useState<TorneoPago[]>([]);
  const [partidos, setPartidos] = useState<PartidoInd[]>([]);
  const [standings, setStandings] = useState<PlayerStanding[]>([]);

  // Active selections
  const [activeTab, setActiveTab] = useState("ranking");
  const [selectedFechaNum, setSelectedFechaNum] = useState<number>(1);

  const fetchTournamentData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [
        { data: tRes },
        { data: tjRes },
        { data: fRes },
        { data: pRes },
        { data: partRes },
      ] = await Promise.all([
        supabase.from("torneos").select("*").eq("id", id).maybeSingle(),
        supabase.from("torneo_individual_jugadores").select("*, jugador:jugadores(*)").eq("torneo_id", id),
        supabase.from("torneo_individual_fechas").select("*").eq("torneo_id", id).order("fecha"),
        supabase.from("torneo_individual_pagos").select("*").eq("torneo_id", id),
        supabase.from("partidos_individuales").select("*").eq("torneo_id", id),
      ]);

      if (!tRes) {
        toast.error("No se encontró el torneo");
        return;
      }

      setTorneo(tRes);
      setJugadoresInscriptos((tjRes as TorneoJugador[]) ?? []);
      setFechas(fRes ?? []);
      setPagos(pRes ?? []);

      // Fetch sets for each match
      if (partRes && partRes.length > 0) {
        const pIds = partRes.map((p) => p.id);
        const { data: setsRes } = await supabase
          .from("sets_partido_individual")
          .select("*")
          .in("partido_individual_id", pIds)
          .order("numero_set");

        const setsMap: Record<string, SetPartidoInd[]> = {};
        (setsRes ?? []).forEach((s) => {
          if (!setsMap[s.partido_individual_id]) setsMap[s.partido_individual_id] = [];
          setsMap[s.partido_individual_id].push(s);
        });

        const fullPartidos: PartidoInd[] = partRes.map((p) => ({
          ...p,
          jugador1: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador1_id)?.jugador ?? null,
          jugador2: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador2_id)?.jugador ?? null,
          jugador3: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador3_id)?.jugador ?? null,
          jugador4: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador4_id)?.jugador ?? null,
          sets: setsMap[p.id] ?? [],
        }));

        setPartidos(fullPartidos);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Error al cargar los datos del torneo: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTournamentData();
  }, [fetchTournamentData]);

  // Set default view date based on latest completed date
  useEffect(() => {
    if (fechas.length > 0) {
      const activeFechas = fechas.filter((f) => f.estado === "completada" || f.estado === "pendiente");
      if (activeFechas.length > 0) {
        // Show current week if pending, otherwise show the latest played
        const currentPending = activeFechas.find((f) => f.estado === "pendiente");
        if (currentPending) {
          setSelectedFechaNum(currentPending.fecha);
        } else {
          setSelectedFechaNum(activeFechas[activeFechas.length - 1].fecha);
        }
      }
    }
  }, [fechas]);

  // Standing Ranking calculation
  const computedStandings = useMemo((): PlayerStanding[] => {
    if (!torneo) return [];
    const countCanchas = torneo.canchas_count ?? 3;

    const standingsMap = new Map<string, PlayerStanding>();
    jugadoresInscriptos.forEach((tj) => {
      if (tj.jugador) {
        standingsMap.set(tj.jugador_id, {
          jugador_id: tj.jugador_id,
          nombre: tj.jugador.nombre,
          apellido: tj.jugador.apellido,
          dni: tj.jugador.dni,
          club: tj.jugador.club,
          puntos: 0,
          setsGanados: 0,
          setsPerdidos: 0,
          gamesGanados: 0,
          gamesPerdidos: 0,
          difGames: 0,
          partidosJugados: 0,
        });
      }
    });

    const finalizedMatches = partidos.filter((p) => p.estado === "finalizado");

    finalizedMatches.forEach((p) => {
      const canchaNumMatch = p.cancha.match(/\d+/);
      const courtIndex = canchaNumMatch ? parseInt(canchaNumMatch[0], 10) : 1;

      const ptsWinner = countCanchas - courtIndex + 2;
      const ptsLoser = 1;

      const setsWinner = Math.max(p.sets_pareja1, p.sets_pareja2);
      const setsLoser = Math.min(p.sets_pareja1, p.sets_pareja2);

      let gamesP1 = 0;
      let gamesP2 = 0;
      p.sets?.forEach((s) => {
        gamesP1 += s.games_pareja1;
        gamesP2 += s.games_pareja2;
      });

      const p1Won = p.sets_pareja1 > p.sets_pareja2;

      const awardStats = (
        jugId: string | null,
        isWinner: boolean,
        wasAbsent: boolean,
        gamesOwn: number,
        gamesOpp: number,
        setsOwn: number,
        setsOpp: number
      ) => {
        if (!jugId) return;
        const s = standingsMap.get(jugId);
        if (!s) return;

        s.partidosJugados++;
        if (wasAbsent) {
          s.puntos += 0;
        } else {
          s.puntos += isWinner ? ptsWinner : ptsLoser;
          s.setsGanados += setsOwn;
          s.setsPerdidos += setsOpp;
          s.gamesGanados += gamesOwn;
          s.gamesPerdidos += gamesOpp;
        }
      };

      awardStats(p.jugador1_id, p1Won, !!p.suplente1_nombre, gamesP1, gamesP2, p.sets_pareja1, p.sets_pareja2);
      awardStats(p.jugador2_id, p1Won, !!p.suplente2_nombre, gamesP1, gamesP2, p.sets_pareja1, p.sets_pareja2);
      awardStats(p.jugador3_id, !p1Won, !!p.suplente3_nombre, gamesP2, gamesP1, p.sets_pareja2, p.sets_pareja1);
      awardStats(p.jugador4_id, !p1Won, !!p.suplente4_nombre, gamesP2, gamesP1, p.sets_pareja2, p.sets_pareja1);
    });

    const list = Array.from(standingsMap.values()).map((s) => ({
      ...s,
      difGames: s.gamesGanados - s.gamesPerdidos,
    }));

    list.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.setsGanados !== a.setsGanados) return b.setsGanados - a.setsGanados;
      if (b.difGames !== a.difGames) return b.difGames - a.difGames;
      return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`);
    });

    return list;
  }, [torneo, jugadoresInscriptos, partidos]);

  useEffect(() => {
    setStandings(computedStandings);
  }, [computedStandings]);

  // Prize pool simulation from completed dates and expected totals
  const pozoResumen = useMemo(() => {
    if (!torneo) return { acumulado: 0, finalEstimado: 0 };

    const costoPorJugador = torneo.costo_fecha_jugador ?? 10000;
    const costoPorCancha = torneo.costo_fecha_cancha ?? 22000;
    const porcentajePremios = torneo.porcentaje_premios ?? 60;
    const totalJugadores = jugadoresInscriptos.length;
    const totalCanchas = torneo.canchas_count ?? 3;

    // Actual revenue (assuming all present players paid, which is expected for completed dates)
    const completedWeeks = fechas.filter((f) => f.estado === "completada").length;
    const revenueActual = completedWeeks * totalJugadores * costoPorJugador;
    const costActual = completedWeeks * totalCanchas * costoPorCancha;
    const netActual = Math.max(0, revenueActual - costActual);
    const acumulado = (netActual * porcentajePremios) / 100;

    // Projected total for 8 weeks
    const revenueProj = 8 * totalJugadores * costoPorJugador;
    const costProj = 8 * totalCanchas * costoPorCancha;
    const netProj = Math.max(0, revenueProj - costProj);
    const finalEstimado = (netProj * porcentajePremios) / 100;

    return {
      acumulado,
      finalEstimado,
    };
  }, [torneo, jugadoresInscriptos, fechas]);

  const partidosDeFecha = useMemo(() => {
    return partidos.filter((p) => p.fecha === selectedFechaNum).sort((a, b) => a.cancha.localeCompare(b.cancha));
  }, [partidos, selectedFechaNum]);

  // Helper to resolve court badges
  const getCanchaColor = (canchaName: string) => {
    if (canchaName.includes("Cancha 1")) return "border-emerald-500/20 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20";
    if (canchaName.includes("Cancha 2")) return "border-amber-500/20 text-amber-600 bg-amber-50 dark:bg-amber-950/20";
    return "border-blue-500/20 text-blue-600 bg-blue-50 dark:bg-blue-950/20";
  };

  return (
    <div className="min-h-screen bg-background pb-12 flex flex-col justify-between">
      <div className="container mx-auto p-4 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 flex-wrap gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{torneo?.nombre || "Muro de Resultados"}</h1>
              <Badge className="bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-wider">Americano</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Anita Quiroga Pádel · {torneo?.categoria_libre || "Libre"} · {torneo?.sede || "Complejo Oficial"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Calendar className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando posiciones y fixture...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full max-w-lg bg-muted text-xs">
              <TabsTrigger value="ranking">Tabla</TabsTrigger>
              <TabsTrigger value="fixture">Encuentros</TabsTrigger>
              <TabsTrigger value="reglamento">Reglamento</TabsTrigger>
              <TabsTrigger value="premios">Premios</TabsTrigger>
            </TabsList>

            {/* TAB 1: STANDINGS */}
            <TabsContent value="ranking" className="space-y-4">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Ranking Acumulado</span>
                    <Badge variant="secondary" className="text-[10px] h-5">Fase Regular</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Las posiciones determinan la distribución de canchas para la siguiente semana (Ascensos/Descensos).
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 overflow-x-auto">
                  <Table className="text-xs min-w-[500px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px] text-center">Pos</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Club/Ciudad</TableHead>
                        <TableHead className="text-center w-[50px]">PJ</TableHead>
                        <TableHead className="text-center w-[80px]">Sets G-P</TableHead>
                        <TableHead className="text-center w-[80px]">Games Diff</TableHead>
                        <TableHead className="text-right w-[90px]">Puntos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground italic">
                            Aún no se han computado fechas en este torneo.
                          </TableCell>
                        </TableRow>
                      ) : (
                        standings.map((s, idx) => {
                          const rank = idx + 1;
                          const countCanchas = torneo?.canchas_count ?? 3;
                          let courtGroup = "Base";
                          let badgeStyle = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";

                          if (rank <= 4) {
                            courtGroup = "Élite (C1)";
                            badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
                          } else if (rank <= 8 && countCanchas >= 2) {
                            courtGroup = "Desafío (C2)";
                            badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
                          } else if (rank <= 12 && countCanchas >= 3) {
                            courtGroup = "Base (C3)";
                          } else if (rank <= 16 && countCanchas >= 4) {
                            courtGroup = "Promoción (C4)";
                          }

                          return (
                            <TableRow key={s.jugador_id}>
                              <TableCell className="text-center font-bold">
                                {rank === 1 ? (
                                  <span className="flex justify-center text-amber-500"><Trophy className="h-4 w-4" /></span>
                                ) : (
                                  `${rank}º`
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold">{s.apellido}, {s.nombre}</div>
                                <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded mt-0.5 font-bold ${badgeStyle}`}>
                                  {courtGroup}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{s.club || "—"}</TableCell>
                              <TableCell className="text-center">{s.partidosJugados}</TableCell>
                              <TableCell className="text-center font-mono text-muted-foreground">
                                {s.setsGanados}-{s.setsPerdidos}
                              </TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                  {s.difGames > 0 ? `+${s.difGames}` : s.difGames}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                {s.puntos} pts
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: FIXTURE & RESULTS */}
            <TabsContent value="fixture" className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap pb-2">
                <span className="text-xs font-semibold text-muted-foreground mr-1">Fecha:</span>
                {Array.from({ length: 8 }).map((_, i) => {
                  const fNum = i + 1;
                  const fObj = fechas.find((f) => f.fecha === fNum);
                  const isCompleted = fObj?.estado === "completada";

                  return (
                    <Button
                      key={i}
                      variant={selectedFechaNum === fNum ? "default" : "outline"}
                      size="sm"
                      className={`h-7 w-10 text-[10px] p-0 font-bold ${
                        isCompleted && selectedFechaNum !== fNum
                          ? "border-emerald-500/20 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-500/10"
                          : ""
                      }`}
                      onClick={() => setSelectedFechaNum(fNum)}
                    >
                      {fNum}
                    </Button>
                  );
                })}
              </div>

              {partidosDeFecha.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground italic">
                    El fixture para la Fecha {selectedFechaNum} aún no se ha generado o está pendiente de publicación.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {partidosDeFecha.map((p) => {
                    const hasWinner = p.estado === "finalizado";

                    return (
                      <Card key={p.id} className="border border-border/40 shadow-sm overflow-hidden flex flex-col justify-between">
                        <div>
                          <div className={`px-3 py-1.5 text-[10px] font-bold uppercase border-b flex items-center justify-between ${getCanchaColor(p.cancha)}`}>
                            <span>{p.cancha}</span>
                            {hasWinner && (
                              <Badge className="bg-emerald-600 text-white text-[8px] font-extrabold uppercase px-1 py-0 h-4 shadow-none">
                                Jugado
                              </Badge>
                            )}
                          </div>
                          <CardContent className="p-4 space-y-3.5">
                            {/* Team 1 */}
                            <div className="space-y-1">
                              <span className="text-[9px] text-muted-foreground uppercase font-bold">Pareja A</span>
                              <div className={`text-xs p-2 rounded-md ${hasWinner && p.sets_pareja1 > p.sets_pareja2 ? "bg-primary/5 font-semibold text-primary border border-primary/10" : "bg-muted/30 text-foreground"}`}>
                                <div className="truncate">
                                  {p.jugador1?.apellido}, {p.jugador1?.nombre[0]}.
                                  {p.suplente1_nombre && <span className="text-[9px] font-normal text-muted-foreground block">Suplente: {p.suplente1_nombre}</span>}
                                </div>
                                <div className="truncate mt-0.5">
                                  {p.jugador2?.apellido}, {p.jugador2?.nombre[0]}.
                                  {p.suplente2_nombre && <span className="text-[9px] font-normal text-muted-foreground block">Suplente: {p.suplente2_nombre}</span>}
                                </div>
                              </div>
                            </div>

                            {/* VS separator */}
                            <div className="flex items-center gap-1.5 text-center justify-center">
                              <div className="h-[1px] bg-border flex-1" />
                              <span className="text-[9px] font-extrabold text-muted-foreground">VS</span>
                              <div className="h-[1px] bg-border flex-1" />
                            </div>

                            {/* Team 2 */}
                            <div className="space-y-1">
                              <span className="text-[9px] text-muted-foreground uppercase font-bold">Pareja B</span>
                              <div className={`text-xs p-2 rounded-md ${hasWinner && p.sets_pareja2 > p.sets_pareja1 ? "bg-primary/5 font-semibold text-primary border border-primary/10" : "bg-muted/30 text-foreground"}`}>
                                <div className="truncate">
                                  {p.jugador3?.apellido}, {p.jugador3?.nombre[0]}.
                                  {p.suplente3_nombre && <span className="text-[9px] font-normal text-muted-foreground block">Suplente: {p.suplente3_nombre}</span>}
                                </div>
                                <div className="truncate mt-0.5">
                                  {p.jugador4?.apellido}, {p.jugador4?.nombre[0]}.
                                  {p.suplente4_nombre && <span className="text-[9px] font-normal text-muted-foreground block">Suplente: {p.suplente4_nombre}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Scores footer */}
                        <div className="border-t p-3 bg-muted/20">
                          {hasWinner && p.sets && p.sets.length > 0 ? (
                            <div className="flex justify-center gap-2">
                              {p.sets.map((s) => (
                                <div key={s.id} className="text-center font-mono font-bold bg-muted px-2 py-0.5 rounded text-xs">
                                  {s.games_pareja1}-{s.games_pareja2}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center text-[10px] text-muted-foreground italic">
                              Pendiente de juego
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: REGLAMENTO */}
            <TabsContent value="reglamento" className="space-y-4">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    Reglamento Oficial - Liga Crown Pádel
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Formato americano individual con ascensos y descensos automáticos por canchas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs leading-relaxed text-muted-foreground">
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <Trophy className="h-4 w-4 text-amber-500" /> 1. Dinámica y Competencia
                    </h3>
                    <p>
                      El torneo tiene una duración de **8 semanas**. Se juega de forma individual (inscripción individual), pero en pista se arman parejas dobles en base a la posición del ranking.
                    </p>
                    <p>
                      **Semana 1 (Sorteo Inicial)**: Se define por sorteo en vivo la cancha en la que juega cada participante (4 jugadores por cancha) y las parejas del partido (J1+J4 vs J2+J3).
                    </p>
                    <p>
                      **Semanas 2 a 6 (Fase Regular)**: Los jugadores se ordenan por su ranking general acumulado. Los 4 mejores van a la Cancha 1 (Élite), los siguientes 4 a la Cancha 2 (Desafío) y así sucesivamente. Los cruces internos de cada cancha se automatizan cruzando el mejor del grupo con el peor del grupo para equilibrar el partido: `1º + 4º vs 2º + 3º`.
                    </p>
                    <p>
                      **Semana 7 y 8 (Play-offs)**: Las últimas dos semanas definen las posiciones finales. En la Semana 7 se juegan Semifinales en pista. En la Semana 8 se disputan las finales, donde cada finalista elige a un compañero de los jugadores ya eliminados (puestos 3 al 12) para disputar el campeonato.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <TrendingUp className="h-4 w-4 text-emerald-500" /> 2. Ascensos y Descensos
                    </h3>
                    <p>
                      Al terminar cada fecha, el ranking general se actualiza. Para la siguiente semana:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Los **2 jugadores con más puntos** de la Cancha 2 ascienden a la Cancha 1.</li>
                      <li>Los **2 jugadores con menos puntos** de la Cancha 1 descienden a la Cancha 2.</li>
                      <li>La misma lógica se aplica entre la Cancha 2, Cancha 3 y el resto de las pistas habilitadas.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <Award className="h-4 w-4 text-indigo-500" /> 3. Puntos de Fecha
                    </h3>
                    <p>
                      Los puntos acumulados en el ranking por cada partido jugado dependen del resultado y de la jerarquía de la cancha disputada:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>**Cancha 1 (Élite)**: Los ganadores suman **4 puntos** cada uno; los perdedores suman **1 punto** cada uno.</li>
                      <li>**Cancha 2 (Desafío)**: Los ganadores suman **3 puntos** cada uno; los perdedores suman **1 punto** cada uno.</li>
                      <li>**Cancha 3 (Base)**: Los ganadores suman **2 puntos** cada uno; los perdedores suman **1 punto** cada uno.</li>
                    </ul>
                    <p className="text-[10px] italic">
                      Nota: En caso de empate en puntos en la tabla general, se desempata por: 1) Sets ganados, 2) Mayor diferencia de games a favor, 3) Sorteo.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" /> 4. Ausencias y Suplentes
                    </h3>
                    <p>
                      Si un jugador no puede asistir, debe avisar con anticipación para que la organización asigne un suplente de nivel equivalente.
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>El **jugador titular ausente no sumará puntos** esa fecha (0 puntos en la tabla), pero conserva su puntaje acumulado de fechas anteriores.</li>
                      <li>El **suplente juega para completar la cancha**, pero no recibe ningún punto en el ranking general.</li>
                      <li>Los otros 3 jugadores de la cancha juegan de forma normal y reciben los puntos correspondientes (ganador/perdedor) de acuerdo al resultado del partido.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: PRIZE POOL DISPLAY */}
            <TabsContent value="premios" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border border-border/40 shadow-sm bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-950/5">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      Fondo del Pozo de Premios
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Acumulación de premios en efectivo para el 1º y 2º puesto del torneo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1 border-b pb-3">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Fondo Acumulado Actual</span>
                      <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                        ${pozoResumen.acumulado.toLocaleString("es-AR")}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Fondo real en caja en base a las fechas completadas y cobradas.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Fondo Estimado al Finalizar (8 Semanas)</span>
                      <div className="text-xl font-bold text-foreground">
                        ${pozoResumen.finalEstimado.toLocaleString("es-AR")}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Proyección total si todas las jugadoras completan el pago de sus 8 fechas.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/40 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Distribución de Premios
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Cómo se dividirá el fondo total entre los finalistas en la Semana 8.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <span className="font-semibold text-foreground">1º Puesto (Campeón/a)</span>
                        <p className="text-[10px] text-muted-foreground">Se lleva el 70% del pozo acumulado.</p>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ${((pozoResumen.acumulado * 70) / 100).toLocaleString("es-AR")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <span className="font-semibold text-foreground">2º Puesto (Subcampeón/a)</span>
                        <p className="text-[10px] text-muted-foreground">Se lleva el 30% del pozo acumulado.</p>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ${((pozoResumen.acumulado * 30) / 100).toLocaleString("es-AR")}
                      </span>
                    </div>

                    <div className="p-3 bg-muted/40 rounded-md border flex gap-2 text-[10px] text-muted-foreground leading-normal">
                      <Info className="h-4 w-4 shrink-0 text-indigo-600" />
                      <span>
                        El pozo final de premios se calcula después de cubrir el costo total del alquiler de las canchas. Se destina el {torneo?.porcentaje_premios || 60}% a la bolsa de premios en efectivo.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Footer / Branding */}
      <footer className="text-center text-xs text-muted-foreground/60 border-t pt-4 mt-8">
        <p>© 2026 Anita Quiroga Pádel · Gestión de Torneos por Padel ID</p>
      </footer>
    </div>
  );
}
