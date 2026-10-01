import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Copy, Loader2, MapPin, Maximize2, Minimize2, RefreshCw, Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractFotoFromNotas, extractFotoPositionFromNotas, type FotoPosition } from "@/logic/torneoStandings";
import { useOptionalTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

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
};

const numeroCancha = (cancha: string | null) => cancha?.match(/\d+/)?.[0] ?? null;
const esUrlDeFotoSegura = (value: string | null): value is string => Boolean(value && (/^https?:\/\//i.test(value) || /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)));

export default function TorneoTvCanchas() {
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

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      if (torneoIdsSolicitados.length === 0 && !tenant?.club?.id) {
        setError(true);
        setLoading(false);
        return;
      }
      try {
        const torneosQuery = supabase.from("torneos").select("id, nombre, tipo, canchas_asignadas, notas").eq("tipo", "oficial");
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
        const [{ data: zonas, error: errorZonas }, { data: llaves, error: errorLlaves }, { data: inscripciones, error: errorInscripciones }, { data: jugadores, error: errorJugadores }, { data: individuales, error: errorIndividuales }] = await Promise.all([
          supabase.from("zonas").select("id, nombre, torneo_id").in("torneo_id", torneoIds),
          supabase.from("llaves").select("id, torneo_id").in("torneo_id", torneoIds),
          supabase.from("inscripciones").select("id, jugador1_id, jugador2_id").in("torneo_id", torneoIds),
          (supabase as any).from("jugadores_publicos").select("id, nombre, apellido"),
          supabase.from("partidos_individuales").select("*").in("torneo_id", torneoIds),
        ]);
        if (errorZonas || errorLlaves || errorInscripciones || errorJugadores || errorIndividuales) throw errorZonas || errorLlaves || errorInscripciones || errorJugadores || errorIndividuales;
        const zonasLista = (zonas ?? []) as any[];
        const llavesLista = (llaves ?? []) as any[];
        const inscripcionesLista = (inscripciones ?? []) as any[];
        const jugadoresLista = (jugadores ?? []) as any[];
        const nombres = new Map<string, string>(torneosLista.map((torneo) => [torneo.id, torneo.nombre]));
        const notasTorneos = new Map<string, string | null>(torneosLista.map((torneo) => [torneo.id, torneo.notas]));
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

        const filas: PartidoTv[] = [];
        for (const partido of (partidosZonaRes.data ?? []) as any[]) {
          const torneoId = zonaTorneo.get(partido.zona_id);
          filas.push({ id: partido.id, torneoId: torneoId ?? "", torneoNombre: nombres.get(torneoId ?? "") ?? "Torneo", cancha: partido.cancha, estado: partido.estado, fechaHora: partido.fecha_hora, local: nombrePareja(partido.pareja_local_id), visitante: nombrePareja(partido.pareja_visitante_id), fotoUrl: extractFotoFromNotas(notasTorneos.get(torneoId ?? ""), partido.id), fotoPosition: extractFotoPositionFromNotas(notasTorneos.get(torneoId ?? ""), partido.id) ?? { x: 50, y: 16 } });
        }
        for (const partido of (partidosLlaveRes.data ?? []) as any[]) {
          const torneoId = llaveTorneo.get(partido.llave_id);
          filas.push({ id: partido.id, torneoId: torneoId ?? "", torneoNombre: nombres.get(torneoId ?? "") ?? "Torneo", cancha: partido.cancha, estado: partido.estado, fechaHora: partido.fecha_hora, local: nombrePareja(partido.pareja_local_id), visitante: nombrePareja(partido.pareja_visitante_id), fotoUrl: extractFotoFromNotas(notasTorneos.get(torneoId ?? ""), partido.id), fotoPosition: extractFotoPositionFromNotas(notasTorneos.get(torneoId ?? ""), partido.id) ?? { x: 50, y: 16 } });
        }
        for (const partido of (individuales ?? []) as any[]) {
          const jugadorNombre = (id: string | null, suplente?: string | null) => id ? jugadoresMap.get(id) ?? "Jugador" : suplente || "Por definir";
          const pareja1 = [jugadorNombre(partido.jugador1_id, partido.suplente1_nombre), jugadorNombre(partido.jugador2_id, partido.suplente2_nombre)].join(" / ");
          const pareja2 = [jugadorNombre(partido.jugador3_id, partido.suplente3_nombre), jugadorNombre(partido.jugador4_id, partido.suplente4_nombre)].join(" / ");
          const fechaHora = partido.fecha_programada ? `${partido.fecha_programada}T${partido.hora_programada || "00:00:00"}` : null;
          filas.push({ id: partido.id, torneoId: partido.torneo_id, torneoNombre: nombres.get(partido.torneo_id) ?? "Torneo", cancha: partido.cancha, estado: partido.estado, fechaHora, local: pareja1, visitante: pareja2, fotoUrl: partido.foto_url || extractFotoFromNotas(notasTorneos.get(partido.torneo_id), partido.id), fotoPosition: extractFotoPositionFromNotas(notasTorneos.get(partido.torneo_id), partido.id) ?? { x: 50, y: 16 } });
        }

        const visibles = filas.filter((partido) =>
          (partido.estado === "en_juego" || partido.estado === "programado" || (partido.estado === "pendiente" && partido.cancha)) &&
          partido.cancha,
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
        if (!cancelado) setLoading(false);
      }
    };
    setLoading(true);
    cargar();
    const interval = window.setInterval(cargar, 15000);
    return () => { cancelado = true; window.clearInterval(interval); };
  }, [torneoIdsSolicitados, tenant?.club?.id]);

  useEffect(() => {
    document.title = "Canchas en vivo | Padel ID TV";
    const syncFullscreen = () => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
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

  const canchas = Array.from({ length: cantidadCanchas }, (_, index) => String(index + 1));
  const canchasPorPagina = 3;
  const cantidadPaginasCanchas = Math.ceil(canchas.length / canchasPorPagina);
  const canchasVisibles = canchas.slice(paginaCanchas * canchasPorPagina, (paginaCanchas + 1) * canchasPorPagina);

  useEffect(() => {
    setPaginaCanchas((pagina) => pagina % Math.max(1, cantidadPaginasCanchas));
    if (cantidadPaginasCanchas <= 1) return;
    const interval = window.setInterval(() => {
      setPaginaCanchas((pagina) => (pagina + 1) % cantidadPaginasCanchas);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [cantidadPaginasCanchas]);

  return (
    <main className="min-h-screen bg-[#080b12] p-5 text-white sm:p-8">
      <header className="mx-auto mb-7 flex w-full flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300"><Tv className="h-4 w-4" /> Padel ID · En vivo</div>
          <h1 className="text-3xl font-black sm:text-5xl">Canchas en juego</h1>
          <p className="mt-2 text-sm text-white/55">{nombresTorneos.join(" · ") || "Torneos en curso"}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-white/55"><Activity className="h-4 w-4 animate-pulse text-rose-400" /> Actualización automática cada 15 segundos{cantidadPaginasCanchas > 1 ? ` · Canchas ${paginaCanchas * canchasPorPagina + 1}-${Math.min((paginaCanchas + 1) * canchasPorPagina, canchas.length)} de ${canchas.length}` : ""}{actualizado ? ` · ${actualizado.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</div>
          <button type="button" onClick={copiarEnlace} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-xs font-bold text-white/75 transition hover:bg-white/10" title="Copiar enlace de TV"><Copy className="h-4 w-4" /><span className="hidden sm:inline">Copiar enlace</span></button>
          <button type="button" onClick={alternarPantallaCompleta} className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-2 text-cyan-100 transition hover:bg-cyan-300/20" title={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"} aria-label={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}>
            {pantallaCompleta ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {loading && partidos.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center text-white/60"><Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-300" />Cargando partidos…</div>
      ) : error ? (
        <div className="mx-auto flex min-h-[40vh] max-w-xl flex-col items-center justify-center text-center"><RefreshCw className="mb-4 h-8 w-8 text-rose-300" /><h2 className="text-xl font-bold">No pudimos cargar los partidos</h2><p className="mt-2 text-sm text-white/55">Revisá la conexión y volvé a intentar.</p><button className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold" onClick={() => window.location.reload()}>Reintentar</button></div>
      ) : (
        <section
          className="mx-auto grid w-full items-start gap-4"
          style={{ gridTemplateColumns: `repeat(${canchasPorPagina}, minmax(0, 1fr))` }}
          aria-label="Partidos agrupados por cancha"
        >
          {canchasVisibles.map((cancha) => {
            const partidosCancha = partidos.filter((partido) => numeroCancha(partido.cancha) === cancha).sort((a, b) => {
              if (a.estado === "en_juego" && b.estado !== "en_juego") return -1;
              if (b.estado === "en_juego" && a.estado !== "en_juego") return 1;
              return new Date(a.fechaHora ?? 0).getTime() - new Date(b.fechaHora ?? 0).getTime();
            });
            return (
              <article key={cancha} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><h2 className="flex items-center gap-2 text-lg font-black"><MapPin className="h-5 w-5 text-cyan-300" />Cancha {cancha}</h2><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${partidosCancha.some((partido) => partido.estado === "en_juego") ? "bg-rose-400/15 text-rose-200" : "bg-white/10 text-white/55"}`}>{partidosCancha.some((partido) => partido.estado === "en_juego") ? "En juego" : "Disponible"}</span></div>
                <div className="space-y-3 p-4">
                  {partidosCancha.length === 0 ? <p className="py-8 text-center text-sm text-white/40">Sin partidos asignados</p> : partidosCancha.slice(0, 6).map((partido) => (
                    <div key={`${partido.torneoId}-${partido.id}`} className={`relative isolate overflow-hidden rounded-xl border p-4 ${partido.estado === "en_juego" ? "border-rose-300/40 bg-rose-400/[0.08]" : "border-white/10 bg-black/20"}`}>
                      {esUrlDeFotoSegura(partido.fotoUrl) && <>
                        <img src={partido.fotoUrl} alt={`Foto del partido ${partido.local} contra ${partido.visitante}`} loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50" style={{ objectPosition: `${partido.fotoPosition.x}% ${partido.fotoPosition.y}%` }} />
                        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#080b12]/70 via-[#080b12]/45 to-[#080b12]/25" />
                      </>}
                      <div className="relative z-10 mb-3 flex items-center justify-between gap-2"><span className="truncate text-[10px] font-black uppercase tracking-wider text-cyan-200">{partido.torneoNombre}</span><span className={`shrink-0 text-[10px] font-bold ${partido.estado === "en_juego" ? "text-rose-200" : "text-white/70"}`}>{partido.estado === "en_juego" ? "EN JUEGO" : partido.fechaHora ? new Date(partido.fechaHora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "PROGRAMADO"}</span></div>
                      <p className="relative z-10 truncate text-sm font-bold text-white">{partido.local}</p><p className="relative z-10 truncate text-sm font-bold text-white">{partido.visitante}</p>
                    </div>
                  ))}
                  {partidosCancha.length > 6 && <p className="text-center text-xs text-white/40">+ {partidosCancha.length - 6} partidos más</p>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
