import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Tv,
  Maximize2,
  Minimize2,
  Clock,
  Calendar,
  Flame,
  Zap,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Award,
  Users,
  CheckCircle2,
  Radio,
  ArrowLeft,
  LayoutGrid,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import {
  isLigaParejasTournament,
  extractWOFromNotas,
  compareLigaParejasStandings,
  applyManualPositions,
  extractPosicionManualFromNotas,
  extractPodioFinalFromNotas,
  extractFotoFromNotas,
} from "@/logic/torneoStandings";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];
type TorneoJugador = Database["public"]["Tables"]["torneo_individual_jugadores"]["Row"] & { jugador?: Jugador };
type PartidoInd = Database["public"]["Tables"]["partidos_individuales"]["Row"] & {
  jugador1?: Jugador | null;
  jugador2?: Jugador | null;
  jugador3?: Jugador | null;
  jugador4?: Jugador | null;
  sets?: SetPartidoInd[];
  foto_url?: string | null;
};
type SetPartidoInd = Database["public"]["Tables"]["sets_partido_individual"]["Row"];
type TorneoFecha = Database["public"]["Tables"]["torneo_individual_fechas"]["Row"];

export default function TorneoTvView() {
  const { id } = useParams<{ id: string }>();

  // Main state
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [jugadoresInscriptos, setJugadoresInscriptos] = useState<TorneoJugador[]>([]);
  const [parejas, setParejas] = useState<any[]>([]);
  const [fechas, setFechas] = useState<TorneoFecha[]>([]);
  const [partidos, setPartidos] = useState<PartidoInd[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFechaNum, setSelectedFechaNum] = useState<number>(1);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<string>("");

  // TV view controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Keyboard shortcuts (F for fullscreen, S for sidebar, Left/Right for fecha)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setShowSidebar((prev) => !prev);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedFechaNum((prev) => Math.max(1, prev - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const maxFecha = torneo?.desafio_semanas ?? 11;
        setSelectedFechaNum((prev) => Math.min(maxFecha, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [torneo]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Fetch data
  const fetchData = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);

    try {
      const [tRes, fRes, jRes, pRes, mRes] = await Promise.all([
        supabase.from("torneos").select("*").eq("id", id).single(),
        supabase.from("torneo_individual_fechas").select("*").eq("torneo_id", id).order("fecha"),
        supabase
          .from("torneo_individual_jugadores")
          .select("*, jugador:jugadores(*)")
          .eq("torneo_id", id),
        supabase
          .from("torneo_individual_parejas")
          .select("*, jugador1:jugador1_id(*), jugador2:jugador2_id(*)")
          .eq("torneo_id", id),
        supabase
          .from("partidos_individuales")
          .select(`
            *,
            jugador1:jugador1_id(*),
            jugador2:jugador2_id(*),
            jugador3:jugador3_id(*),
            jugador4:jugador4_id(*),
            sets:sets_partido_individual(*)
          `)
          .eq("torneo_id", id),
      ]);

      if (tRes.data) setTorneo(tRes.data);
      if (fRes.data) {
        setFechas(fRes.data);
        // Default to latest published or active fecha on initial load
        if (!silent) {
          const published = fRes.data.filter((f) => f.publicado);
          if (published.length > 0) {
            setSelectedFechaNum(published[published.length - 1].fecha);
          } else if (fRes.data.length > 0) {
            setSelectedFechaNum(fRes.data[0].fecha);
          }
        }
      }
      if (jRes.data) setJugadoresInscriptos(jRes.data as any);
      if (pRes.data) setParejas(pRes.data);
      if (mRes.data) setPartidos(mRes.data as any);

      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error loading TV data", e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`torneo_tv_${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partidos_individuales", filter: `torneo_id=eq.${id}` },
        () => fetchData(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "torneo_individual_fechas", filter: `torneo_id=eq.${id}` },
        () => fetchData(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchData]);

  // Format helpers
  const isLigaParejas = useMemo(() => isLigaParejasTournament(torneo), [torneo]);

  // Standings computation
  const standings = useMemo((): any[] => {
    if (!torneo) return [];
    const countCanchas = torneo.canchas_count ?? 3;

    if (torneo.modalidad === "parejas") {
      const standingsMap = new Map<string, any>();
      parejas.forEach((p) => {
        let initialPts = Number((p as any).puntos_iniciales) || 0;
        if (!initialPts && torneo?.notas) {
          const matchTag = torneo.notas.match(new RegExp(`\\[PUNTOS_INICIALES_${p.id}:(\\d+(?:\\.\\d+)?)\\]`));
          if (matchTag && matchTag[1]) {
            initialPts = Number(matchTag[1]);
          }
        }

        const manualPos = typeof (p as any).posicion_manual === "number" && (p as any).posicion_manual > 0
          ? (p as any).posicion_manual
          : extractPosicionManualFromNotas(torneo?.notas, p.id);

        standingsMap.set(p.id, {
          pareja_id: p.id,
          jugador1_id: p.jugador1_id,
          jugador2_id: p.jugador2_id,
          jugador1: p.jugador1,
          jugador2: p.jugador2,
          posicion_manual: manualPos,
          podio_final: (p as any).podio_final ?? extractPodioFinalFromNotas(torneo?.notas, p.id),
          puntos: initialPts,
          puntos_iniciales: initialPts,
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

        const setsP1 = m.sets_pareja1 ?? 0;
        const setsP2 = m.sets_pareja2 ?? 0;
        const p1Won = setsP1 > setsP2;

        if (isLigaParejas) {
          const woTeam = extractWOFromNotas(torneo?.notas, m.id);
          if (woTeam === 1) {
            sA.puntos -= 1;
            sB.puntos += 3;
            sB.setsGanados += 2;
            sA.setsPerdidos += 2;
            sB.gamesGanados += 12;
            sA.gamesPerdidos += 12;
          } else if (woTeam === 2) {
            sB.puntos -= 1;
            sA.puntos += 3;
            sA.setsGanados += 2;
            sB.setsPerdidos += 2;
            sA.gamesGanados += 12;
            sB.gamesPerdidos += 12;
          } else {
            const isSTB = (setsP1 === 2 && setsP2 === 1) || (setsP1 === 1 && setsP2 === 2);
            if (p1Won) {
              sA.puntos += isSTB ? 2 : 3;
              sB.puntos += isSTB ? 1 : 0;
            } else {
              sB.puntos += isSTB ? 2 : 3;
              sA.puntos += isSTB ? 1 : 0;
            }

            sA.setsGanados += setsP1;
            sA.setsPerdidos += setsP2;
            sB.setsGanados += setsP2;
            sB.setsPerdidos += setsP1;

            let gA = 0;
            let gB = 0;
            m.sets?.forEach((s: any) => {
              gA += s.games_pareja1 || 0;
              gB += s.games_pareja2 || 0;
            });

            sA.gamesGanados += gA;
            sA.gamesPerdidos += gB;
            sB.gamesGanados += gB;
            sB.gamesPerdidos += gA;
          }
        } else {
          // Standard Desafío Parejas
          const courtMatch = m.cancha.match(/\d+/);
          const courtIndex = courtMatch ? parseInt(courtMatch[0], 10) : 1;
          const ptsWinner = countCanchas - courtIndex + 2;
          const ptsLoser = 1;

          sA.puntos += p1Won ? ptsWinner : ptsLoser;
          sB.puntos += !p1Won ? ptsWinner : ptsLoser;

          sA.setsGanados += setsP1;
          sA.setsPerdidos += setsP2;
          sB.setsGanados += setsP2;
          sB.setsPerdidos += setsP1;

          let gA = 0;
          let gB = 0;
          m.sets?.forEach((s: any) => {
            gA += s.games_pareja1 || 0;
            gB += s.games_pareja2 || 0;
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

      const defaultSorter = (a: any, b: any) => {
        if (isLigaParejas) {
          return compareLigaParejasStandings(a, b, finalizedMatches);
        }
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.difSets !== a.difSets) return b.difSets - a.difSets;
        if (b.difGames !== a.difGames) return b.difGames - a.difGames;
        return 0;
      };

      return applyManualPositions(list, defaultSorter);
    }

    // Individual Americano
    const standingsMap = new Map<string, any>();
    jugadoresInscriptos.forEach((tj) => {
      if (tj.jugador) {
        let initialPts = Number((tj as any).puntos_iniciales) || 0;
        if (!initialPts && torneo?.notas) {
          const matchTag = torneo.notas.match(new RegExp(`\\[PUNTOS_INICIALES_${tj.jugador_id}:(\\d+(?:\\.\\d+)?)\\]`));
          if (matchTag && matchTag[1]) {
            initialPts = Number(matchTag[1]);
          }
        }

        const manualPos = typeof (tj as any).posicion_manual === "number" && (tj as any).posicion_manual > 0
          ? (tj as any).posicion_manual
          : extractPosicionManualFromNotas(torneo?.notas, tj.jugador_id);

        standingsMap.set(tj.jugador_id, {
          jugador_id: tj.jugador_id,
          nombre: tj.jugador.nombre,
          apellido: tj.jugador.apellido,
          dni: tj.jugador.dni,
          club: tj.jugador.club,
          puntos: initialPts,
          puntos_iniciales: initialPts,
          setsGanados: 0,
          setsPerdidos: 0,
          gamesGanados: 0,
          gamesPerdidos: 0,
          difGames: 0,
          partidosJugados: 0,
          posicion_manual: manualPos,
          podio_final: (tj as any).podio_final ?? extractPodioFinalFromNotas(torneo?.notas, tj.jugador_id),
        });
      }
    });

    const finalizedMatches = partidos.filter((m) => m.estado === "finalizado");
    finalizedMatches.forEach((p) => {
      const courtMatch = p.cancha.match(/\d+/);
      const courtIndex = courtMatch ? parseInt(courtMatch[0], 10) : 1;
      const ptsWinner = countCanchas - courtIndex + 2;
      const ptsLoser = 1;
      const p1Won = (p.sets_pareja1 ?? 0) > (p.sets_pareja2 ?? 0);

      let gamesP1 = 0;
      let gamesP2 = 0;
      p.sets?.forEach((s) => {
        gamesP1 += s.games_pareja1 || 0;
        gamesP2 += s.games_pareja2 || 0;
      });

      const award = (jId: string | null, won: boolean, absent: boolean, gOwn: number, gOpp: number, sOwn: number, sOpp: number) => {
        if (!jId) return;
        const s = standingsMap.get(jId);
        if (!s) return;
        if (!absent) s.partidosJugados++;
        s.puntos += absent ? 0 : (won ? ptsWinner : ptsLoser);
        s.setsGanados += sOwn;
        s.setsPerdidos += sOpp;
        s.gamesGanados += gOwn;
        s.gamesPerdidos += gOpp;
      };

      award(p.jugador1_id, p1Won, !!p.suplente1_nombre, gamesP1, gamesP2, p.sets_pareja1 ?? 0, p.sets_pareja2 ?? 0);
      award(p.jugador2_id, p1Won, !!p.suplente2_nombre, gamesP1, gamesP2, p.sets_pareja1 ?? 0, p.sets_pareja2 ?? 0);
      award(p.jugador3_id, !p1Won, !!p.suplente3_nombre, gamesP2, gamesP1, p.sets_pareja2 ?? 0, p.sets_pareja1 ?? 0);
      award(p.jugador4_id, !p1Won, !!p.suplente4_nombre, gamesP2, gamesP1, p.sets_pareja2 ?? 0, p.sets_pareja1 ?? 0);
    });

    const list = Array.from(standingsMap.values()).map((s) => ({
      ...s,
      difSets: s.setsGanados - s.setsPerdidos,
      difGames: s.gamesGanados - s.gamesPerdidos,
    }));

    const defaultSorter = (a: any, b: any) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.difSets !== a.difSets) return b.difSets - a.difSets;
      if (b.difGames !== a.difGames) return b.difGames - a.difGames;
      return 0;
    };

    return applyManualPositions(list, defaultSorter);
  }, [torneo, parejas, partidos, isLigaParejas, jugadoresInscriptos]);

  // Current fecha matches
  const partidosDeFecha = useMemo(() => {
    return partidos
      .filter((p) => p.fecha === selectedFechaNum)
      .sort((a, b) => {
        const cA = parseInt(a.cancha.replace(/\D/g, "") || "99", 10);
        const cB = parseInt(b.cancha.replace(/\D/g, "") || "99", 10);
        return cA - cB;
      });
  }, [partidos, selectedFechaNum]);

  // Grid sizing based on court count
  const courtGridClass = useMemo(() => {
    const count = partidosDeFecha.length || 3;
    if (count === 1) return "grid-cols-1 max-w-4xl mx-auto";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count === 3) return "grid-cols-1 md:grid-cols-3";
    if (count === 4) return "grid-cols-1 sm:grid-cols-2 grid-rows-2";
    if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-rows-2";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  }, [partidosDeFecha.length]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#07070a] text-white flex flex-col font-sans select-none relative">
      {/* Background Cyber Glow & Grid Lines */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00f5d4]/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#8338ec]/15 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/[0.03] rounded-full blur-[200px]" />
        <div className="w-full h-full bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* TOP HEADER BAR */}
      <header className="relative z-10 h-16 border-b border-white/10 bg-[#0a0a12]/80 backdrop-blur-xl px-5 flex items-center justify-between shrink-0 shadow-lg">
        {/* Brand & Tournament Name */}
        <div className="flex items-center gap-3.5">
          <Link
            to={`/torneo-individual/${id}`}
            className="flex items-center gap-2 group text-white/80 hover:text-white transition-colors"
            title="Volver al Portal Público"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#8338ec] to-[#00f5d4] p-[1.5px] shadow-[0_0_15px_rgba(131,56,236,0.5)]">
              <div className="w-full h-full bg-[#0a0a12] rounded-[10px] flex items-center justify-center">
                <Tv className="h-4 w-4 text-[#00f5d4]" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="font-black text-sm tracking-wider bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                PADEL ID
              </span>
              <span className="text-[10px] text-[#00f5d4] font-bold block -mt-1 tracking-widest uppercase">
                TV BROADCAST
              </span>
            </div>
          </Link>

          <div className="h-7 w-[1px] bg-white/10 hidden md:block" />

          {/* Tournament Title & Category */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-extrabold tracking-tight text-white truncate max-w-[280px] md:max-w-md lg:max-w-lg">
                {torneo?.nombre || "Torneo en Vivo"}
              </h1>
              {isLigaParejas ? (
                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] uppercase font-bold tracking-wider hidden lg:inline-flex">
                  🏆 Liga Parejas (11 Semanas)
                </Badge>
              ) : (
                <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[9px] uppercase font-bold tracking-wider hidden lg:inline-flex">
                  {torneo?.modalidad === "parejas" ? "Desafío Parejas" : "Americano Individual"}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 font-medium truncate">
              {torneo?.sede || "Complejo Deportivo"} · {torneo?.categoria_libre || "Categoría Libre"}
            </p>
          </div>
        </div>

        {/* Date Selector & Live Status */}
        <div className="flex items-center gap-3">
          {/* Week Selector */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1 shadow-inner">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-neutral-400 hover:text-white hover:bg-white/10"
              onClick={() => setSelectedFechaNum((prev) => Math.max(1, prev - 1))}
              disabled={selectedFechaNum <= 1}
              title="Semana Anterior (Flecha Izquierda)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-2 text-center min-w-[110px]">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block tracking-wider">
                {isLigaParejas && selectedFechaNum === 11 ? "FINALÍSIMA" : "FECHA / SEMANA"}
              </span>
              <span className="text-xs font-black text-[#00f5d4] tracking-tight">
                {isLigaParejas && selectedFechaNum === 11 ? "SUPER DAY 11" : `Semana ${selectedFechaNum}`}
              </span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-neutral-400 hover:text-white hover:bg-white/10"
              onClick={() => setSelectedFechaNum((prev) => Math.min(torneo?.desafio_semanas ?? 11, prev + 1))}
              disabled={selectedFechaNum >= (torneo?.desafio_semanas ?? 11)}
              title="Semana Siguiente (Flecha Derecha)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Live Clock */}
          <div className="hidden sm:flex items-center gap-2 bg-[#00f5d4]/10 border border-[#00f5d4]/30 px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(0,245,212,0.15)]">
            <Clock className="h-3.5 w-3.5 text-[#00f5d4] animate-pulse" />
            <span className="font-mono text-xs font-extrabold text-[#00f5d4] tracking-widest">
              {currentTime || "--:--:--"}
            </span>
          </div>

          {/* Sidebar Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSidebar((prev) => !prev)}
            className={`h-9 px-2.5 text-xs font-bold border-white/10 ${
              showSidebar ? "bg-white/10 text-white" : "bg-transparent text-neutral-400 hover:text-white"
            }`}
            title="Mostrar / Ocultar Tabla de Posiciones (Tecla S)"
          >
            <Trophy className="h-3.5 w-3.5 mr-1 text-amber-400" />
            <span className="hidden md:inline">Tabla</span>
          </Button>

          {/* Fullscreen Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={toggleFullscreen}
            className="h-9 px-2.5 text-xs font-bold border-[#8338ec]/40 bg-[#8338ec]/20 hover:bg-[#8338ec]/30 text-white shadow-[0_0_15px_rgba(131,56,236,0.3)]"
            title="Alternar Pantalla Completa (Tecla F)"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5 mr-1" />
                <span className="hidden md:inline">Salir</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 mr-1" />
                <span className="hidden md:inline">Pantalla Completa</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* MAIN VIEWPORT (COURTS GRID + LEADERBOARD SIDEBAR) */}
      <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden p-3 md:p-4 gap-4">
        {/* COURTS GRID CONTAINER */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 text-[#00f5d4] animate-spin" />
              <p className="text-xs uppercase font-extrabold tracking-widest text-neutral-400">
                Sincronizando Pantalla Gigante...
              </p>
            </div>
          ) : partidosDeFecha.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-900/40 border border-white/10 rounded-2xl backdrop-blur-md">
              <Calendar className="h-12 w-12 text-neutral-600 mb-3" />
              <h3 className="text-lg font-bold text-white">No hay partidos programados para esta semana</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-md">
                El fixture de la Semana {selectedFechaNum} aún no ha sido generado o publicado por el organizador.
              </p>
            </div>
          ) : (
            <div className={`grid ${courtGridClass} gap-3 md:gap-4 h-full flex-1 min-h-0`}>
              {partidosDeFecha.map((partido, index) => {
                const hasWinner = partido.estado === "finalizado";
                const isPlaying = partido.estado === "en_juego" || (!hasWinner && (partido.sets?.length ?? 0) > 0);
                const isPending = partido.estado === "pendiente" && (partido.sets?.length ?? 0) === 0;

                // Photo resolution (column or notes tag)
                const fotoUrl =
                  partido.foto_url ||
                  (partido as any).imagen_url ||
                  extractFotoFromNotas(torneo?.notas, partido.id);

                // WO resolution
                const woTeam = extractWOFromNotas(torneo?.notas, partido.id);

                // Score analysis
                const setsP1 = partido.sets_pareja1 ?? 0;
                const setsP2 = partido.sets_pareja2 ?? 0;
                const p1Won = setsP1 > setsP2;
                const p2Won = setsP2 > setsP1;

                // Court label / Subtitle
                let courtSubtitle = "";
                if (isLigaParejas && selectedFechaNum === 11) {
                  if (partido.cancha.includes("Cancha 1")) courtSubtitle = "🏆 GRAN FINAL (1° vs 2°)";
                  else if (partido.cancha.includes("Cancha 2")) courtSubtitle = "🥉 DUELO POR EL PODIO (3° vs 4°)";
                  else courtSubtitle = "⚡ DUELO POR LA PERMANENCIA (5° vs 6°)";
                } else if (partido.cancha.includes("Élite")) {
                  courtSubtitle = "CANCHA ÉLITE";
                } else if (partido.cancha.includes("Desafío")) {
                  courtSubtitle = "CANCHA DESAFÍO";
                } else if (partido.cancha.includes("Base")) {
                  courtSubtitle = "CANCHA BASE";
                }

                // Couple names
                const p1Nombre = partido.jugador1
                  ? `${partido.jugador1.apellido} / ${partido.jugador2?.apellido || ""}`
                  : "Pareja A";
                const p2Nombre = partido.jugador3
                  ? `${partido.jugador3.apellido} / ${partido.jugador4?.apellido || ""}`
                  : "Pareja B";

                return (
                  <div
                    key={partido.id}
                    className={`rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between shadow-2xl backdrop-blur-xl ${
                      isPlaying
                        ? "border-[#00f5d4]/60 bg-gradient-to-b from-[#0a1219]/90 to-[#070b0f]/95 shadow-[0_0_35px_rgba(0,245,212,0.18)] ring-1 ring-[#00f5d4]/40"
                        : hasWinner
                        ? "border-white/10 bg-gradient-to-b from-neutral-900/85 to-[#09090e]/95"
                        : "border-white/10 bg-neutral-900/70"
                    }`}
                  >
                    {/* Background Multimedia Backdrop (Photo Overlay) */}
                    {fotoUrl && (
                      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                        <img
                          src={fotoUrl}
                          alt="Foto del Partido"
                          className="w-full h-full object-cover opacity-15 filter blur-[0.5px] scale-105 transition-transform duration-700 hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/80 to-[#07070a]/40" />
                      </div>
                    )}

                    {/* CARD HEADER */}
                    <div className="relative z-10 px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-black/30 backdrop-blur-md">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00f5d4] shadow-[0_0_8px_#00f5d4]" />
                          <span className="font-black text-xs md:text-sm tracking-widest uppercase text-white">
                            {partido.cancha.replace(/:\s*.*$/, "")}
                          </span>
                        </div>
                        {courtSubtitle && (
                          <span className="text-[10px] font-extrabold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full tracking-wider">
                            {courtSubtitle}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {fotoUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto(fotoUrl)}
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
                            title="Ver Foto del Partido"
                          >
                            <ImageIcon className="h-3.5 w-3.5 text-[#00f5d4]" />
                          </button>
                        )}

                        {woTeam ? (
                          <Badge variant="destructive" className="text-[9px] font-black uppercase px-2 py-0.5 tracking-wider">
                            W.O. P{woTeam}
                          </Badge>
                        ) : isPlaying ? (
                          <Badge className="bg-[#00f5d4] text-[#07070a] text-[10px] font-black uppercase px-2 py-0.5 tracking-widest animate-pulse border-none shadow-[0_0_12px_rgba(0,245,212,0.8)] flex items-center gap-1">
                            <Radio className="h-3 w-3 animate-spin" /> EN VIVO
                          </Badge>
                        ) : hasWinner ? (
                          <Badge className="bg-white/10 text-neutral-300 border border-white/20 text-[9px] font-extrabold uppercase px-2 py-0.5 tracking-wider">
                            FINALIZADO
                          </Badge>
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-400 flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            <Clock className="h-2.5 w-2.5" />
                            {partido.hora_programada ? partido.hora_programada.substring(0, 5) : "Por Jugar"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CARD BODY: TEAMS AND MATCHUP */}
                    <div className="relative z-10 p-4 md:p-5 flex-1 flex flex-col justify-center space-y-3">
                      {/* PAREJA A */}
                      <div
                        className={`p-3 rounded-xl border transition-all ${
                          hasWinner && p1Won
                            ? "bg-[#00f5d4]/10 border-[#00f5d4]/40 shadow-[0_0_20px_rgba(0,245,212,0.1)]"
                            : hasWinner
                            ? "bg-white/[0.02] border-transparent opacity-60"
                            : "bg-white/[0.04] border-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                              PAREJA A
                            </span>
                            {hasWinner && p1Won && (
                              <span className="text-[9px] font-black text-[#00f5d4] uppercase flex items-center gap-1">
                                <Award className="h-3 w-3" /> GANADORES
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-xs font-bold text-neutral-400">
                            {setsP1} {setsP1 === 1 ? "SET" : "SETS"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <h2 className="text-base md:text-lg lg:text-xl font-black tracking-tight text-white uppercase truncate">
                            {p1Nombre}
                          </h2>
                        </div>
                        {(partido.suplente1_nombre || partido.suplente2_nombre) && (
                          <div className="text-[10px] text-amber-400/90 font-medium mt-0.5">
                            Suplente: {[partido.suplente1_nombre, partido.suplente2_nombre].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </div>

                      {/* VS NEON SEPARATOR */}
                      <div className="flex items-center justify-center gap-3">
                        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent flex-1" />
                        <span className="text-[10px] font-black tracking-widest text-[#00f5d4] px-2 py-0.5 rounded-full bg-[#00f5d4]/10 border border-[#00f5d4]/20 shadow-[0_0_10px_rgba(0,245,212,0.2)]">
                          VS
                        </span>
                        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent flex-1" />
                      </div>

                      {/* PAREJA B */}
                      <div
                        className={`p-3 rounded-xl border transition-all ${
                          hasWinner && p2Won
                            ? "bg-[#00f5d4]/10 border-[#00f5d4]/40 shadow-[0_0_20px_rgba(0,245,212,0.1)]"
                            : hasWinner
                            ? "bg-white/[0.02] border-transparent opacity-60"
                            : "bg-white/[0.04] border-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                              PAREJA B
                            </span>
                            {hasWinner && p2Won && (
                              <span className="text-[9px] font-black text-[#00f5d4] uppercase flex items-center gap-1">
                                <Award className="h-3 w-3" /> GANADORES
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-xs font-bold text-neutral-400">
                            {setsP2} {setsP2 === 1 ? "SET" : "SETS"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <h2 className="text-base md:text-lg lg:text-xl font-black tracking-tight text-white uppercase truncate">
                            {p2Nombre}
                          </h2>
                        </div>
                        {(partido.suplente3_nombre || partido.suplente4_nombre) && (
                          <div className="text-[10px] text-amber-400/90 font-medium mt-0.5">
                            Suplente: {[partido.suplente3_nombre, partido.suplente4_nombre].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CARD FOOTER: LED SCOREBOARD */}
                    <div className="relative z-10 bg-black/40 border-t border-white/10 px-4 py-3 flex items-center justify-between">
                      {partido.sets && partido.sets.length > 0 ? (
                        <div className="w-full flex items-center justify-around gap-2">
                          {partido.sets.map((s) => {
                            const p1WonSet = (s.games_pareja1 ?? 0) > (s.games_pareja2 ?? 0);
                            const p2WonSet = (s.games_pareja2 ?? 0) > (s.games_pareja1 ?? 0);

                            return (
                              <div
                                key={s.id}
                                className="flex-1 flex flex-col items-center bg-white/[0.04] border border-white/10 rounded-lg py-1 px-2"
                              >
                                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                                  {s.numero_set === 3 ? "STB" : `SET ${s.numero_set}`}
                                </span>
                                <div className="flex items-center gap-2 font-mono text-lg md:text-xl font-black tracking-wider mt-0.5">
                                  <span className={p1WonSet ? "text-[#00f5d4] drop-shadow-[0_0_8px_#00f5d4]" : "text-neutral-400"}>
                                    {s.games_pareja1}
                                  </span>
                                  <span className="text-neutral-600 text-sm">-</span>
                                  <span className={p2WonSet ? "text-[#00f5d4] drop-shadow-[0_0_8px_#00f5d4]" : "text-neutral-400"}>
                                    {s.games_pareja2}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="w-full text-center py-1">
                          <span className="text-xs text-neutral-500 font-mono tracking-widest uppercase">
                            EN ESPERA DE INICIO
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* SIDEBAR: LIVE STANDINGS TICKER */}
        {showSidebar && (
          <aside className="w-72 lg:w-80 h-full flex flex-col bg-neutral-900/80 border border-white/10 rounded-2xl backdrop-blur-xl overflow-hidden shrink-0 shadow-2xl">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-white/10 bg-black/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span className="font-extrabold text-xs tracking-wider uppercase text-white">
                  TABLA DE POSICIONES
                </span>
              </div>
              <Badge className="bg-amber-400/15 text-amber-400 border border-amber-400/30 text-[9px] font-mono px-1.5 py-0">
                EN VIVO
              </Badge>
            </div>

            {/* Sidebar Table Content */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {standings.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500">
                  Calculando posiciones oficiales...
                </div>
              ) : (
                standings.map((s, idx) => {
                  const isTop3 = idx < 3;
                  const displayName = torneo?.modalidad === "parejas"
                    ? (s.jugador1 ? `${s.jugador1.apellido} / ${s.jugador2?.apellido || ""}` : "Pareja")
                    : `${s.apellido}, ${s.nombre?.[0] || ""}.`;

                  return (
                    <div
                      key={s.pareja_id || s.jugador_id}
                      className={`px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        idx === 0
                          ? "bg-amber-400/[0.07]"
                          : idx === 1
                          ? "bg-slate-400/[0.04]"
                          : idx === 2
                          ? "bg-amber-700/[0.05]"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Position Badge */}
                        <div
                          className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center font-mono shrink-0 ${
                            idx === 0
                              ? "bg-amber-400 text-neutral-950 shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                              : idx === 1
                              ? "bg-slate-300 text-neutral-950"
                              : idx === 2
                              ? "bg-amber-700 text-white"
                              : "bg-white/10 text-neutral-300"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        {/* Team Name */}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate max-w-[130px] lg:max-w-[150px]">
                            {displayName}
                          </p>
                          <p className="text-[10px] text-neutral-400 font-mono">
                            {s.partidosJugados} PJ · {s.setsGanados}-{s.setsPerdidos} Sets · {s.difGames > 0 ? `+${s.difGames}` : s.difGames} DG
                          </p>
                        </div>
                      </div>

                      {/* Points Total */}
                      <div className="text-right shrink-0">
                        <span className="font-mono text-sm font-black text-[#00f5d4] drop-shadow-[0_0_6px_rgba(0,245,212,0.4)]">
                          {s.puntos}
                        </span>
                        <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">
                          PTS
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-2.5 border-t border-white/10 bg-black/40 text-[10px] text-neutral-400 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Actualizado {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span>PADEL ID</span>
            </div>
          </aside>
        )}
      </div>

      {/* FULL PHOTO LIGHTBOX PREVIEW */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_50px_rgba(0,245,212,0.3)]">
            <img src={previewPhoto} alt="Foto del Partido" className="w-full h-full object-contain" />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/90 text-white rounded-full p-2 border border-white/20 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
