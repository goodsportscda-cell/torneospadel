import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClubBrand } from "@/hooks/useClubBrand";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { ZonaCard, type Zona } from "@/components/zonas/ZonaCard";
import { PartidoCard } from "@/components/zonas/PartidoCard";
import { NOMBRE_RONDA, ORDEN_RONDA, parseRef, type RondaLlave } from "@/lib/llaves";
import { extractFotoFromNotas } from "@/logic/torneoStandings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Check, Clock3, Copy, Maximize2, Minimize2, Radio, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { LiveScoreSummary } from "@/components/marcador/LiveScoreSummary";
import type { PadelState } from "@/logic/padelLogic";

type Torneo = {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  categoria_libre: string | null;
  numero_fecha: number | null;
  fecha_inicio: string;
  sede: string | null;
  club_id: string | null;
  canchas_count: number | null;
};
type JugadorPublico = { id: string; nombre: string; apellido: string };
type Inscripcion = { id: string; jugador1_id: string | null; jugador2_id: string | null };
type TVPartido = {
  id: string;
  origen: "zona" | "llave";
  fase: string;
  numero: number;
  parejaLocalId: string | null;
  parejaVisitanteId: string | null;
  refLocal: string | null;
  refVisitante: string | null;
  estado: string;
  cancha: string | null;
  fechaHora: string | null;
  ganadorId: string | null;
  sets: { numero_set: number; games_local: number; games_visitante: number }[];
  marcadorEnVivo: PadelState | null;
};

const parseCancha = (value: string | null) => value?.match(/\d+/)?.[0] ?? null;
const fmtHora = (value: string | null) => value
  ? new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  : null;
const fmtFecha = (value: string | null) => value
  ? new Date(value).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })
  : null;

