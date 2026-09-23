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
import { CompartirRankingDialog } from "@/components/torneo-individual/CompartirRankingDialog";
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
  podio_final?: number | null;
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
  const [shareRankingOpen, setShareRankingOpen] = useState(false);

  // Active selections
  const [activeTab, setActiveTab] = useState("ranking");
  const [selectedFechaNum, setSelectedFechaNum] = useState<number>(1);
  const [reglamentoView, setReglamentoView] = useState<"resumen" | "pdf">("resumen");

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

      // Map fechas with fallback to notas
      const mappedFechas = (fRes ?? []).map((f: any) => {
        const leyMatch = tRes?.notas?.match(new RegExp(`\\[LEYENDA_FECHA_${f.fecha}:(.*?)\\]`));
        return {
          ...f,
          leyenda: f.leyenda || (leyMatch ? leyMatch[1] : null),
        };
      });
      setFechas(mappedFechas);
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

  const esPuntosPorSet = useMemo(() => Boolean(
    (torneo as any)?.sistema_puntuacion === "puntos_por_set" ||
    torneo?.notas?.includes("[SISTEMA:puntos_por_set]") ||
    torneo?.canchas_count === 2
  ), [torneo]);

  const currentFechaObj = useMemo(() => {
    return fechas.find((f) => f.fecha === selectedFechaNum);
  }, [fechas, selectedFechaNum]);

  const displaySubtitulo = useMemo(() => {
    if (currentFechaObj?.leyenda?.trim()) {
      return currentFechaObj.leyenda.trim();
    }
    const fechaTagMatch = torneo?.notas?.match(new RegExp(`\\[LEYENDA_FECHA_${selectedFechaNum}:(.*?)\\]`));
    if (fechaTagMatch?.[1]?.trim()) {
      return fechaTagMatch[1].trim();
    }
    if ((torneo as any)?.subtitulo_fase?.trim()) {
      return (torneo as any).subtitulo_fase.trim();
    }
    const tagMatch = torneo?.notas?.match(/\[SUBTITULO:(.*?)\]/);
    if (tagMatch?.[1]?.trim()) {
      return tagMatch[1].trim();
    }
    return "Fase Regular";
  }, [currentFechaObj, selectedFechaNum, torneo]);

  const ocultarReglamento = useMemo(() => {
    return Boolean(
      torneo?.notas?.includes("[OCULTAR_REGLAMENTO]") ||
      id === "119ee16a-5794-46bb-b817-712160f89882"
    );
  }, [torneo, id]);

  useEffect(() => {
    if (ocultarReglamento && activeTab === "reglamento") {
      setActiveTab("ranking");
    }
  }, [ocultarReglamento, activeTab]);

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

      const finalizedMatches = partidos.filter((m) => {
        if (m.estado !== "finalizado") return false;
        const fObj = fechas.find(f => f.fecha === m.fecha);
        return fObj?.publicado === true;
      });

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

        const setsP1 = m.sets_pareja1;
        const setsP2 = m.sets_pareja2;
        const p1Won = setsP1 > setsP2;

        const courtMatch = m.cancha.match(/\d+/);
        const courtIndex = courtMatch ? parseInt(courtMatch[0], 10) : 1;

        let ptsWinner = countCanchas - courtIndex + 2;
        let ptsLoser = 1;

        // Reglamento Oficial (Semanas 9 y 10 de Definición por Tabla Viva)
        if (!esPuntosPorSet) {
          if (m.fecha === 9) {
            ptsWinner = 4;
            ptsLoser = 1;
          } else if (m.fecha === 10) {
            ptsWinner = 6;
            ptsLoser = 2;
          }
        }

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
          sA.puntos += esPuntosPorSet ? setsP1 : (p1Won ? ptsWinner : ptsLoser);
          sB.puntos += esPuntosPorSet ? setsP2 : (!p1Won ? ptsWinner : ptsLoser);

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
          podio_final: (tj as any).podio_final,
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

    const finalizedMatches = partidos.filter((p) => {
      if (p.estado !== "finalizado") return false;
      const fObj = fechas.find(f => f.fecha === p.fecha);
      return fObj?.publicado === true;
    });
    // Ordenar por fecha para procesar cronológicamente las ausencias
    finalizedMatches.sort((a, b) => (a.fecha || 0) - (b.fecha || 0));

    // Contador de ausencias por jugador
    const absenceCountMap = new Map<string, number>();

    finalizedMatches.forEach((p) => {
      const canchaNumMatch = p.cancha.match(/\d+/);
      const courtIndex = canchaNumMatch ? parseInt(canchaNumMatch[0], 10) : 1;

      let ptsWinner = countCanchas - courtIndex + 2;
      let ptsLoser = 1;

      // Reglamento Oficial Crown Pádel (Semanas 9 y 10 de Definición por Tabla Viva)
      if (!esPuntosPorSet) {
        if (p.fecha === 9) {
          // Semana 9: Pareja Ganadora: +4 pts individuales | Pareja Perdedora: +1 pt individual (en todas las canchas)
          ptsWinner = 4;
          ptsLoser = 1;
        } else if (p.fecha === 10) {
          // Semana 10: Súper Puntaje Final: Pareja Ganadora: +6 pts individuales | Pareja Perdedora: +2 pts individuales (en todas las canchas)
          ptsWinner = 6;
          ptsLoser = 2;
        }
      }

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
          // Contabilizar ausencia
          const prevAbsences = absenceCountMap.get(jugId) || 0;
          const newAbsences = prevAbsences + 1;
          absenceCountMap.set(jugId, newAbsences);

          if (newAbsences > 2) {
            // Ausencia 3+: 0 puntos y pierde 6-0 6-0 (-12 games, 0 sets)
            s.puntos += 0;
            s.setsGanados += 0;
            s.setsPerdidos += 2;
            s.gamesGanados += 0;
            s.gamesPerdidos += 12;
          } else {
            // Ausencia 1 o 2: se lleva los puntos y games del suplente (resultado real)
            s.puntos += esPuntosPorSet ? setsOwn : (isWinner ? ptsWinner : ptsLoser);
            s.setsGanados += setsOwn;
            s.setsPerdidos += setsOpp;
            s.gamesGanados += gamesOwn;
            s.gamesPerdidos += gamesOpp;
          }
        } else {
          // Asistió normalmente
          s.puntos += esPuntosPorSet ? setsOwn : (isWinner ? ptsWinner : ptsLoser);
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

  const isSelectedFechaPublicada = useMemo(() => {
    const fObj = fechas.find((f) => f.fecha === selectedFechaNum);
    // If we don't have the object yet or we haven't explicitely hidden it, let's say it's public.
    // Wait, the default in DB is false. We should strictly check for true.
    return fObj?.publicado === true;
  }, [fechas, selectedFechaNum]);

  // Helper to resolve court badges
  const getCanchaColor = (canchaName: string) => {
    if (canchaName.includes("Cancha 1")) return "border-primary/20 text-primary bg-primary/10 dark:bg-primary/20";
    if (canchaName.includes("Cancha 2")) return "border-secondary/20 text-secondary bg-secondary/10 dark:bg-secondary/20";
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
                  <div className="p-3 bg-secondary/15 rounded-full border border-secondary/30 text-secondary animate-pulse shrink-0">
                    <Trophy className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      ¡Tenemos Campeón!
                      <span className="text-xs bg-secondary/20 text-secondary dark:text-secondary font-mono px-2 py-0.5 rounded-full border border-secondary/30">
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
                  <div className="flex-1 min-w-[200px] border border-secondary/20 bg-secondary/5 p-4 rounded-xl relative overflow-hidden">
                    <div className="absolute top-1 right-1 text-secondary/10 font-black text-4xl">1°</div>
                    <p className="text-[10px] text-secondary dark:text-secondary uppercase font-black tracking-wider">Campeón</p>
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
            <TabsList className={`grid ${ocultarReglamento ? "grid-cols-3 max-w-md" : "grid-cols-4 max-w-lg"} w-full bg-muted text-xs`}>
              <TabsTrigger value="ranking">Tabla</TabsTrigger>
              <TabsTrigger value="fixture">Encuentros</TabsTrigger>
              {!ocultarReglamento && <TabsTrigger value="reglamento">Reglamento</TabsTrigger>}
              <TabsTrigger value="premios">Premios</TabsTrigger>
            </TabsList>

            {/* TAB 1: STANDINGS */}
            <TabsContent value="ranking" className="space-y-4">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>Ranking Acumulado</span>
                        <Badge variant="secondary" className="text-[10px] h-5">{displaySubtitulo}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {esPuntosPorSet
                          ? "Tabla general de posiciones por sets y games acumulados sin ascensos ni descensos por cancha fija."
                          : "Las posiciones determinan la distribución de canchas para la siguiente semana (Ascensos/Descensos)."}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShareRankingOpen(true)}
                      className="h-8 gap-1.5 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold text-xs shrink-0"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Placa para Redes
                    </Button>
                  </div>
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
                        <TableHead className="text-center w-[50px]">GF</TableHead>
                        <TableHead className="text-center w-[50px]">GC</TableHead>
                        <TableHead className="text-center w-[80px]">DG</TableHead>
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
                          let courtGroup = "Base (C3)";
                          let badgeStyle = "bg-blue-950/40 border-blue-500/30 text-blue-300";

                          if (rank === 1 || rank === 2) {
                            courtGroup = "Élite (C1)";
                            badgeStyle = "bg-purple-950/40 border-purple-500/30 text-purple-300";
                          } else if (rank === 3 || rank === 4) {
                            courtGroup = "Desafío (C2)";
                            badgeStyle = "bg-pink-950/40 border-pink-500/30 text-pink-300";
                          } else {
                            courtGroup = "Base (C3)";
                            badgeStyle = "bg-blue-950/40 border-blue-500/30 text-blue-300";
                          }

                          return (
                            <TableRow key={s.pareja_id}>
                              <TableCell className="text-center font-bold">
                                {(s as any).podio_final === 1 ? (
                                  <span className="flex justify-center text-secondary" title="Oro"><Trophy className="h-5 w-5 fill-amber-500/20" /></span>
                                ) : (s as any).podio_final === 2 ? (
                                  <span className="flex justify-center text-slate-400" title="Plata"><Trophy className="h-5 w-5 fill-slate-400/20" /></span>
                                ) : (s as any).podio_final === 3 ? (
                                  <span className="flex justify-center text-secondary" title="Bronce"><Trophy className="h-5 w-5 fill-amber-700/20" /></span>
                                ) : rank === 1 ? (
                                  <span className="flex justify-center text-secondary"><Trophy className="h-4 w-4" /></span>
                                ) : (
                                  `${rank}º`
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold text-xs sm:text-sm">{s.jugador1?.apellido}, {s.jugador1?.nombre}</div>
                                <div className="font-semibold text-xs sm:text-sm text-muted-foreground">{s.jugador2?.apellido}, {s.jugador2?.nombre}</div>
                                {!esPuntosPorSet && (
                                  <span className={`inline-flex items-center text-[10px] sm:text-xs px-2 py-0.5 rounded-md mt-1 font-medium border tracking-wide shadow-xs ${badgeStyle}`}>
                                    {courtGroup}
                                  </span>
                                )}
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
                              <TableCell className="text-center font-mono">{s.gamesGanados}</TableCell>
                              <TableCell className="text-center font-mono">{s.gamesPerdidos}</TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-primary" : s.difGames < 0 ? "text-destructive" : ""}>
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
                          let courtGroup = "Base (C3)";
                          let badgeStyle = "bg-blue-950/40 border-blue-500/30 text-blue-300";

                          if (rank <= 4) {
                            courtGroup = "Élite (C1)";
                            badgeStyle = "bg-purple-950/40 border-purple-500/30 text-purple-300";
                          } else if (rank <= 8 && countCanchas >= 2) {
                            courtGroup = "Desafío (C2)";
                            badgeStyle = "bg-pink-950/40 border-pink-500/30 text-pink-300";
                          } else if (rank <= 12 && countCanchas >= 3) {
                            courtGroup = "Base (C3)";
                            badgeStyle = "bg-blue-950/40 border-blue-500/30 text-blue-300";
                          } else if (rank <= 16 && countCanchas >= 4) {
                            courtGroup = "Promoción (C4)";
                            badgeStyle = "bg-emerald-950/40 border-emerald-500/30 text-emerald-300";
                          } else {
                            courtGroup = "Base (C3)";
                            badgeStyle = "bg-blue-950/40 border-blue-500/30 text-blue-300";
                          }

                          return (
                            <TableRow key={s.jugador_id}>
                              <TableCell className="text-center font-bold">
                                  {(s as any).podio_final === 1 ? (
                                    <span className="flex justify-center text-secondary" title="Oro"><Trophy className="h-5 w-5 fill-amber-500/20" /></span>
                                  ) : (s as any).podio_final === 2 ? (
                                    <span className="flex justify-center text-slate-400" title="Plata"><Trophy className="h-5 w-5 fill-slate-400/20" /></span>
                                  ) : (s as any).podio_final === 3 ? (
                                    <span className="flex justify-center text-secondary" title="Bronce"><Trophy className="h-5 w-5 fill-amber-700/20" /></span>
                                  ) : rank === 1 ? (
                                    <span className="flex justify-center text-secondary"><Trophy className="h-4 w-4" /></span>
                                  ) : (
                                    `${rank}º`
                                  )}
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold text-xs sm:text-sm">{s.apellido}, {s.nombre}</div>
                                {!esPuntosPorSet && (
                                  <span className={`inline-flex items-center text-[10px] sm:text-xs px-2 py-0.5 rounded-md mt-1 font-medium border tracking-wide shadow-xs ${badgeStyle}`}>
                                    {courtGroup}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{s.club || "—"}</TableCell>
                              <TableCell className="text-center">{s.partidosJugados}</TableCell>
                              <TableCell className="text-center font-mono text-muted-foreground">
                                {s.setsGanados}-{s.setsPerdidos}
                              </TableCell>
                              <TableCell className="text-center font-mono">{s.gamesGanados}</TableCell>
                              <TableCell className="text-center font-mono">{s.gamesPerdidos}</TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-primary" : s.difGames < 0 ? "text-destructive" : ""}>
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
                          ? "border-primary/20 text-primary bg-primary/10/50 hover:bg-primary/10"
                          : ""
                      }`}
                      onClick={() => setSelectedFechaNum(fNum)}
                    >
                      {fNum}
                    </Button>
                  );
                })}

                {currentFechaObj?.leyenda && (
                  <Badge variant="outline" className="text-[11px] font-semibold text-muted-foreground border-border/60">
                    {currentFechaObj.leyenda}
                  </Badge>
                )}

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

              {!isSelectedFechaPublicada ? (
                <Card className="border border-secondary/30 bg-secondary/10/30">
                  <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="bg-pink-950/40 p-3 rounded-full border border-pink-500/30">
                      <CalendarDays className="h-6 w-6 text-pink-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Semana en Armado</h3>
                      <p className="text-sm text-muted-foreground max-w-md mt-1">
                        Los cruces y resultados de la Fecha {selectedFechaNum} aún se encuentran en armado o revisión y no han sido publicados. Vuelve pronto.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : partidosDeFecha.length === 0 ? (
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
                            <span>{esPuntosPorSet ? p.cancha.replace(/:\s*(Élite|Desafío|Base|Promoción)/i, "") : p.cancha}</span>
                            {hasWinner && (
                              <Badge className="bg-primary text-white text-[8px] font-extrabold uppercase px-1 py-0 h-4 shadow-none">
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
            {!ocultarReglamento && (
            <TabsContent value="reglamento" className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                <div className="flex items-center gap-1.5 p-1 bg-muted/60 dark:bg-neutral-900/80 border border-border/50 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setReglamentoView("resumen")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      reglamentoView === "resumen"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📖 Guía de Reglas
                  </button>
                  <button
                    type="button"
                    onClick={() => setReglamentoView("pdf")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      reglamentoView === "pdf"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📄 Ver Documento Oficial (PDF)
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <span>Marca de agua oficial</span>
                  <span className="font-bold text-purple-400">PADEL ID</span>
                </div>
              </div>

              {reglamentoView === "pdf" ? (
                <div className="rounded-xl overflow-hidden border border-border/60 shadow-lg bg-neutral-900/80 p-1">
                  <iframe
                    src="/reglamento-semanales-padel-id.pdf#toolbar=0&navpanes=0"
                    className="w-full h-[750px] md:h-[950px] rounded-lg border-0 bg-white"
                    title="Reglamento Oficial Crown Pádel - Padel ID"
                  />
                </div>
              ) : (
                <Card className="relative overflow-hidden border border-border/40 shadow-sm">
                  {/* Marca de agua translúcida Padel ID */}
                  <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center -rotate-45 z-0 overflow-hidden">
                    <span className="text-7xl sm:text-9xl md:text-[140px] font-black tracking-widest text-purple-600/10 dark:text-purple-400/15 uppercase">
                      PADEL ID
                    </span>
                  </div>
                  <CardHeader className="relative z-10">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      Reglamento Oficial - Liga Crown Pádel
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {esPuntosPorSet
                        ? "Formato por sumatoria acumulada de puntos por sets ganados."
                        : torneo?.modalidad === "parejas"
                        ? "Formato por parejas fijas de 8 semanas con ascensos y descensos directos por cancha."
                        : "Formato americano individual con ascensos y descensos automáticos por canchas."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4 text-xs leading-relaxed text-muted-foreground">
                    {torneo?.notas?.replace(/\[(SISTEMA|SUBTITULO):.*?\]/g, "").trim() ? (
                      <div className="whitespace-pre-wrap text-sm text-foreground/90">{torneo.notas.replace(/\[(SISTEMA|SUBTITULO):.*?\]/g, "").trim()}</div>
                  ) : esPuntosPorSet ? (
                    <>
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Trophy className="h-4 w-4 text-secondary" /> 1. Sistema de Puntos por Set
                        </h3>
                        <p>
                          En esta modalidad, la clasificación general se define por **sets ganados**. Cada set ganado suma **1 punto** para la tabla de posiciones (una victoria 2-0 otorga 2 puntos; un empate 1-1 otorga 1 punto a cada jugador/pareja).
                        </p>
                        <p>
                          No se aplican ascensos ni descensos a canchas fijas: las posiciones reflejan el rendimiento acumulado en sets y games a lo largo del certamen.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Award className="h-4 w-4 text-indigo-500" /> 2. Criterios de Desempate
                        </h3>
                        <p>
                          En caso de igualdad en la puntuación general, los criterios de ordenamiento son:
                        </p>
                        <ol className="list-decimal pl-4 space-y-1">
                          <li>Mayor diferencia de sets (Sets Ganados - Sets Perdidos).</li>
                          <li>Mayor diferencia de games (Games a Favor - Games en Contra).</li>
                          <li>Mayor cantidad de games ganados.</li>
                        </ol>
                      </div>
                    </>
                  ) : torneo?.modalidad === "parejas" ? (
                    <>
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Trophy className="h-4 w-4 text-secondary" /> 1. Dinámica y Competencia (Parejas)
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
                        <ul className="list-disc pl-4 space-y-1 border-l-2 border-secondary pl-2">
                          <li className="text-secondary dark:text-secondary font-medium">Si una pareja falta o utiliza más de 2 suplencias acumuladas, se le contará como partido perdido por W.O. / Forfeit (6-0, 6-0) y sumarán únicamente 1 punto de fecha jugada.</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 1. DINÁMICA GENERAL Y ESTRUCTURA */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Trophy className="h-4 w-4 text-secondary" /> 1. Dinámica General y Estructura
                        </h3>
                        <p>
                          Liga individual por acumulación de puntos semanales. El certamen consta de **10 semanas consecutivas** divididas en tres etapas estratégicas donde cada participante suma puntos de manera personal a una tabla unificada:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                            <span className="font-bold text-foreground text-xs block mb-1">Semana 1: Inicial</span>
                            <span className="text-[11px] leading-relaxed block text-muted-foreground">Sorteo inicial de los 12 participantes para determinar canchas base y parejas de apertura.</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                            <span className="font-bold text-foreground text-xs block mb-1">Semanas 2 a 8: Regular</span>
                            <span className="text-[11px] leading-relaxed block text-muted-foreground">7 fechas puntuables con ascensos y descensos automáticos según ranking semanal acumulado.</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/30">
                            <span className="font-bold text-purple-400 text-xs block mb-1">Semanas 9 y 10: Definición</span>
                            <span className="text-[11px] leading-relaxed block text-muted-foreground">Playoffs a tabla viva con bonus de puntos y coronación final de la liga.</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. PARTICIPANTES Y ASIGNACIÓN DE CANCHAS */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Users className="h-4 w-4 text-primary" /> 2. Participantes y Asignación de Canchas
                        </h3>
                        <p>
                          Participan **12 jugadores distribuidos en 3 canchas** (4 jugadores por cancha):
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                          <li>**Cancha 1 (Élite)**: Puestos 1.º al 4.º</li>
                          <li>**Cancha 2 (Desafío)**: Puestos 5.º al 8.º</li>
                          <li>**Cancha 3 (Base)**: Puestos 9.º al 12.º</li>
                        </ul>
                        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                          <span className="font-semibold text-foreground block mb-0.5">Equidad de Cruces Semanales:</span>
                          Para garantizar partidos parejos, dentro de cada cancha la pareja se conforma cruzando extremos de la tabla:  
                          <strong className="text-foreground"> (Mejor + Peor) vs (Dos Intermedios)</strong> → Ej. C1: <code className="text-secondary font-mono">[1º + 4º] vs [2º + 3º]</code> | C2: <code className="text-secondary font-mono">[5º + 8º] vs [6º + 7º]</code>.
                        </div>
                      </div>

                      {/* 3. FORMATO DE LOS PARTIDOS */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <CalendarDays className="h-4 w-4 text-indigo-500" /> 3. Formato de los Partidos
                        </h3>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                          <li>**Duración y Sets**: Turno estricto de 1 hora. Se juega al mejor de 2 sets con games tradicionales.</li>
                          <li>**Empate 6-6**: Tiebreak a 7 puntos sin diferencia obligatoria.</li>
                          <li>**Empate 1-1 en sets**: Supertiebreak a 7 puntos "a morir" (el primero que llega a 7 puntos gana el partido).</li>
                          <li>**Límite de Tiempo**: Si la hora de turno concluye antes de finalizar el partido pactado, se otorgará como ganadora a la dupla que mantenga la ventaja en el marcador general al momento del cese.</li>
                        </ul>
                      </div>

                      {/* 4. SISTEMA DE PUNTOS Y MOVILIDAD (FASE REGULAR) */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <TrendingUp className="h-4 w-4 text-emerald-500" /> 4. Sistema de Puntos y Movilidad Semanal (Fechas 1 a 8)
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border border-border/50 rounded-lg">
                            <thead className="bg-muted/60 text-muted-foreground text-[10px] uppercase font-bold">
                              <tr>
                                <th className="p-2">Cancha</th>
                                <th className="p-2">Nivel / Rango</th>
                                <th className="p-2">Victoria</th>
                                <th className="p-2">Derrota</th>
                                <th className="p-2">Movimiento Semanal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              <tr>
                                <td className="p-2 font-bold text-purple-400">Cancha 1</td>
                                <td className="p-2">Puestos 1º a 4º (Élite)</td>
                                <td className="p-2 font-bold text-emerald-400">+4 pts</td>
                                <td className="p-2 text-muted-foreground">+1 pt</td>
                                <td className="p-2 text-[11px]">Los 2 peores bajan a Cancha 2</td>
                              </tr>
                              <tr>
                                <td className="p-2 font-bold text-indigo-400">Cancha 2</td>
                                <td className="p-2">Puestos 5º a 8º (Desafío)</td>
                                <td className="p-2 font-bold text-emerald-400">+3 pts</td>
                                <td className="p-2 text-muted-foreground">+1 pt</td>
                                <td className="p-2 text-[11px]">Los 2 mejores suben a C1 · Los 2 peores bajan a C3</td>
                              </tr>
                              <tr>
                                <td className="p-2 font-bold text-muted-foreground">Cancha 3</td>
                                <td className="p-2">Puestos 9º a 12º (Base)</td>
                                <td className="p-2 font-bold text-emerald-400">+2 pts</td>
                                <td className="p-2 text-muted-foreground">+1 pt</td>
                                <td className="p-2 text-[11px]">Los 2 mejores suben a Cancha 2</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
                          <strong>Política de Ausencias y Reemplazos:</strong> Cada participante puede ausentarse hasta 2 fechas en todo el certamen conservando puntaje promedio asignado a su cancha o mediante suplente habilitado (abonando la fecha). A partir de la 3.ª ausencia, sumará 0 puntos en dicha jornada y quedará sujeto a reemplazo definitivo.
                        </div>
                      </div>

                      {/* 5. DEFINICIÓN Y PLAYOFFS (SEMANAS 9 Y 10) */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <Award className="h-4 w-4 text-purple-400" /> 5. Definición y Playoffs (Semanas 9 y 10) · Etapa Final a Tabla Viva
                        </h3>
                        <p>
                          El certamen mantiene la sumatoria acumulada individual hasta la última pelota de la Fecha 10. Las dos fechas de definición se juegan en simultáneo bajo el esquema de **Bonus de Playoff a 2 Sets** (con super tie-break en caso de 1-1):
                        </p>
                        
                        <div className="space-y-3 pl-2.5 border-l-2 border-purple-500/40 mt-2">
                          <div>
                            <span className="font-bold text-xs text-purple-400 block">🟡 Semana 9: Cruces Clasificatorios y Asignación de Bonus</span>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Al término de la Fecha 8 se consolida la tabla general acumulada (1º al 12º) y se arman las llaves:
                            </p>
                            <ul className="list-disc pl-4 text-[11px] space-y-0.5 mt-1 text-muted-foreground">
                              <li><strong>C1 (Zona Alta, 1º al 4º)</strong>: Nº 1 y Nº 4 vs Nº 2 y Nº 3</li>
                              <li><strong>C2 (Zona Media, 5º al 8º)</strong>: Nº 5 y Nº 8 vs Nº 6 y Nº 7</li>
                              <li><strong>C3 (Zona Baja, 9º al 12º)</strong>: Nº 9 y Nº 12 vs Nº 10 y Nº 11</li>
                            </ul>
                            <div className="mt-1.5 font-semibold text-xs text-foreground bg-purple-950/30 border border-purple-500/30 p-2 rounded">
                              Puntaje Semana 9: Pareja Ganadora: <span className="text-emerald-400 font-bold">+4 pts</span> individuales | Pareja Perdedora: <span className="text-muted-foreground font-bold">+1 pt</span> individual (en todas las canchas).
                            </div>
                          </div>

                          <div className="pt-1">
                            <span className="font-bold text-xs text-secondary block">🥇 Semana 10: Gran Definición por Tabla Viva</span>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Las canchas se reconfiguran con la tabla actualizada tras la Semana 9, permitiendo ascensos de lote de último momento:
                            </p>
                            <ul className="list-disc pl-4 text-[11px] space-y-0.5 mt-1 text-muted-foreground">
                              <li><strong>🏆 Cancha 1: Título</strong> (Nuevos Puestos 1º al 4º acumulados): Nº 1 y Nº 4 vs Nº 2 y Nº 3 → <em className="text-secondary font-medium">Define la Campeona Oficial</em></li>
                              <li><strong>🥈 Cancha 2: Copa Plata</strong> (Nuevos Puestos 5º al 8º acumulados): Nº 5 y Nº 8 vs Nº 6 y Nº 7 → <em className="text-muted-foreground">Disputa puestos 5º a 8º</em></li>
                              <li><strong>🥉 Cancha 3: Copa Bronce</strong> (Nuevos Puestos 9º al 12º acumulados): Nº 9 y Nº 12 vs Nº 10 y Nº 11 → <em className="text-muted-foreground">Disputa puestos 9º a 12º</em></li>
                            </ul>
                            <div className="mt-1.5 font-semibold text-xs text-foreground bg-amber-500/10 border border-amber-500/30 p-2 rounded">
                              Súper Puntaje Fecha Final: Pareja Ganadora: <span className="text-emerald-400 font-bold">+6 pts</span> individuales | Pareja Perdedora: <span className="text-muted-foreground font-bold">+2 pts</span> individuales (en todas las canchas).
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 6. CORONACIÓN Y CRITERIOS DE DESEMPATE */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 6. Coronación y Criterios de Desempate
                        </h3>
                        <p>
                          Finalizados los partidos de la Semana 10 y cargados los puntajes definitivos:
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs">
                          <li><strong>Campeona</strong>: 1.º Puesto de la tabla general acumulada.</li>
                          <li><strong>Subcampeona</strong>: 2.º Puesto de la tabla general acumulada.</li>
                          <li><strong>3.º al 12.º Puesto</strong>: Orden estricto por sumatoria acumulada total.</li>
                        </ul>
                        <div className="p-2 rounded bg-muted/40 border border-border/40 text-[11px] text-muted-foreground">
                          <strong>Criterios de Desempate (en caso de igualdad de puntos en cualquier posición):</strong>
                          <ol className="list-decimal pl-4 space-y-0.5 mt-1">
                            <li>Mayor diferencia de sets en todo el torneo.</li>
                            <li>Mayor diferencia de games en todo el torneo.</li>
                            <li>Enfrentamiento directo en fechas de definición (Semanas 9 y 10).</li>
                            <li>Sorteo en caso de persistir la paridad.</li>
                          </ol>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              )}
            </TabsContent>
            )}

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
                          <DollarSign className="h-4 w-4 text-primary" />
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
                              <Badge className="bg-primary text-white hover:bg-primary text-[10px] font-bold uppercase px-2.5 py-0.5 shadow-none border-none">
                                Cubierto
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-pink-950/40 border border-pink-500/30 text-pink-300 text-[10px] font-bold uppercase px-2.5 py-0.5 shadow-none">
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
                          <Trophy className="h-4 w-4 text-secondary" />
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
                          <span className="font-mono font-bold text-primary dark:text-primary text-sm">
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
                          <span className="font-mono font-bold text-primary dark:text-primary text-sm">
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

      <CompartirRankingDialog
        isOpen={shareRankingOpen}
        onOpenChange={setShareRankingOpen}
        torneo={torneo}
        standings={standings}
        subtitulo={displaySubtitulo}
        esPuntosPorSet={esPuntosPorSet}
      />
    </div>
  );
}

