import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Clock, Copy, Eye, Loader2, MapPin, Maximize2, Minimize2, Radio, RefreshCw, Sparkles, Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractFotoFromNotas, extractFotoPositionFromNotas, type FotoPosition } from "@/logic/torneoStandings";
import { useOptionalTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { LiveScoreSummary } from "@/components/marcador/LiveScoreSummary";
import type { PadelState } from "@/logic/padelLogic";
import ErrorBoundary from "@/components/ErrorBoundary";

type PartidoTv = {
  id: string;
  torneoId: string;
  torneoNombre: string;
  cancha: string | null;
  estado: string;
  fechaHora: string | null;
  local: string;
  visitante: string;
  fotoUrl: string | null;
  fotoPosition: FotoPosition;
  sets: { numero_set: number; games_local: number; games_visitante: number }[];
  marcadorEnVivo: PadelState | null;
};

const PARTIDOS_DEMO: PartidoTv[] = [
  {
    id: "demo-partido-1",
    torneoId: "demo-torneo-1",
    torneoNombre: "Torneo Oficial Padel ID · 5ta Caballeros",
    cancha: "Cancha 1",
    estado: "en_juego",
    fechaHora: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    local: "G. Belasteguín / F. Tapia",
    visitante: "A. Galán / J. Lebrón",
    fotoUrl: "/demo-partido-tv.jpg",
    fotoPosition: { x: 50, y: 15 },
    sets: [
      { numero_set: 1, games_local: 6, games_visitante: 4 },
      { numero_set: 2, games_local: 4, games_visitante: 2 },
    ],
    marcadorEnVivo: {
      nombres: { p1: "Belasteguín / Tapia", p2: "Galán / Lebrón" },
      config: { modoDeuce: true, superTieBreak3erSet: true, modoSoloSuperTieBreak: false, modoSoloTieBreak: false },
      sets: [{ p1: 6, p2: 4 }],
      games: { p1: 4, p2: 2 },
      points: { p1: 3, p2: 2 },
      currentSet: 2,
      server: "p1",
      isTieBreak: false,
      isSuperTieBreak: false,
      winner: null,
      history: [],
    },
  },
  {
    id: "demo-partido-2",
    torneoId: "demo-torneo-1",
    torneoNombre: "Torneo Oficial Padel ID · 5ta Caballeros",
    cancha: "Cancha 1",
    estado: "programado",
    fechaHora: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
    local: "M. Di Nenno / F. Stupaczuk",
    visitante: "P. Lima / F. Navarro",
    fotoUrl: "/demo-partido-tv.jpg",
    fotoPosition: { x: 50, y: 15 },
    sets: [],
    marcadorEnVivo: null,
  },
  {
    id: "demo-partido-3",
    torneoId: "demo-torneo-1",
    torneoNombre: "Torneo Oficial Padel ID · 6ta Damas",
    cancha: "Cancha 2",
    estado: "en_juego",
    fechaHora: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    local: "P. Josemaría / A. Sánchez",
    visitante: "G. Triay / M. Ortega",
    fotoUrl: "/demo-partido-tv.jpg",
    fotoPosition: { x: 50, y: 15 },
    sets: [
      { numero_set: 1, games_local: 7, games_visitante: 5 },
      { numero_set: 2, games_local: 3, games_visitante: 3 },
    ],
    marcadorEnVivo: {
      nombres: { p1: "Josemaría / Sánchez", p2: "Triay / Ortega" },
      config: { modoDeuce: true, superTieBreak3erSet: true, modoSoloSuperTieBreak: false, modoSoloTieBreak: false },
      sets: [{ p1: 7, p2: 5 }],
      games: { p1: 3, p2: 3 },
      points: { p1: 1, p2: 3 },
      currentSet: 2,
      server: "p2",
      isTieBreak: false,
      isSuperTieBreak: false,
      winner: null,
      history: [],
    },
  },
  {
    id: "demo-partido-4",
    torneoId: "demo-torneo-1",
    torneoNombre: "Torneo Oficial Padel ID · 7ma Mixto",
    cancha: "Cancha 3",
    estado: "finalizado",
    fechaHora: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    local: "C. Gutiérrez / D. Sanyo",
    visitante: "L. Campagnolo / J. Garrido",
    fotoUrl: "/demo-partido-tv.jpg",
    fotoPosition: { x: 50, y: 15 },
    sets: [
      { numero_set: 1, games_local: 6, games_visitante: 3 },
      { numero_set: 2, games_local: 6, games_visitante: 4 },
    ],
    marcadorEnVivo: null,
  },
];

type ScreenWakeLock = { release: () => Promise<void>; addEventListener: (type: string, listener: () => void) => void };
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: "screen") => Promise<ScreenWakeLock> } };