export default function TorneoTvZonasLlaves() {
  const { id } = useParams<{ id: string }>();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const { nombre: nombreClub, logoUrl } = useClubBrand(torneo?.club_id);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [jugadores, setJugadores] = useState<JugadorPublico[]>([]);
  const [partidos, setPartidos] = useState<TVPartido[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const partidosRef = useRef<TVPartido[]>([]);
  const [tab, setTab] = useState<"canchas" | "zonas" | "llaves">("canchas");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [clock, setClock] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const { data: tournament, error: tournamentError } = await (supabase as any)
        .from("torneos")
        .select("id, nombre, tipo, estado, categoria_libre, numero_fecha, fecha_inicio, sede, club_id, canchas_count")
        .eq("id", id)
        .maybeSingle();
      if (tournamentError || !tournament) throw tournamentError ?? new Error("No encontramos ese torneo.");
      setTorneo(tournament as Torneo);

      const [{ data: zoneRows, error: zonesError }, { data: registrations, error: registrationsError }, { data: bracketRows, error: bracketsError }] = await Promise.all([
        (supabase as any).from("zonas").select("id, nombre, tamanio, orden, torneo_id").eq("torneo_id", id).order("orden"),
        (supabase as any).from("inscripciones").select("id, jugador1_id, jugador2_id").eq("torneo_id", id).eq("estado", "confirmada"),
        (supabase as any).from("llaves").select("id").eq("torneo_id", id),
      ]);
      if (zonesError || registrationsError || bracketsError) throw zonesError ?? registrationsError ?? bracketsError;

      const zoneIds = (zoneRows ?? []).map((zone: any) => zone.id);
      const bracketIds = (bracketRows ?? []).map((bracket: any) => bracket.id);
      const [zoneMatchResult, bracketMatchResult] = await Promise.all([
        zoneIds.length
          ? (supabase as any).from("partidos_zona").select("*").in("zona_id", zoneIds)
          : Promise.resolve({ data: [], error: null }),
        bracketIds.length
          ? (supabase as any).from("partidos_llave").select("*").in("llave_id", bracketIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (zoneMatchResult.error || bracketMatchResult.error) throw zoneMatchResult.error ?? bracketMatchResult.error;

      const zoneMatches = zoneMatchResult.data ?? [];
      const bracketMatches = bracketMatchResult.data ?? [];
      const [zoneSetsResult, bracketSetsResult] = await Promise.all([
        zoneMatches.length
          ? (supabase as any).from("sets_partido").select("partido_id, numero_set, games_local, games_visitante").in("partido_id", zoneMatches.map((match: any) => match.id))
          : Promise.resolve({ data: [], error: null }),
        bracketMatches.length
          ? (supabase as any).from("sets_partido").select("partido_llave_id, numero_set, games_local, games_visitante").in("partido_llave_id", bracketMatches.map((match: any) => match.id))
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (zoneSetsResult.error || bracketSetsResult.error) throw zoneSetsResult.error ?? bracketSetsResult.error;

      const allSets = [...(zoneSetsResult.data ?? []), ...(bracketSetsResult.data ?? [])];
      const setsByMatch = new Map<string, TVPartido["sets"]>();
      allSets.forEach((set: any) => {
        const matchId = set.partido_id ?? set.partido_llave_id;
        if (!matchId) return;
        const current = setsByMatch.get(matchId) ?? [];
        current.push({ numero_set: set.numero_set, games_local: set.games_local, games_visitante: set.games_visitante });
        setsByMatch.set(matchId, current);
      });
      setsByMatch.forEach((sets) => sets.sort((a, b) => a.numero_set - b.numero_set));

      const normalized: TVPartido[] = [
        ...zoneMatches.map((match: any) => ({
          id: match.id,
          origen: "zona" as const,
          fase: zoneRows?.find((zone: any) => zone.id === match.zona_id)?.nombre ?? "Zona",
          numero: match.orden,
          parejaLocalId: match.pareja_local_id,
          parejaVisitanteId: match.pareja_visitante_id,
          refLocal: null,
          refVisitante: null,
          estado: match.estado,
          cancha: match.cancha,
          fechaHora: match.fecha_hora,
          ganadorId: match.ganador_id,
          sets: setsByMatch.get(match.id) ?? [],
          marcadorEnVivo: match.marcador_en_vivo ?? null,
        })),
        ...bracketMatches.map((match: any) => ({
          id: match.id,
          origen: "llave" as const,
          fase: NOMBRE_RONDA[match.ronda as RondaLlave] ?? String(match.ronda).replace(/_/g, " "),
          numero: match.numero,
          parejaLocalId: match.pareja_local_id,
          parejaVisitanteId: match.pareja_visitante_id,
          refLocal: match.ref_local,
          refVisitante: match.ref_visitante,
          estado: match.estado,
          cancha: match.cancha,
          fechaHora: match.fecha_hora,
          ganadorId: match.ganador_id,
          sets: setsByMatch.get(match.id) ?? [],
          marcadorEnVivo: match.marcador_en_vivo ?? null,
        })),
      ];

      const playerIds = [...new Set((registrations ?? []).flatMap((registration: any) => [registration.jugador1_id, registration.jugador2_id]).filter(Boolean))];
      const { data: playerRows, error: playersError } = playerIds.length
        ? await (supabase as any).from("jugadores_publicos").select("id, nombre, apellido").in("id", playerIds)
        : { data: [], error: null };
      if (playersError) throw playersError;

      setZonas((zoneRows ?? []) as Zona[]);
      setInscripciones((registrations ?? []) as Inscripcion[]);
      setJugadores((playerRows ?? []) as JugadorPublico[]);
      setPartidos(normalized);
      setLoadError(false);
      setUpdatedAt(new Date());
    } catch (error) {
      console.error("No se pudo actualizar la pantalla de torneo", error);
      if (!silent) setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => loadData(true), 10000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const activeMatchSubscriptions = useMemo(() => partidos
    .filter((match) => match.estado === "en_juego")
    .map((match) => `${match.origen}:${match.id}`)
    .sort()
    .join(","), [partidos]);

  useEffect(() => {
    if (!id || !activeMatchSubscriptions) return;
    const channel = supabase.channel(`tv_live_matches_${id}`);
    activeMatchSubscriptions.split(",").forEach((entry) => {
      const [origin, matchId] = entry.split(":");
      const table = origin === "zona" ? "partidos_zona" : "partidos_llave";
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table, filter: `id=eq.${matchId}` },
        () => loadData(true)
      );
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, activeMatchSubscriptions, loadData]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadPhotos = async () => {
      const { data, error } = await (supabase as any)
        .from("torneos")
        .select("notas")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        console.warn("No se pudieron actualizar las fotos del torneo", error);
        return;
      }
      if (cancelled) return;
      const nextPhotos: Record<string, string> = {};
      partidosRef.current.forEach((match) => {
        const photo = extractFotoFromNotas(data?.notas, match.id);
        if (photo && isSafePhotoUrl(photo)) nextPhotos[match.id] = photo;
      });
      setPhotoUrls(nextPhotos);
    };

    loadPhotos();
    // Photos change far less often than live scores (which use Realtime above).
    // Polling every two minutes avoids repeated reads of the large notas field
    // from each TV screen while still refreshing occasional photo changes.
    const timer = window.setInterval(loadPhotos, 120000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, partidos.length]);

  useEffect(() => {
    const updateClock = () => setClock(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    updateClock();
    const timer = window.setInterval(updateClock, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const playerMap = useMemo(() => new Map(jugadores.map((player) => [player.id, player])), [jugadores]);
  const registrationMap = useMemo(() => new Map(inscripciones.map((registration) => [registration.id, registration])), [inscripciones]);
  const matchLabel = useCallback((registrationId: string | null, reference: string | null) => {
    if (registrationId) {
      const registration = registrationMap.get(registrationId);
      if (!registration) return "Pareja pendiente";
      const first = playerMap.get(registration.jugador1_id ?? "");
      const second = playerMap.get(registration.jugador2_id ?? "");
      const format = (player?: JugadorPublico) => player ? `${player.apellido}, ${player.nombre}` : "Jugador pendiente";
      return `${format(first)} / ${format(second)}`;
    }
    if (!reference) return "Por definir";
    const parsed = parseRef(reference);
    if (parsed.tipo === "clasificado") return `${parsed.posicion}° de Zona ${parsed.zona}`;
    if (parsed.tipo === "ganador") return `Ganador del partido ${parsed.numeroPartido}`;
    return reference.replace(/_/g, " ");
  }, [playerMap, registrationMap]);

  const courtCount = Math.max(1, Math.min(torneo?.canchas_count || 4, 12));
  const courts = Array.from({ length: courtCount }, (_, index) => String(index + 1));
  const assignedMatches = useMemo(() => partidos.filter((match) => match.cancha && ["en_juego", "programado", "pendiente"].includes(match.estado)), [partidos]);
  const liveMatches = useMemo(() => assignedMatches.filter((match) => match.estado === "en_juego"), [assignedMatches]);
  partidosRef.current = partidos;
  const courtMatches = useCallback((court: string) => assignedMatches
    .filter((match) => parseCancha(match.cancha) === court)
    .sort((a, b) => {
      if (a.estado === "en_juego" && b.estado !== "en_juego") return -1;
      if (b.estado === "en_juego" && a.estado !== "en_juego") return 1;
      return (a.fechaHora ? new Date(a.fechaHora).getTime() : Number.MAX_SAFE_INTEGER)
        - (b.fechaHora ? new Date(b.fechaHora).getTime() : Number.MAX_SAFE_INTEGER);
    }), [assignedMatches]);
  const unassignedMatches = useMemo(() => partidos
    .filter((match) => !match.cancha && match.estado !== "finalizado" && match.parejaLocalId && match.parejaVisitanteId)
    .sort((a, b) => (a.fechaHora ? new Date(a.fechaHora).getTime() : Number.MAX_SAFE_INTEGER)
      - (b.fechaHora ? new Date(b.fechaHora).getTime() : Number.MAX_SAFE_INTEGER)), [partidos]);
  const rounds = useMemo(() => {
    const map = new Map<string, TVPartido[]>();
    partidos.filter((match) => match.origen === "llave").forEach((match) => {
      const items = map.get(match.fase) ?? [];
      items.push(match);
      map.set(match.fase, items);
    });
    return Array.from(map.entries()).sort(([first], [second]) => {
      const a = Object.entries(NOMBRE_RONDA).find(([, label]) => label === first)?.[0] as RondaLlave | undefined;
      const b = Object.entries(NOMBRE_RONDA).find(([, label]) => label === second)?.[0] as RondaLlave | undefined;
      return (a ? ORDEN_RONDA[a] : 99) - (b ? ORDEN_RONDA[b] : 99);
    });
  }, [partidos]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Enlace de TV copiado");
    } catch {
      toast.error("No se pudo copiar el enlace desde este dispositivo.");
    }
  };

  const matchScore = (match: TVPartido) => match.sets.length
    ? match.sets.map((set) => `${set.games_local}–${set.games_visitante}`).join("   ")
    : "";

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#080b12] text-white"><RefreshCw className="mr-3 h-5 w-5 animate-spin text-primary" />Preparando la pantalla del torneo…</div>;
  }
  if (!torneo || loadError) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#080b12] px-6 text-center text-white"><Trophy className="h-10 w-10 text-primary" /><h1 className="text-2xl font-bold">No pudimos cargar este torneo</h1><p className="max-w-lg text-sm text-white/60">Comprobá que el enlace sea correcto y que el torneo tenga su fixture publicado. Volvé a intentar en unos segundos.</p><Button onClick={() => loadData()} variant="outline">Reintentar</Button></div>;
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-white selection:bg-primary/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,245,212,0.11),transparent_35%),radial-gradient(ellipse_at_bottom_right,rgba(131,56,236,0.13),transparent_38%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? <img src={logoUrl} alt={nombreClub} className="h-11 w-11 rounded-xl bg-white/5 object-contain p-1" /> : <PadelIdLogo size={42} />}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Padel ID <span className="text-white/35">·</span> {nombreClub}</p>
              <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{torneo.nombre}</h1>
              <p className="mt-0.5 text-xs text-white/50">{torneo.categoria_libre || "Torneo por zonas y llaves"}{torneo.sede ? ` · ${torneo.sede}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="font-mono text-xl font-bold tabular-nums">{clock}</p>
              <p className="text-[10px] text-white/40">{updatedAt ? `Actualizado ${updatedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Conectando"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={copyLink} className="border-white/15 bg-white/5 text-white hover:bg-white/10"><Copy className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Copiar enlace</span></Button>
            <Button size="sm" variant="outline" onClick={toggleFullscreen} className="border-primary/40 bg-primary/10 text-white hover:bg-primary/20" title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5 ${liveMatches.length ? "" : "opacity-40"}`}><span className={`absolute inline-flex h-full w-full rounded-full ${liveMatches.length ? "animate-ping bg-rose-400" : "bg-white/30"}`} /><span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${liveMatches.length ? "bg-rose-400" : "bg-white/30"}`} /></span>
            <span className="text-sm font-bold">{liveMatches.length ? `${liveMatches.length} ${liveMatches.length === 1 ? "partido en juego" : "partidos en juego"}` : "Seguimiento del torneo"}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/60"><RefreshCw className="h-3 w-3 text-primary" />Se actualiza automáticamente cada 10 segundos</div>
        </div>

        <nav className="mt-5 flex gap-2 border-b border-white/10 pb-3" aria-label="Secciones del torneo">
          {([
            ["canchas", "Partidos por cancha"],
            ["zonas", `Zonas${zonas.length ? ` · ${zonas.length}` : ""}`],
            ["llaves", `Cuadro${rounds.length ? ` · ${rounds.length} rondas` : ""}`],
          ] as const).map(([value, label]) => (
            <button key={value} onClick={() => setTab(value)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${tab === value ? "bg-primary text-slate-950 shadow-[0_0_18px_rgba(0,245,212,0.22)]" : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"}`}>{label}</button>
          ))}
        </nav>

        <main className="flex-1 py-5">
          {tab === "canchas" && (
            <>
              {liveMatches.length > 0 && (
                <section className="mb-6">
                  <div className="mb-3 flex items-center gap-2 text-rose-300"><Radio className="h-4 w-4" /><h2 className="text-xs font-black uppercase tracking-[0.18em]">En juego ahora</h2></div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {liveMatches.map((match) => <MatchSpotlight key={match.id} match={match} local={matchLabel(match.parejaLocalId, match.refLocal)} visitor={matchLabel(match.parejaVisitanteId, match.refVisitante)} score={matchScore(match)} photoUrl={photoUrls[match.id]} />)}
                  </div>
                </section>
              )}
              <section>
                <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/65">Canchas del complejo</h2><Badge variant="outline" className="border-white/10 text-white/50">{courtCount} canchas</Badge></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {courts.map((court) => {
                    const matches = courtMatches(court);
                    const current = matches.find((match) => match.estado === "en_juego");
                    const next = matches.filter((match) => match !== current).slice(0, 2);
                    return (
                      <section key={court} className={`min-h-[230px] rounded-2xl border p-4 ${current ? "border-rose-400/35 bg-gradient-to-b from-rose-500/[0.10] to-white/[0.025]" : "border-white/10 bg-white/[0.035]"}`}>
                        <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-widest">Cancha {court}</h3>{current ? <Badge className="bg-rose-400/15 text-rose-200 hover:bg-rose-400/15"><Radio className="mr-1 h-3 w-3" />EN JUEGO</Badge> : <span className="text-[10px] text-white/35">PADEL ID LIVE</span>}</div>
                        {current ? <MatchCompact match={current} local={matchLabel(current.parejaLocalId, current.refLocal)} visitor={matchLabel(current.parejaVisitanteId, current.refVisitante)} score={matchScore(current)} photoUrl={photoUrls[current.id]} /> : null}
                        {next.length > 0 ? <div className={`${current ? "mt-4 border-t border-white/10 pt-3" : ""}`}><p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary"><CalendarClock className="h-3 w-3" />{current ? "A continuación" : "Próximo partido"}</p><div className="space-y-3">{next.map((match) => <MatchNext key={match.id} match={match} local={matchLabel(match.parejaLocalId, match.refLocal)} visitor={matchLabel(match.parejaVisitanteId, match.refVisitante)} score={matchScore(match)} photoUrl={photoUrls[match.id]} />)}</div></div> : !current ? <div className="flex h-32 flex-col items-center justify-center text-center text-white/35"><Clock3 className="mb-2 h-5 w-5" /><p className="text-xs">Sin partido asignado</p></div> : null}
                      </section>
                    );
                  })}
                </div>
              </section>
              {unassignedMatches.length > 0 && <section className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-200/[0.04] p-4"><h2 className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-amber-100">Pendientes de cancha</h2><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{unassignedMatches.slice(0, 6).map((match) => <MatchNext key={match.id} match={match} local={matchLabel(match.parejaLocalId, match.refLocal)} visitor={matchLabel(match.parejaVisitanteId, match.refVisitante)} score={matchScore(match)} photoUrl={photoUrls[match.id]} />)}</div></section>}
            </>
          )}

          {tab === "zonas" && (zonas.length ? <div className="grid gap-4 lg:grid-cols-2">{zonas.map((zone) => <ZonaCard key={zone.id} zona={zone} torneoId={id} parejasDisponibles={[]} parejaLabel={(registrationId) => matchLabel(registrationId, null)} onChanged={() => {}} onDeleted={() => {}} readOnly torneoNombre={torneo.nombre} matchPhotoUrl={(matchId) => photoUrls[matchId]} />)}</div> : <EmptyState label="Las zonas todavía no están publicadas." />)}

              {tab === "llaves" && (rounds.length ? <div className="flex gap-4 overflow-x-auto pb-5">{rounds.map(([round, roundMatches]) => <section key={round} className="w-[300px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h2 className="mb-4 border-b border-white/10 pb-3 text-center text-xs font-black uppercase tracking-[0.16em] text-primary">{round}</h2><div className="space-y-3">{[...roundMatches].sort((a, b) => a.numero - b.numero).map((match) => <div key={match.id} className="space-y-2">{photoUrls[match.id] && <img src={photoUrls[match.id]} alt={`Foto del partido ${match.numero}`} loading="lazy" className="max-h-40 w-full rounded-lg border border-white/10 bg-black/40 object-contain" />}<PartidoCard partidoId={match.id} torneoId={id ?? ""} orden={match.numero} labelPartido={`Partido ${match.numero}`} tabla="partidos_llave" parejaLocal={match.parejaLocalId ? { inscripcion_id: match.parejaLocalId, posicion_siembra: 0, label: matchLabel(match.parejaLocalId, null) } : match.refLocal ? { inscripcion_id: "", posicion_siembra: 0, label: matchLabel(null, match.refLocal) } : null} parejaVisitante={match.parejaVisitanteId ? { inscripcion_id: match.parejaVisitanteId, posicion_siembra: 0, label: matchLabel(match.parejaVisitanteId, null) } : match.refVisitante ? { inscripcion_id: "", posicion_siembra: 0, label: matchLabel(null, match.refVisitante) } : null} estado={match.estado as any} ganadorId={match.ganadorId} setsExistentes={match.sets as any[]} onUpdated={() => {}} fechaHora={match.fechaHora} cancha={match.cancha} showProgramacion readOnly /></div>)}</div></section>)}</div> : <EmptyState label="El cuadro todavía no está publicado." />)}
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[10px] text-white/35"><span>Padel ID · Torneos y rankings</span><span>Esta pantalla es pública y de solo lectura</span></footer>
      </div>
    </div>
  );
}

function MatchSpotlight({ match, local, visitor, score, photoUrl }: { match: TVPartido; local: string; visitor: string; score: string; photoUrl?: string }) {
  return <div className="overflow-hidden rounded-xl border border-rose-400/25 bg-[#141018] shadow-[0_0_24px_rgba(251,113,133,0.06)]"><div className="p-4"><div className="mb-3 flex items-center justify-between"><Badge className="bg-rose-400/15 text-rose-200 hover:bg-rose-400/15"><Radio className="mr-1 h-3 w-3" />EN JUEGO</Badge><span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{match.cancha || match.fase}</span></div><div className="space-y-2"><p className="truncate text-sm font-bold">{local}</p><p className="truncate text-sm font-bold">{visitor}</p></div><div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-xs text-primary"><span>{match.fase}</span><span className="font-mono font-bold">{score || "Marcador en carga"}</span></div>{match.marcadorEnVivo && <div className="mt-3"><LiveScoreSummary state={match.marcadorEnVivo} /></div>}</div>{photoUrl && <img src={photoUrl} alt={`Foto del partido ${match.numero}`} loading="lazy" className="max-h-64 w-full border-t border-white/10 bg-black/40 object-contain" />}</div>;
}

function MatchCompact({ match, local, visitor, score, photoUrl }: { match: TVPartido; local: string; visitor: string; score: string; photoUrl?: string }) {
  return <div className="space-y-2"><p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">{match.fase}</p><div className="flex items-start gap-3">{photoUrl && <img src={photoUrl} alt={`Foto del partido ${match.numero}`} loading="lazy" className="h-14 w-20 shrink-0 rounded-lg border border-white/10 bg-black/40 object-contain" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{local}</p><p className="truncate text-sm font-bold">{visitor}</p><span className="font-mono text-xs font-black text-primary">{score}</span></div></div>{match.marcadorEnVivo && <LiveScoreSummary state={match.marcadorEnVivo} compact />}</div>;
}

function MatchNext({ match, local, visitor, score, photoUrl }: { match: TVPartido; local: string; visitor: string; score: string; photoUrl?: string }) {
  return <div className="flex gap-2 rounded-lg border border-white/[0.07] bg-black/20 p-2.5">{photoUrl && <img src={photoUrl} alt={`Foto del partido ${match.numero}`} loading="lazy" className="h-14 w-16 shrink-0 rounded-md bg-black/40 object-contain" />}<div className="min-w-0 flex-1"><div className="mb-1 flex items-center justify-between gap-2"><span className="truncate text-[10px] font-bold uppercase tracking-wider text-white/50">{match.fase}</span><span className="shrink-0 text-[10px] text-white/45">{fmtFecha(match.fechaHora)} {fmtHora(match.fechaHora)}</span></div><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{local}</p><p className="truncate text-xs font-semibold text-white/70">{visitor}</p></div><span className="shrink-0 text-[9px] font-bold uppercase text-primary">{statusLabel(match.estado)}</span></div>{score && <p className="mt-1 text-right font-mono text-[10px] text-white/50">{score}</p>}{match.marcadorEnVivo && <div className="mt-2"><LiveScoreSummary state={match.marcadorEnVivo} compact /></div>}</div></div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-white/45"><Check className="mb-3 h-8 w-8 text-primary/70" /><p className="text-sm">{label}</p></div>;
}

function statusLabel(status: string) {
  return status === "programado" ? "Próximo" : status === "en_juego" ? "En juego" : "Pendiente";
}

function isSafePhotoUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value);
}
