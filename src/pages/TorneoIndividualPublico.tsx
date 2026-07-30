import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { CompartirFixtureIndividualDialog } from "@/components/torneo-individual/CompartirFixtureIndividualDialog";
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
  Info,
  Gift,
  Share2
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import PublicFooter from "@/components/PublicFooter";

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

const parsePremiosString = (premiosText: string | null) => {
  const defaults = { cash1: 0, cash2: 0, gifts: "" };
  if (!premiosText) return defaults;

  const parts = premiosText.split("|").map(p => p.trim());
  let cash1 = 0;
  let cash2 = 0;
  let gifts = "";

  parts.forEach(part => {
    if (part.startsWith("1º: $")) {
      const valStr = part.replace("1º: $", "").trim();
      cash1 = Number(valStr) || 0;
    } else if (part.startsWith("2º: $")) {
      const valStr = part.replace("2º: $", "").trim();
      cash2 = Number(valStr) || 0;
    } else if (part.startsWith("Regalos:")) {
      gifts = part.substring("Regalos:".length).trim();
    }
  });

  if (parts.length === 1 && !premiosText.includes("1º: $")) {
    gifts = premiosText;
  }

  return { cash1, cash2, gifts };
};

export default function TorneoIndividualPublico() {
  const { id } = useParams<{ id: string }>();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const pagoStatus = searchParams.get("pago");
    if (pagoStatus === "exitoso") {
      toast.success("¡Pago exitoso! Tu inscripción está confirmada.");
    } else if (pagoStatus === "fallido") {
      toast.error("El pago no se pudo completar. Intenta nuevamente.");
    } else if (pagoStatus === "pendiente") {
      toast.info("El pago está pendiente de acreditación. Te avisaremos cuando se confirme.");
    }
  }, [searchParams]);

  // Data lists
  const [jugadoresInscriptos, setJugadoresInscriptos] = useState<TorneoJugador[]>([]);
  const [fechas, setFechas] = useState<TorneoFecha[]>([]);
  const [pagos, setPagos] = useState<TorneoPago[]>([]);
  const [partidos, setPartidos] = useState<PartidoInd[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [parejas, setParejas] = useState<any[]>([]);
  const [shareFixtureOpen, setShareFixtureOpen] = useState(false);

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
        { data: tpRes },
      ] = await Promise.all([
        supabase.from("torneos").select("*").eq("id", id).maybeSingle(),
        (supabase as any).from("torneo_individual_jugadores").select("*, jugador:jugadores(*)").eq("torneo_id", id),
        (supabase as any).from("torneo_individual_fechas").select("*").eq("torneo_id", id).order("fecha"),
        (supabase as any).from("torneo_individual_pagos").select("*").eq("torneo_id", id),
        (supabase as any).from("partidos_individuales").select("*").eq("torneo_id", id),
        (supabase as any).from("torneo_individual_parejas").select("*").eq("torneo_id", id),
      ]);

      if (!tRes) {
        toast.error("No se encontró el torneo");
        return;
      }

      setTorneo(tRes);
      setJugadoresInscriptos((tjRes as TorneoJugador[]) ?? []);
      setFechas(fRes ?? []);
      setPagos(pRes ?? []);

      // Map couples players
      const mappedParejas = (tpRes ?? []).map((p: any) => ({
        ...p,
        jugador1: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador1_id)?.jugador || null,
        jugador2: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador2_id)?.jugador || null,
      }));
      setParejas(mappedParejas);

      // Fetch sets for each match
      if (partRes && partRes.length > 0) {
        const pIds = partRes.map((p: any) => p.id);
        const { data: setsRes } = await (supabase as any)
          .from("sets_partido_individual")
          .select("*")
          .in("partido_individual_id", pIds)
          .order("numero_set");

        const setsMap: Record<string, SetPartidoInd[]> = {};
        (setsRes ?? []).forEach((s) => {
          if (!setsMap[s.partido_individual_id]) setsMap[s.partido_individual_id] = [];
          setsMap[s.partido_individual_id].push(s);
        });

        const fullPartidos: PartidoInd[] = partRes.map((p: any) => ({
          ...p,
          jugador1: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador1_id)?.jugador || null,
          jugador2: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador2_id)?.jugador || null,
          jugador3: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador3_id)?.jugador || null,
          jugador4: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador4_id)?.jugador || null,
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
  const computedStandings = useMemo((): any[] => {
    if (!torneo) return [];
    const countCanchas = torneo.canchas_count ?? 3;

    if (torneo.modalidad === "parejas") {
      const standingsMap = new Map<string, any>();
      parejas.forEach((p) => {
        standingsMap.set(p.id, {
          pareja_id: p.id,
          jugador1_id: p.jugador1_id,
          jugador2_id: p.jugador2_id,
          jugador1: p.jugador1,
          jugador2: p.jugador2,
          puntos: 0,
          setsGanados: 0,
          setsPerdidos: 0,
          gamesGanados: 0,
          gamesPerdidos: 0,
          difGames: 0,
          partidosJugados: 0,
          suplenciasUsadas: 0,
        });
      });

      const finalizedMatches = partidos.filter((m) => m.estado === "finalizado");

      // Count substitutions per couple
      finalizedMatches.forEach((m) => {
        const coupleA = parejas.find(
          (p) =>
            (p.jugador1_id === m.jugador1_id && p.jugador2_id === m.jugador2_id) ||
            (p.jugador1_id === m.jugador2_id && p.jugador2_id === m.jugador1_id)
        );
        const coupleB = parejas.find(
          (p) =>
            (p.jugador1_id === m.jugador3_id && p.jugador2_id === m.jugador4_id) ||
            (p.jugador1_id === m.jugador4_id && p.jugador2_id === m.jugador3_id)
        );

        if (coupleA) {
          const sA = standingsMap.get(coupleA.id);
          if (sA) {
            if (m.suplente1_nombre) sA.suplenciasUsadas++;
            if (m.suplente2_nombre) sA.suplenciasUsadas++;
          }
        }
        if (coupleB) {
          const sB = standingsMap.get(coupleB.id);
          if (sB) {
            if (m.suplente3_nombre) sB.suplenciasUsadas++;
            if (m.suplente4_nombre) sB.suplenciasUsadas++;
          }
        }
      });

      finalizedMatches.forEach((m) => {
        const coupleA = parejas.find(
          (p) =>
            (p.jugador1_id === m.jugador1_id && p.jugador2_id === m.jugador2_id) ||
            (p.jugador1_id === m.jugador2_id && p.jugador2_id === m.jugador1_id)
        );
        const coupleB = parejas.find(
          (p) =>
            (p.jugador1_id === m.jugador3_id && p.jugador2_id === m.jugador4_id) ||
            (p.jugador1_id === m.jugador4_id && p.jugador2_id === m.jugador3_id)
        );

        if (!coupleA || !coupleB) return;

        const sA = standingsMap.get(coupleA.id);
        const sB = standingsMap.get(coupleB.id);
        if (!sA || !sB) return;

        sA.partidosJugados++;
        sB.partidosJugados++;

        const p1Won = m.sets_pareja1 > m.sets_pareja2;

        const courtMatch = m.cancha.match(/\d+/);
        const courtIndex = courtMatch ? parseInt(courtMatch[0], 10) : 1;

        const ptsWinner = countCanchas - courtIndex + 2;
        const ptsLoser = 1;

        // Apply rules for forfeits if sub limit > 2
        const p1Forfeit = sA.suplenciasUsadas > 2;
        const p2Forfeit = sB.suplenciasUsadas > 2;

        if (p1Forfeit && p2Forfeit) {
          // Both forfeited: 0-0 games, 0-2 sets, 1pt each
          sA.puntos += 1;
          sB.puntos += 1;
          sA.setsPerdidos += 2;
          sB.setsPerdidos += 2;
          sA.gamesPerdidos += 12;
          sB.gamesPerdidos += 12;
        } else if (p1Forfeit) {
          // Couple A forfeit
          sB.puntos += ptsWinner;
          sA.puntos += 1;
          sB.setsGanados += 2;
          sA.setsPerdidos += 2;
          sB.gamesGanados += 12;
          sA.gamesPerdidos += 12;
        } else if (p2Forfeit) {
          // Couple B forfeit
          sA.puntos += ptsWinner;
          sB.puntos += 1;
          sA.setsGanados += 2;
          sB.setsPerdidos += 2;
          sA.gamesGanados += 12;
          sB.gamesPerdidos += 12;
        } else {
          // Normal scoring
          sA.puntos += p1Won ? ptsWinner : ptsLoser;
          sB.puntos += !p1Won ? ptsWinner : ptsLoser;

          sA.setsGanados += m.sets_pareja1;
          sA.setsPerdidos += m.sets_pareja2;
          sB.setsGanados += m.sets_pareja2;
          sB.setsPerdidos += m.sets_pareja1;

          let gA = 0;
          let gB = 0;
          m.sets?.forEach((s: any) => {
            gA += s.games_pareja1;
            gB += s.games_pareja2;
          });

          sA.gamesGanados += gA;
          sA.gamesPerdidos += gB;
          sB.gamesGanados += gB;
          sB.gamesPerdidos += gA;
        }
      });

      const list = Array.from(standingsMap.values()).map((s) => ({
        ...s,
        difSets: s.setsGanados - s.setsPerdidos,
        difGames: s.gamesGanados - s.gamesPerdidos,
      }));

      list.sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.difSets !== a.difSets) return b.difSets - a.difSets;
        if (b.difGames !== a.difGames) return b.difGames - a.difGames;
        return 0;
      });

      return list;
    }

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
      difSets: s.setsGanados - s.setsPerdidos,
      difGames: s.gamesGanados - s.gamesPerdidos,
    }));

    list.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.difSets !== a.difSets) return b.difSets - a.difSets;
      if (b.difGames !== a.difGames) return b.difGames - a.difGames;
      return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`);
    });

    return list;
  }, [torneo, jugadoresInscriptos, parejas, partidos]);

  useEffect(() => {
    setStandings(computedStandings);
  }, [computedStandings]);

  const championsInfo = useMemo(() => {
    const finalWeek = torneo?.desafio_semanas ?? 8;
    const finalMatch = partidos.find(
      (p) => p.fecha === finalWeek && p.cancha.includes("Gran Final")
    );
    if (!finalMatch || finalMatch.estado !== "finalizado") return null;

    const p1Won = finalMatch.sets_pareja1 > finalMatch.sets_pareja2;
    if (p1Won) {
      return {
        campeon: finalMatch.jugador1,
        campeonPartner: finalMatch.jugador2,
        subcampeon: finalMatch.jugador3,
        subcampeonPartner: finalMatch.jugador4,
      };
    } else {
      return {
        campeon: finalMatch.jugador3,
        campeonPartner: finalMatch.jugador4,
        subcampeon: finalMatch.jugador1,
        subcampeonPartner: finalMatch.jugador2,
      };
    }
  }, [partidos, torneo]);

  // Prize pool simulation from completed dates and expected totals
  const pozoResumen = useMemo(() => {
    if (!torneo) return { acumulado: 0, finalEstimado: 0 };

    const costoPorJugador = torneo.costo_fecha_jugador ?? 10000;
    const costoPorCancha = torneo.costo_fecha_cancha ?? 22000;
    const porcentajePremios = torneo.porcentaje_premios ?? 60;
    const totalJugadores = jugadoresInscriptos.length;
    const totalCanchas = torneo.canchas_count ?? 3;
    const totalJugadoresProyectados = totalCanchas * 4;

    // Actual revenue (assuming all present players paid, which is expected for completed dates)
    const completedWeeks = fechas.filter((f) => f.estado === "completada").length;
    const revenueActual = completedWeeks * totalJugadores * costoPorJugador;
    const costActual = completedWeeks * totalCanchas * costoPorCancha;
    const netActual = Math.max(0, revenueActual - costActual);
    const acumulado = (netActual * porcentajePremios) / 100;

    // Projected total for X weeks based on tournament capacity
    const semanas = torneo?.desafio_semanas ?? 8;
    const revenueProj = semanas * totalJugadoresProyectados * costoPorJugador;
    const costProj = semanas * totalCanchas * costoPorCancha;
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
              <Badge className="bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-wider">
                {torneo?.modalidad === "parejas" ? "Desafío Parejas" : "Americano"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Anita Quiroga Pádel · {torneo?.categoria_libre || "Libre"} · {torneo?.sede || "Complejo Oficial"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </div>

        {/* Champions Banner */}
        {championsInfo && (
          <Card className="overflow-hidden border-indigo-500/20 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-indigo-500/10 shadow-lg backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/15 rounded-full border border-amber-500/30 text-amber-500 animate-pulse shrink-0">
                    <Trophy className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      ¡Tenemos Campeón!
                      <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                        Finalizado
                      </span>
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      El torneo ha concluido tras disputar la gran final de la Semana {torneo?.desafio_semanas ?? 8}.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                  {/* Campeón */}
                  <div className="flex-1 min-w-[200px] border border-amber-500/20 bg-amber-500/5 p-4 rounded-xl relative overflow-hidden">
                    <div className="absolute top-1 right-1 text-amber-500/10 font-black text-4xl">1°</div>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-black tracking-wider">Campeón</p>
                    {torneo?.modalidad === "parejas" ? (
                      <>
                        <p className="text-base font-bold mt-1 text-foreground">
                          {championsInfo.campeon ? `${championsInfo.campeon.apellido}, ${championsInfo.campeon.nombre}` : "—"}
                        </p>
                        <p className="text-base font-bold mt-0.5 text-foreground">
                          {championsInfo.campeonPartner ? `${championsInfo.campeonPartner.apellido}, ${championsInfo.campeonPartner.nombre}` : "—"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-bold mt-1 text-foreground">
                          {championsInfo.campeon ? `${championsInfo.campeon.apellido}, ${championsInfo.campeon.nombre}` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          Compañero: {championsInfo.campeonPartner ? `${championsInfo.campeonPartner.apellido}, ${championsInfo.campeonPartner.nombre}` : "—"}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Subcampeón */}
                  <div className="flex-1 min-w-[200px] border border-slate-500/20 bg-slate-500/5 p-4 rounded-xl relative overflow-hidden">
                    <div className="absolute top-1 right-1 text-slate-500/10 font-black text-4xl">2°</div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider">Subcampeón</p>
                    {torneo?.modalidad === "parejas" ? (
                      <>
                        <p className="text-base font-bold mt-1 text-foreground">
                          {championsInfo.subcampeon ? `${championsInfo.subcampeon.apellido}, ${championsInfo.subcampeon.nombre}` : "—"}
                        </p>
                        <p className="text-base font-bold mt-0.5 text-foreground">
                          {championsInfo.subcampeonPartner ? `${championsInfo.subcampeonPartner.apellido}, ${championsInfo.subcampeonPartner.nombre}` : "—"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-bold mt-1 text-foreground">
                          {championsInfo.subcampeon ? `${championsInfo.subcampeon.apellido}, ${championsInfo.subcampeon.nombre}` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Compañero: {championsInfo.subcampeonPartner ? `${championsInfo.subcampeonPartner.apellido}, ${championsInfo.subcampeonPartner.nombre}` : "—"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                        <TableHead>{torneo?.modalidad === "parejas" ? "Pareja" : "Jugador"}</TableHead>
                        <TableHead>{torneo?.modalidad === "parejas" ? "Suplencias Usadas" : "Club/Ciudad"}</TableHead>
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
                      ) : torneo?.modalidad === "parejas" ? (
                        standings.map((s, idx) => {
                          const rank = idx + 1;
                          let courtGroup = "Base";
                          let badgeStyle = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";

                          if (rank === 1 || rank === 2) {
                            courtGroup = "Élite (C1)";
                            badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
                          } else if (rank === 3 || rank === 4) {
                            courtGroup = "Desafío (C2)";
                            badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
                          } else {
                            courtGroup = "Base (C3)";
                          }

                          return (
                            <TableRow key={s.pareja_id}>
                              <TableCell className="text-center font-bold">
                                {rank === 1 ? (
                                  <span className="flex justify-center text-amber-500"><Trophy className="h-4 w-4" /></span>
                                ) : (
                                  `${rank}º`
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold">{s.jugador1?.apellido}, {s.jugador1?.nombre}</div>
                                <div className="font-semibold text-muted-foreground">{s.jugador2?.apellido}, {s.jugador2?.nombre}</div>
                                <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded mt-1 font-bold ${badgeStyle}`}>
                                  {courtGroup}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={s.suplenciasUsadas > 2 ? "text-destructive font-bold text-xs" : "text-muted-foreground text-xs"}>
                                  {s.suplenciasUsadas} / 2
                                </span>
                              </TableCell>
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
                {Array.from({ length: torneo?.desafio_semanas ?? 8 }).map((_, i) => {
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

                {partidosDeFecha.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 text-[10px] font-bold border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                    onClick={() => setShareFixtureOpen(true)}
                  >
                    <Share2 className="h-3 w-3 mr-1" />
                    Compartir
                  </Button>
                )}
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
                          </CardContent>
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
                    {torneo?.modalidad === "parejas"
                      ? "Formato por parejas fijas de 8 semanas con ascensos y descensos directos por cancha."
                      : "Formato americano individual con ascensos y descensos automáticos por canchas."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs leading-relaxed text-muted-foreground">
                  {torneo?.notas ? (
                    <div className="whitespace-pre-wrap text-sm text-foreground/90">{torneo.notas}</div>
                  ) : torneo?.modalidad === "parejas" ? (
                    <>
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Trophy className="h-4 w-4 text-amber-500" /> 1. Dinámica y Competencia (Parejas)
                        </h3>
                        <p>
                          El torneo tiene una duración de **8 semanas** y se juega con **6 parejas fijas** (12 jugadoras en total) distribuidas en 3 canchas (C1: Élite, C2: Desafío, C3: Base).
                        </p>
                        <p>
                          **Semana 1**: Se asignan aleatoriamente las parejas a las 3 canchas.
                        </p>
                        <p>
                          **Semanas 2 a 6**: Ascensos y descensos directos por cancha según resultado del partido:
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>**Cancha 1 (Élite)**: La pareja ganadora mantiene su lugar en Élite. La pareja perdedora desciende a Cancha 2.</li>
                          <li>**Cancha 2 (Desafío)**: La pareja ganadora asciende a Cancha 1. La pareja perdedora desciende a Cancha 3.</li>
                          <li>**Cancha 3 (Base)**: La pareja ganadora asciende a Cancha 2. La pareja perdedora mantiene su lugar en Cancha 3.</li>
                        </ul>
                        <p>
                          **Semana 7 (Semifinales)**: Se cruzan por ranking acumulado general (1º vs 4º en Cancha 1, 2º vs 3º en Cancha 2, y 5º vs 6º en Cancha 3).
                        </p>
                        <p>
                          **Semana 8 (Finales)**: La Gran Final en Cancha 1 (ganador Semis C1 vs ganador Semis C2), Tercer puesto en Cancha 2 (perdedor Semis C1 vs perdedor Semis C2) y revancha recreativa en Cancha 3 (5º vs 6º).
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Award className="h-4 w-4 text-indigo-500" /> 2. Puntos de Fecha
                        </h3>
                        <p>
                          Los puntos acumulados en el ranking por cada partido jugado dependen del resultado y de la jerarquía de la cancha disputada:
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>**Ganar en Cancha 1**: **4 puntos** para la pareja.</li>
                          <li>**Ganar en Cancha 2**: **3 puntos** para la pareja.</li>
                          <li>**Ganar en Cancha 3**: **2 puntos** para la pareja.</li>
                          <li>**Perder (Cualquier Cancha)**: **1 punto** para la pareja.</li>
                        </ul>
                        <p>
                          **Supertiebreak**: En caso de definir el set definitivo (Set 3), se juega un Supertiebreak **a 7 puntos a morir** (muerte súbita sin diferencia de 2).
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" /> 3. Suplencias y Forfeit
                        </h3>
                        <p>
                          Se permiten hasta **2 suplencias acumuladas** por pareja durante las 8 semanas.
                        </p>
                        <ul className="list-disc pl-4 space-y-1 border-l-2 border-amber-500 pl-2">
                          <li className="text-amber-600 dark:text-amber-400 font-medium">Si una pareja falta o utiliza más de 2 suplencias acumuladas, se le contará como partido perdido por W.O. / Forfeit (6-0, 6-0) y sumarán únicamente 1 punto de fecha jugada.</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Trophy className="h-4 w-4 text-amber-500" /> 1. Dinámica y Competencia
                        </h3>
                        <p>
                          El torneo tiene una duración de **{torneo?.desafio_semanas ?? 8} semanas**. Se juega de forma individual (inscripción individual), pero en pista se arman parejas dobles en base a la posición del ranking.
                        </p>
                        <p>
                          **Semana 1 (Sorteo Inicial)**: Se define por sorteo en vivo la cancha en la que juega cada participante (4 jugadores por cancha) y las parejas del partido (J1+J4 vs J2+J3).
                        </p>
                        <p>
                          **Semanas 2 a {(torneo?.desafio_semanas ?? 8) - 2} (Fase Regular)**: Los jugadores se ordenan por su ranking general acumulado. Los 4 mejores van a la Cancha 1 (Élite), los siguientes 4 a la Cancha 2 (Desafío) y así sucesivamente. Los cruces internos de cada cancha se automatizan cruzando el mejor del grupo con el peor del grupo para equilibrar el partido: `1º + 4º vs 2º + 3º`.
                        </p>
                        <p>
                          **Semana {(torneo?.desafio_semanas ?? 8) - 1} y {torneo?.desafio_semanas ?? 8} (Play-offs)**: Las últimas dos semanas definen las posiciones finales. En la Semana {(torneo?.desafio_semanas ?? 8) - 1} se juegan Semifinales en pista. En la Semana {torneo?.desafio_semanas ?? 8} se disputan las finales, donde cada finalista elige a un compañero de los jugadores ya eliminados (puestos 3 al 12) para disputar el campeonato.
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
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: PRIZE POOL DISPLAY */}
            <TabsContent value="premios" className="space-y-4">
              {(() => {
                const parsedPremios = parsePremiosString(torneo?.premios ?? null);
                const isCovered = pozoResumen.acumulado >= pozoResumen.finalEstimado && pozoResumen.finalEstimado > 0;
                
                const showCash1 = parsedPremios.cash1 > 0 ? parsedPremios.cash1 : Math.round((pozoResumen.finalEstimado * 0.7));
                const showCash2 = parsedPremios.cash2 > 0 ? parsedPremios.cash2 : Math.round((pozoResumen.finalEstimado * 0.3));

                return (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border border-border/40 shadow-sm bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-950/5 flex flex-col justify-between">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                          Importe en Efectivo a Entregar
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Premios en efectivo definidos para el 1º y 2º puesto del torneo.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1 flex flex-col justify-center pb-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                              ${pozoResumen.finalEstimado.toLocaleString("es-AR")}
                            </div>
                            {isCovered ? (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] font-bold uppercase px-2.5 py-0.5 shadow-none border-none">
                                Cubierto
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] font-bold uppercase px-2.5 py-0.5 shadow-none border-none">
                                En Acumulación
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            {isCovered 
                              ? "¡El pozo estimado de premios en efectivo ha sido completamente cubierto por las inscripciones cobradas!"
                              : `Acumulado en caja actualmente: $${pozoResumen.acumulado.toLocaleString("es-AR")} de $${pozoResumen.finalEstimado.toLocaleString("es-AR")}`
                            }
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
                          Cómo se divide el importe en efectivo a entregar entre los finalistas en la Semana {torneo?.desafio_semanas ?? 8}.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div>
                            <span className="font-semibold text-foreground">1º Puesto (Campeón/a)</span>
                            <p className="text-[10px] text-muted-foreground">
                              {parsedPremios.cash1 > 0 ? "Premio fijo en efectivo." : "Se lleva el 70% del importe a entregar."}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ${showCash1.toLocaleString("es-AR")}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-b pb-2">
                          <div>
                            <span className="font-semibold text-foreground">2º Puesto (Subcampeón/a)</span>
                            <p className="text-[10px] text-muted-foreground">
                              {parsedPremios.cash2 > 0 ? "Premio fijo en efectivo." : "Se lleva el 30% del importe a entregar."}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ${showCash2.toLocaleString("es-AR")}
                          </span>
                        </div>

                        <div className="p-3 bg-muted/40 rounded-md border flex gap-2 text-[10px] text-muted-foreground leading-normal">
                          <Info className="h-4 w-4 shrink-0 text-indigo-600" />
                          <span>
                            El pozo final de premios representa el {torneo?.porcentaje_premios || 60}% de la ganancia proyectada del desafío.
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border/40 shadow-sm md:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Gift className="h-4 w-4 text-pink-500" />
                          Premios de Regalo / Adicionales
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Obsequios o indumentaria adicional que se entrega a las jugadoras de regalo.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-6">
                        {parsedPremios.gifts ? (
                          <div className="p-4 bg-pink-500/5 dark:bg-pink-950/10 border border-pink-500/10 rounded-xl">
                            <span className="text-[9px] uppercase text-pink-600 dark:text-pink-400 font-extrabold block mb-1.5 tracking-wider">
                              Obsequios Incluidos
                            </span>
                            <p className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-line">
                              {parsedPremios.gifts}
                            </p>
                          </div>
                        ) : (
                          <div className="p-4 bg-muted/30 border rounded-xl text-center">
                            <p className="text-xs text-muted-foreground italic">
                              No hay regalos adicionales especificados aún para este torneo.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <PublicFooter />

      <CompartirFixtureIndividualDialog
        isOpen={shareFixtureOpen}
        onOpenChange={setShareFixtureOpen}
        torneo={torneo}
        fechaNum={selectedFechaNum}
        partidos={partidosDeFecha}
      />
    </div>
  );
}