const numeroCancha = (cancha: string | null) => cancha?.match(/\d+/)?.[0] ?? null;
const esFechaDeHoyEnArgentina = (fechaHora: string | null) => {
  if (!fechaHora) return false;
  const fechaPartido = new Date(fechaHora);
  if (Number.isNaN(fechaPartido.getTime())) return false;
  const formatoFecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatoFecha.format(fechaPartido) === formatoFecha.format(new Date());
};
const esUrlDeFotoSegura = (value: string | null): value is string =>
  Boolean(value && (/^https?:\/\//i.test(value) || /^\//.test(value) || /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)));
const PLAYER_LOOKUP_BATCH_SIZE = 200;

function TorneoTvCanchasContent() {
  const [searchParams] = useSearchParams();
  const idsKey = searchParams.get("torneos") ?? "";
  const torneoIdsSolicitados = useMemo(() => idsKey.split(",").filter(Boolean), [idsKey]);
  const tenant = useOptionalTenant();
  const [nombresTorneos, setNombresTorneos] = useState<string[]>([]);
  const [partidos, setPartidos] = useState<PartidoTv[]>([]);
  const [cantidadCanchas, setCantidadCanchas] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [paginaCanchas, setPaginaCanchas] = useState(0);
  const [modoDemo, setModoDemo] = useState<boolean>(() => searchParams.get("demo") === "1" || searchParams.get("preview") === "1");
  const [bloqueoPantallaActivo, setBloqueoPantallaActivo] = useState<boolean | null>(null);
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);
  const notasTorneosRef = useRef(new Map<string, string | null>());
  const lastNotasRefreshAtRef = useRef(0);

  useEffect(() => {
    let cancelado = false;
    let cargando = false;
    const cargar = async () => {
      if (cargando) return;
      if (torneoIdsSolicitados.length === 0 && !tenant?.club?.id) {
        setError(true);
        setLoading(false);
        return;
      }
      cargando = true;
      try {
        const torneosQuery = supabase.from("torneos").select("id, nombre, tipo, canchas_asignadas").eq("tipo", "oficial");
        const { data: torneos, error: errorTorneos } = torneoIdsSolicitados.length
          ? await torneosQuery.in("id", torneoIdsSolicitados)
          : await torneosQuery.eq("club_id", tenant!.club!.id).eq("estado", "en_curso");
        if (errorTorneos) throw errorTorneos;
        const torneosLista = (torneos ?? []) as any[];
        const torneoIds = torneosLista.map((torneo) => torneo.id as string);
        if (torneoIds.length === 0) {
          if (!cancelado) {
            setNombresTorneos([]);
            setPartidos([]);
            setError(false);
            setActualizado(new Date());
          }
          return;
        }
        const [{ data: zonas, error: errorZonas }, { data: llaves, error: errorLlaves }, { data: inscripciones, error: errorInscripciones }, { data: individuales, error: errorIndividuales }] = await Promise.all([
          supabase.from("zonas").select("id, nombre, torneo_id").in("torneo_id", torneoIds),
          supabase.from("llaves").select("id, torneo_id").in("torneo_id", torneoIds),
          supabase.from("inscripciones").select("id, jugador1_id, jugador2_id").in("torneo_id", torneoIds),
          supabase.from("partidos_individuales").select("*").in("torneo_id", torneoIds),
        ]);
        if (errorZonas || errorLlaves || errorInscripciones || errorIndividuales) throw errorZonas || errorLlaves || errorInscripciones || errorIndividuales;
        const zonasLista = (zonas ?? []) as any[];
        const llavesLista = (llaves ?? []) as any[];
        const inscripcionesLista = (inscripciones ?? []) as any[];
        const individualesLista = (individuales ?? []) as any[];
        const jugadorIds = [...new Set([
          ...inscripcionesLista.flatMap((inscripcion) => [inscripcion.jugador1_id, inscripcion.jugador2_id]),
          ...individualesLista.flatMap((partido) => [partido.jugador1_id, partido.jugador2_id, partido.jugador3_id, partido.jugador4_id]),
        ].filter((jugadorId): jugadorId is string => Boolean(jugadorId)))];
        const jugadoresLista: any[] = [];
        for (let offset = 0; offset < jugadorIds.length; offset += PLAYER_LOOKUP_BATCH_SIZE) {
          const { data: jugadores, error: errorJugadores } = await (supabase as any)
            .from("jugadores_publicos")
            .select("id, nombre, apellido")
            .in("id", jugadorIds.slice(offset, offset + PLAYER_LOOKUP_BATCH_SIZE));
          if (errorJugadores) throw errorJugadores;
          jugadoresLista.push(...(jugadores ?? []));
        }

        const notasVencidas = Date.now() - lastNotasRefreshAtRef.current >= 120000;
        const faltanNotas = torneoIds.some((torneoId) => !notasTorneosRef.current.has(torneoId));
        if (notasVencidas || faltanNotas) {
          const { data: notasRows, error: errorNotas } = await supabase
            .from("torneos")
            .select("id, notas")
            .in("id", torneoIds);
          if (errorNotas) throw errorNotas;
          notasTorneosRef.current = new Map((notasRows ?? []).map((torneo) => [torneo.id, torneo.notas]));
          lastNotasRefreshAtRef.current = Date.now();
        }
        const nombres = new Map<string, string>(torneosLista.map((torneo) => [torneo.id, torneo.nombre]));
        const notasTorneos = notasTorneosRef.current;
        const maxCancha = torneosLista.reduce((max, torneo) => Math.max(max, ...(torneo.canchas_asignadas ?? []).map(Number).filter(Number.isFinite)), 0);
        const inscripcionesMap = new Map(inscripcionesLista.map((inscripcion) => [inscripcion.id, inscripcion]));
        const jugadoresMap = new Map(jugadoresLista.map((jugador) => [jugador.id, `${jugador.apellido ?? ""}, ${jugador.nombre ?? ""}`.trim().replace(/^, |, $/g, "")]));
        const nombrePareja = (inscripcionId: string | null) => {
          const inscripcion = inscripcionId ? inscripcionesMap.get(inscripcionId) : null;
          if (!inscripcion) return "Por definir";
          const nombresJugadores = [jugadoresMap.get(inscripcion.jugador1_id), jugadoresMap.get(inscripcion.jugador2_id)].filter(Boolean);
          return nombresJugadores.length ? nombresJugadores.join(" / ") : "Pareja";
        };
        const zonaTorneo = new Map(zonasLista.map((zona) => [zona.id, zona.torneo_id]));
        const llaveTorneo = new Map(llavesLista.map((llave) => [llave.id, llave.torneo_id]));
        const [partidosZonaRes, partidosLlaveRes] = await Promise.all([
          zonasLista.length ? supabase.from("partidos_zona").select("*").in("zona_id", zonasLista.map((zona) => zona.id)) : Promise.resolve({ data: [], error: null }),
          llavesLista.length ? supabase.from("partidos_llave").select("*").in("llave_id", llavesLista.map((llave) => llave.id)) : Promise.resolve({ data: [], error: null }),
        ]);
        if (partidosZonaRes.error || partidosLlaveRes.error) throw partidosZonaRes.error || partidosLlaveRes.error;

        const partidosZona = (partidosZonaRes.data ?? []) as any[];
        const partidosLlave = (partidosLlaveRes.data ?? []) as any[];
        const [setsZonaRes, setsLlaveRes, setsIndividualesRes] = await Promise.all([
          partidosZona.length ? supabase.from("sets_partido").select("partido_id, numero_set, games_local, games_visitante").in("partido_id", partidosZona.map((partido) => partido.id)) : Promise.resolve({ data: [], error: null }),
          partidosLlave.length ? supabase.from("sets_partido").select("partido_llave_id, numero_set, games_local, games_visitante").in("partido_llave_id", partidosLlave.map((partido) => partido.id)) : Promise.resolve({ data: [], error: null }),
          individuales?.length ? supabase.from("sets_partido_individual").select("partido_individual_id, numero_set, games_pareja1, games_pareja2").in("partido_individual_id", (individuales as any[]).map((partido) => partido.id)) : Promise.resolve({ data: [], error: null }),
        ]);
        if (setsZonaRes.error || setsLlaveRes.error || setsIndividualesRes.error) throw setsZonaRes.error || setsLlaveRes.error || setsIndividualesRes.error;
        const setsPorPartido = new Map<string, PartidoTv["sets"]>();
        for (const set of [...(setsZonaRes.data ?? []), ...(setsLlaveRes.data ?? [])] as any[]) {
          const id = set.partido_id ?? set.partido_llave_id;
          if (!id) continue;
          setsPorPartido.set(id, [...(setsPorPartido.get(id) ?? []), { numero_set: set.numero_set, games_local: set.games_local, games_visitante: set.games_visitante }]);
        }
        for (const sets of setsPorPartido.values()) sets.sort((a, b) => a.numero_set - b.numero_set);
        const setsIndividuales = new Map<string, PartidoTv["sets"]>();
        for (const set of (setsIndividualesRes.data ?? []) as any[]) {
          setsIndividuales.set(set.partido_individual_id, [...(setsIndividuales.get(set.partido_individual_id) ?? []), { numero_set: set.numero_set, games_local: set.games_pareja1, games_visitante: set.games_pareja2 }]);
        }
        for (const sets of setsIndividuales.values()) sets.sort((a, b) => a.numero_set - b.numero_set);

        const filas: PartidoTv[] = [];
        for (const partido of partidosZona) {
          const torneoId = zonaTorneo.get(partido.zona_id);
          filas.push({ id: partido.id, torneoId: torneoId ?? "", torneoNombre: nombres.get(torneoId ?? "") ?? "Torneo", cancha: partido.cancha, estado: partido.estado, fechaHora: partido.fecha_hora, local: nombrePareja(partido.pareja_local_id), visitante: nombrePareja(partido.pareja_visitante_id), fotoUrl: extractFotoFromNotas(notasTorneos.get(torneoId ?? ""), partido.id), fotoPosition: extractFotoPositionFromNotas(notasTorneos.get(torneoId ?? ""), partido.id) ?? { x: 50, y: 16 }, sets: setsPorPartido.get(partido.id) ?? [], marcadorEnVivo: partido.marcador_en_vivo ?? null });
        }
        for (const partido of partidosLlave) {
          const torneoId = llaveTorneo.get(partido.llave_id);
          filas.push({ id: partido.id, torneoId: torneoId ?? "", torneoNombre: nombres.get(torneoId ?? "") ?? "Torneo", cancha: partido.cancha, estado: partido.estado, fechaHora: partido.fecha_hora, local: nombrePareja(partido.pareja_local_id), visitante: nombrePareja(partido.pareja_visitante_id), fotoUrl: extractFotoFromNotas(notasTorneos.get(torneoId ?? ""), partido.id), fotoPosition: extractFotoPositionFromNotas(notasTorneos.get(torneoId ?? ""), partido.id) ?? { x: 50, y: 16 }, sets: setsPorPartido.get(partido.id) ?? [], marcadorEnVivo: partido.marcador_en_vivo ?? null });
        }
        for (const partido of (individuales ?? []) as any[]) {
          const jugadorNombre = (id: string | null, suplente?: string | null) => id ? jugadoresMap.get(id) ?? "Jugador" : suplente || "Por definir";
          const pareja1 = [jugadorNombre(partido.jugador1_id, partido.suplente1_nombre), jugadorNombre(partido.jugador2_id, partido.suplente2_nombre)].join(" / ");
          const pareja2 = [jugadorNombre(partido.jugador3_id, partido.suplente3_nombre), jugadorNombre(partido.jugador4_id, partido.suplente4_nombre)].join(" / ");
          const fechaHora = partido.fecha_programada ? `${partido.fecha_programada}T${partido.hora_programada || "00:00:00"}` : null;
          filas.push({ id: partido.id, torneoId: partido.torneo_id, torneoNombre: nombres.get(partido.torneo_id) ?? "Torneo", cancha: partido.cancha, estado: partido.estado, fechaHora, local: pareja1, visitante: pareja2, fotoUrl: partido.foto_url || extractFotoFromNotas(notasTorneos.get(partido.torneo_id), partido.id), fotoPosition: extractFotoPositionFromNotas(notasTorneos.get(partido.torneo_id), partido.id) ?? { x: 50, y: 16 }, sets: setsIndividuales.get(partido.id) ?? [], marcadorEnVivo: partido.marcador_en_vivo ?? null });
        }

        const visibles = filas.filter((partido) =>
          partido.estado === "finalizado" || ((partido.estado === "en_juego" || partido.estado === "programado" || (partido.estado === "pendiente" && partido.cancha)) && partido.cancha),
        );
        if (cancelado) return;
        setNombresTorneos(torneosLista.map((torneo) => torneo.nombre));
        // El club trabaja con tres canchas aunque los torneos activos solo tengan
        // partidos asignados a dos por el momento; la TV debe conservar las tres columnas.
        setCantidadCanchas(Math.max(3, maxCancha, ...visibles.map((partido) => Number(numeroCancha(partido.cancha) ?? 0))));
        setPartidos(visibles);
        setActualizado(new Date());
        setError(false);
      } catch (e) {
        console.error("No se pudieron cargar los partidos para la TV conjunta", e);
        if (!cancelado) setError(true);
      } finally {
        cargando = false;
        if (!cancelado) setLoading(false);
      }
    };
    setLoading(true);
    cargar();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, 30000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelado = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [torneoIdsSolicitados, tenant?.club?.id]);

  useEffect(() => {
    document.title = "Canchas en vivo | Padel ID TV";
    const syncFullscreen = () => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    let desmontado = false;
    let solicitando = false;
    const solicitarBloqueo = async () => {
      if (desmontado || solicitando || wakeLockRef.current || document.visibilityState !== "visible") return;
      const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
      if (!wakeLock) {
        setBloqueoPantallaActivo(false);
        return;
      }
      solicitando = true;
      try {
        const lock = await wakeLock.request("screen");
        if (desmontado || document.visibilityState !== "visible") {
          await lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
        setBloqueoPantallaActivo(true);
        lock.addEventListener("release", () => {
          if (wakeLockRef.current === lock) wakeLockRef.current = null;
          if (!desmontado) setBloqueoPantallaActivo(false);
        });
      } catch {
        if (!desmontado) setBloqueoPantallaActivo(false);
      } finally {
        solicitando = false;
      }
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") void solicitarBloqueo();
      else setBloqueoPantallaActivo(false);
    };
    void solicitarBloqueo();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("focus", solicitarBloqueo);
    return () => {
      desmontado = true;
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("focus", solicitarBloqueo);
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (lock) void lock.release().catch(() => {});
    };
  }, []);

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Enlace corto de TV copiado");
    } catch {
      toast.error("No se pudo copiar el enlace desde este dispositivo");
    }
  };

  const partidosAMostrar = modoDemo ? PARTIDOS_DEMO : partidos;
  const nombresTorneosAMostrar = modoDemo ? ["Torneo Apertura 2026 · Padel ID Broadcast (Previsualización)"] : nombresTorneos;
  const cantidadCanchasAMostrar = modoDemo ? 3 : cantidadCanchas;
  const canchas = Array.from({ length: cantidadCanchasAMostrar }, (_, index) => String(index + 1));
  const canchasPorPagina = 1;
  const resultadosFinales = partidosAMostrar
    .filter((partido) => partido.estado === "finalizado" && partido.sets.length > 0)
    .sort((a, b) => new Date(b.fechaHora ?? 0).getTime() - new Date(a.fechaHora ?? 0).getTime());
  const resultadosPorPagina = 6;
  const cantidadPaginasResultados = Math.ceil(resultadosFinales.length / resultadosPorPagina);
  const cantidadPantallas = canchas.length + cantidadPaginasResultados;
  const esPantallaResultados = paginaCanchas >= canchas.length;
  const paginaResultados = paginaCanchas - canchas.length;
  const canchasVisibles = esPantallaResultados ? [] : canchas.slice(paginaCanchas * canchasPorPagina, (paginaCanchas + 1) * canchasPorPagina);
  const resultadosVisibles = esPantallaResultados
    ? resultadosFinales.slice(paginaResultados * resultadosPorPagina, (paginaResultados + 1) * resultadosPorPagina)
    : [];

  useEffect(() => {
    setPaginaCanchas((pagina) => pagina % Math.max(1, cantidadPantallas));
    if (cantidadPantallas <= 1) return;
    const interval = window.setInterval(() => {
      setPaginaCanchas((pagina) => (pagina + 1) % cantidadPantallas);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [cantidadPantallas]);

  return (
    <main className="min-h-screen bg-[#080b12] p-5 text-white sm:p-8">
      <header className="mx-auto mb-7 flex w-full flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300"><Tv className="h-4 w-4" /> Padel ID · En vivo</div>
          <h1 className="text-3xl font-black sm:text-5xl">Canchas en juego</h1>
          <p className="mt-2 text-sm text-white/55">{nombresTorneosAMostrar.join(" · ") || "Torneos en curso"}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
            <span className="flex items-center gap-2"><Activity className="h-4 w-4 animate-pulse text-rose-400" /> Actualización cada 15 s{actualizado ? ` · ${actualizado.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
            {cantidadPantallas > 1 && <span className="text-cyan-200">{esPantallaResultados ? `Resultados · ${paginaResultados + 1}/${cantidadPaginasResultados}` : `Cancha ${canchas[paginaCanchas]}`} · pantalla {paginaCanchas + 1}/${cantidadPantallas} · rota cada 15 s</span>}
            <span className={bloqueoPantallaActivo ? "text-emerald-300" : "text-amber-200"}>{bloqueoPantallaActivo ? "Pantalla activa" : bloqueoPantallaActivo === false ? "Ahorro de pantalla según TV Bro" : "Activando pantalla"}</span>
          </div>

          {/* Botón de Modo Previsualización (Demo) */}
          <button
            type="button"
            onClick={() => setModoDemo((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-all shadow-md ${
              modoDemo
                ? "bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                : "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
            }`}
            title={modoDemo ? "Salir del modo previsualización" : "Activar previsualización con datos y fotos de prueba"}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">{modoDemo ? "Salir de Demo" : "Previsualización"}</span>
            <span className="sm:hidden">{modoDemo ? "Demo" : "Previa"}</span>
          </button>

          <button type="button" onClick={copiarEnlace} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-xs font-bold text-white/75 transition hover:bg-white/10" title="Copiar enlace de TV"><Copy className="h-4 w-4" /><span className="hidden sm:inline">Copiar enlace</span></button>
          <button type="button" onClick={alternarPantallaCompleta} className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-2 text-cyan-100 transition hover:bg-cyan-300/20" title={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"} aria-label={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}>
            {pantallaCompleta ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Banner de Modo Previsualización */}
      {modoDemo && (
        <div className="mx-auto mb-6 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-purple-600/15 to-cyan-500/15 p-3.5 sm:p-4 text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.15)] animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 shrink-0">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-extrabold text-amber-100 flex items-center gap-2">
                <span>Modo Previsualización Activo</span>
                <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-400/30">DATOS DE PRUEBA</span>
              </p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Mostrando partido de prueba "EN JUEGO" con foto ampliada al 45% de la pantalla, encuadre superior y tanteador LED en vivo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModoDemo(false)}
            className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-300 transition shadow"
          >
            Volver a modo normal
          </button>
        </div>
      )}

      {!modoDemo && loading && partidos.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center text-white/60"><Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-300" />Cargando partidos…</div>
      ) : !modoDemo && error ? (
        <div className="mx-auto flex min-h-[40vh] max-w-xl flex-col items-center justify-center text-center p-6">
          <RefreshCw className="mb-4 h-8 w-8 text-rose-300" />
          <h2 className="text-xl font-bold">No hay torneos en curso para proyectar</h2>
          <p className="mt-2 text-sm text-white/55">Como actualmente no tenés torneos en juego, podés activar el Modo Previsualización para ver el nuevo diseño con fotos en 45vh y marcadores.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 transition"
              onClick={() => setModoDemo(true)}
            >
              <Eye className="h-4 w-4" />
              Activar Modo Previsualización (Demo)
            </button>
            <button className="rounded-lg bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15 transition" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </div>
        </div>
      ) : !modoDemo && partidos.length === 0 ? (
        <div className="mx-auto flex min-h-[45vh] max-w-xl flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-950/20 shadow-2xl">
          <Tv className="h-12 w-12 text-cyan-400/60 mb-3 animate-pulse" />
          <h2 className="text-xl font-black text-white">Pantalla TV lista (Sin partidos activos)</h2>
          <p className="mt-2 text-sm text-white/60 max-w-md">
            No hay partidos en juego en este momento. Activá el <strong>Modo Previsualización</strong> para probar el diseño completo en tu televisor con un partido de muestra, fotos y tanteador LED.
          </p>
          <button
            type="button"
            onClick={() => setModoDemo(true)}
            className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-3 text-sm font-black text-white shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:scale-105 transition-transform"
          >
            <Eye className="h-4 w-4" />
            Activar Modo Previsualización (Demo)
          </button>
        </div>
      ) : (
        esPantallaResultados ? (
          <section className="mx-auto w-full" aria-label="Resultados de partidos finalizados">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black sm:text-2xl">Resultados recientes</h2><span className="text-xs text-white/50">{resultadosFinales.length} partidos finalizados</span></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {resultadosVisibles.map((partido) => {
                const resumenSets = partido.sets.map((set) => `${set.games_local}–${set.games_visitante}`).join("   ");
                return <article key={`${partido.torneoId}-${partido.id}`} className="relative isolate flex min-h-40 flex-col justify-between overflow-hidden rounded-xl border border-emerald-300/20 bg-[#111722] p-4">
                  {esUrlDeFotoSegura(partido.fotoUrl) && <><img src={partido.fotoUrl} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35" style={{ objectPosition: `${partido.fotoPosition.x}% ${partido.fotoPosition.y}%` }} /><div className="absolute inset-0 -z-10 bg-[#080b12]/55" /></>}
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-black uppercase tracking-wider text-cyan-200">{partido.torneoNombre}</span><span className="shrink-0 rounded-full bg-emerald-300/15 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-200">Finalizado</span></div>
                  <div className="my-3 space-y-1"><p className="truncate text-base font-bold">{partido.local}</p><p className="truncate text-base font-bold text-white/80">{partido.visitante}</p></div>
                  <div className="flex items-end justify-between gap-3 border-t border-white/10 pt-2"><span className="text-[10px] text-white/60">{partido.cancha || "Partido"}</span><span className="text-right font-mono text-sm font-black text-emerald-100">{resumenSets || partido.marcadorEnVivo?.sets.map((set) => `${set.p1}–${set.p2}`).join("   ") || "Resultado cargado"}</span></div>
                </article>;
              })}
            </div>
          </section>
        ) : (
        <section
          className="mx-auto grid w-full items-start gap-4"
          style={{ gridTemplateColumns: `repeat(${canchasPorPagina}, minmax(0, 1fr))` }}
          aria-label="Partidos agrupados por cancha"
        >
          {canchasVisibles.map((cancha) => {
            const partidosCancha = partidosAMostrar
              .filter((partido) =>
                numeroCancha(partido.cancha) === cancha &&
                (partido.estado === "en_juego" ||
                  ((partido.estado === "programado" || partido.estado === "pendiente") && esFechaDeHoyEnArgentina(partido.fechaHora))),
              )
              .sort((a, b) => {
                if (a.estado === "en_juego" && b.estado !== "en_juego") return -1;
                if (b.estado === "en_juego" && a.estado !== "en_juego") return 1;
                return new Date(a.fechaHora ?? 0).getTime() - new Date(b.fechaHora ?? 0).getTime();
              });

            const partidoEnJuego = partidosCancha.find((partido) => partido.estado === "en_juego");
            const otrosPartidos = partidosCancha.filter((partido) => partido.id !== partidoEnJuego?.id);

            return (
              <article key={cancha} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-white/[0.02]">
                  <h2 className="flex items-center gap-2 text-xl font-black">
                    <MapPin className="h-5 w-5 text-cyan-300" />
                    Cancha {cancha}
                  </h2>
                  <span
                    className={`rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wider ${
                      partidoEnJuego
                        ? "bg-rose-500/20 text-rose-200 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {partidoEnJuego ? "En juego" : otrosPartidos.length > 0 ? "Próximos partidos" : "Disponible"}
                  </span>
                </div>

                <div className="p-4 sm:p-6 space-y-5">
                  {partidosCancha.length === 0 ? (
                    <div className="flex min-h-[35vh] flex-col items-center justify-center text-center p-8 text-white/40">
                      <MapPin className="h-10 w-10 text-cyan-300/30 mb-3" />
                      <p className="text-base font-bold text-white/60">Cancha {cancha} disponible</p>
                      <p className="text-xs text-white/40 mt-1">Sin partidos asignados por el momento.</p>
                    </div>
                  ) : (
                    <>
                      {/* PARTIDO EN JUEGO (DESTACADO CON FOTO EN 45% DE ALTURA) */}
                      {partidoEnJuego && (
                        <div className="relative isolate overflow-hidden rounded-2xl border border-rose-400/40 bg-gradient-to-b from-[#141018] via-[#0d131f] to-[#080b12] p-5 sm:p-6 shadow-[0_0_35px_rgba(244,63,94,0.15)]">
                          {/* CONTENEDOR DE IMAGEN (OCUPA APROXIMADAMENTE 45% DE LA PANTALLA) */}
                          {esUrlDeFotoSegura(partidoEnJuego.fotoUrl) && (
                            <div className="relative w-full h-[45vh] min-h-[320px] max-h-[580px] rounded-xl overflow-hidden border border-white/15 bg-black/60 shadow-2xl mb-5">
                              <img
                                src={partidoEnJuego.fotoUrl}
                                alt={`Foto del partido ${partidoEnJuego.local} contra ${partidoEnJuego.visitante}`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                                style={{
                                  objectPosition: `${partidoEnJuego.fotoPosition?.x ?? 50}% ${Math.min(partidoEnJuego.fotoPosition?.y ?? 15, 25)}%`,
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                              <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
                                <span className="rounded-full bg-black/70 backdrop-blur-md px-3.5 py-1 text-xs font-black uppercase tracking-wider text-cyan-300 border border-white/10 shadow-lg">
                                  {partidoEnJuego.torneoNombre}
                                </span>
                                <span className="flex items-center gap-2 rounded-full bg-rose-500/90 backdrop-blur-md px-4 py-1 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(244,63,94,0.7)]">
                                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                                  EN JUEGO
                                </span>
                              </div>
                            </div>
                          )}

                          {/* HEADER DEL PARTIDO SI NO HAY FOTO */}
                          {!esUrlDeFotoSegura(partidoEnJuego.fotoUrl) && (
                            <div className="flex items-center justify-between gap-2 mb-4">
                              <span className="truncate text-xs font-black uppercase tracking-wider text-cyan-200">
                                {partidoEnJuego.torneoNombre}
                              </span>
                              <span className="flex items-center gap-1.5 rounded-full bg-rose-500/90 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]">
                                <Radio className="h-3.5 w-3.5 animate-pulse" />
                                EN JUEGO
                              </span>
                            </div>
                          )}

                          {/* PAREJAS Y MARCADOR */}
                          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-4 py-2">
                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 text-center md:text-left">
                              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80 block mb-1">
                                Pareja Local
                              </span>
                              <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                                {partidoEnJuego.local}
                              </h3>
                            </div>

                            <div className="flex flex-col items-center justify-center px-2">
                              <span className="text-xs font-black tracking-widest text-cyan-400 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 shadow-[0_0_12px_rgba(34,211,238,0.2)] mb-2">
                                VS
                              </span>
                              {partidoEnJuego.sets.length > 0 && (
                                <div className="font-mono text-xl sm:text-2xl font-black text-cyan-200 tracking-wider bg-black/50 px-4 py-1.5 rounded-lg border border-cyan-300/25 shadow-inner">
                                  {partidoEnJuego.sets.map((set) => `${set.games_local}–${set.games_visitante}`).join("   ")}
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 text-center md:text-right">
                              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80 block mb-1">
                                Pareja Visitante
                              </span>
                              <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                                {partidoEnJuego.visitante}
                              </h3>
                            </div>
                          </div>

                          {/* MARCADOR EN VIVO PUNTO POR PUNTO */}
                          {partidoEnJuego.marcadorEnVivo && (
                            <div className="mt-4 pt-3 border-t border-white/10">
                              <LiveScoreSummary state={partidoEnJuego.marcadorEnVivo} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* SI NO HAY PARTIDO EN JUEGO PERO HAY PARTIDOS PROGRAMADOS */}
                      {!partidoEnJuego && otrosPartidos.length > 0 && (
                        <div className="space-y-4">
                          {(() => {
                            const proximo = otrosPartidos[0];
                            return (
                              <div className="rounded-2xl border border-cyan-400/30 bg-white/[0.04] p-5 sm:p-6 shadow-xl">
                                {esUrlDeFotoSegura(proximo.fotoUrl) && (
                                  <div className="relative w-full h-[45vh] min-h-[300px] max-h-[560px] rounded-xl overflow-hidden border border-white/15 bg-black/60 shadow-2xl mb-5">
                                    <img
                                      src={proximo.fotoUrl}
                                      alt={`Foto del partido ${proximo.local} contra ${proximo.visitante}`}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                      style={{
                                        objectPosition: `${proximo.fotoPosition?.x ?? 50}% ${Math.min(proximo.fotoPosition?.y ?? 15, 25)}%`,
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
                                      <span className="rounded-full bg-black/70 backdrop-blur-md px-3.5 py-1 text-xs font-black uppercase tracking-wider text-cyan-300 border border-white/10 shadow-lg">
                                        {proximo.torneoNombre}
                                      </span>
                                      <span className="rounded-full bg-cyan-400/90 backdrop-blur-md px-4 py-1 text-xs font-black uppercase tracking-widest text-slate-950 font-bold shadow-lg">
                                        PRÓXIMO ENTRAR
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {!esUrlDeFotoSegura(proximo.fotoUrl) && (
                                  <div className="flex items-center justify-between gap-2 mb-4">
                                    <span className="truncate text-xs font-black uppercase tracking-wider text-cyan-200">
                                      {proximo.torneoNombre}
                                    </span>
                                    <span className="rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 px-3 py-1 text-xs font-black uppercase tracking-widest">
                                      PRÓXIMO PARTIDO
                                    </span>
                                  </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-4 py-2">
                                  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 text-center md:text-left">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80 block mb-1">
                                      Pareja Local
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                      {proximo.local}
                                    </h3>
                                  </div>
                                  <div className="flex flex-col items-center justify-center px-2">
                                    <span className="text-xs font-black tracking-widest text-cyan-400 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 mb-2">
                                      VS
                                    </span>
                                    {proximo.fechaHora && (
                                      <span className="text-xs font-mono text-white/70">
                                        {new Date(proximo.fechaHora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 text-center md:text-right">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80 block mb-1">
                                      Pareja Visitante
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                      {proximo.visitante}
                                    </h3>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* PRÓXIMOS TURNOS EN COLA */}
                      {(partidoEnJuego ? otrosPartidos : otrosPartidos.slice(1)).length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                          <div className="flex items-center gap-2 mb-3 text-xs font-black uppercase tracking-wider text-cyan-300/80">
                            <Clock className="h-3.5 w-3.5" />
                            <span>A continuación en Cancha {cancha}</span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {(partidoEnJuego ? otrosPartidos : otrosPartidos.slice(1)).slice(0, 3).map((p) => (
                              <div key={`${p.torneoId}-${p.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] transition-colors">
                                <div className="flex items-center justify-between text-[10px] text-white/50 mb-1.5">
                                  <span className="font-bold text-cyan-200 uppercase truncate max-w-[140px]">{p.torneoNombre}</span>
                                  <span className="font-mono text-white/70 shrink-0">
                                    {p.fechaHora ? new Date(p.fechaHora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "PROGRAMADO"}
                                  </span>
                                </div>
                                <p className="text-xs font-bold truncate text-white">{p.local}</p>
                                <p className="text-xs font-bold truncate text-white/70">{p.visitante}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
        )
      )}
    </main>
  );
}

export default function TorneoTvCanchas() {
  return (
    <ErrorBoundary
      fallbackTitle="Error en Pantalla TV"
      fallbackMessage="Ocurrió un problema inesperado al mostrar la pantalla de canchas. Podés reintentar para restablecer la vista."
    >
      <TorneoTvCanchasContent />
    </ErrorBoundary>
  );
}

