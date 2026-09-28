import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, ArrowLeft, CheckCircle2, Loader2, MonitorPlay, Radio, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Scoreboard } from "@/components/marcador/Scoreboard";
import { ControlPanel } from "@/components/marcador/ControlPanel";
import { SetHistory } from "@/components/marcador/SetHistory";
import { ConfigModal } from "@/components/marcador/ConfigModal";
import { VictoryModal } from "@/components/marcador/VictoryModal";
import {
  initialState,
  type PadelState,
  sumarPunto,
  deshacerPunto,
  reiniciarPartido,
  actualizarConfiguracion,
  forzarSetsPrevios,
  type SetScore,
} from "@/logic/padelLogic";

type OrigenPartido = "zona" | "llave" | "individual";
type TablaPartido = "partidos_zona" | "partidos_llave" | "partidos_individuales";
type PartidoVinculado = {
  id: string;
  origen: OrigenPartido;
  tabla: TablaPartido;
  torneoId: string;
  torneoNombre: string;
  cancha: string | null;
  estado: string;
  parejaLocalId: string | null;
  parejaVisitanteId: string | null;
};

const LOCAL_STORAGE_KEY = "padel_scoreboard_state_v1";
const TABLA_POR_ORIGEN: Record<OrigenPartido, TablaPartido> = {
  zona: "partidos_zona",
  llave: "partidos_llave",
  individual: "partidos_individuales",
};

function leerEstadoGuardado(): PadelState {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return JSON.parse(saved) as PadelState;
  } catch (error) {
    console.error("No se pudo recuperar el marcador guardado", error);
  }
  return { ...initialState };
}

function normalizarEstado(value: unknown, nombres: PadelState["nombres"]): PadelState {
  if (!value || typeof value !== "object") {
    return { ...initialState, nombres, history: [] };
  }

  const saved = value as Partial<PadelState>;
  return {
    ...initialState,
    ...saved,
    nombres: { ...nombres, ...saved.nombres },
    config: { ...initialState.config, ...saved.config },
    points: saved.points ?? initialState.points,
    games: saved.games ?? initialState.games,
    sets: Array.isArray(saved.sets) ? saved.sets : [],
    currentSet: saved.currentSet ?? 1,
    server: saved.server === "p2" ? "p2" : "p1",
    isTieBreak: saved.isTieBreak ?? false,
    isSuperTieBreak: saved.isSuperTieBreak ?? false,
    winner: saved.winner === "p1" || saved.winner === "p2" ? saved.winner : null,
    history: Array.isArray(saved.history) ? saved.history : [],
  };
}

function etiquetaJugador(player: any, suplente: string | null | undefined) {
  if (player) return `${player.apellido}, ${player.nombre}`;
  return suplente?.trim() || "Jugador pendiente";
}

function etiquetaPareja(first: any, second: any, substituteFirst?: string | null, substituteSecond?: string | null) {
  return `${etiquetaJugador(first, substituteFirst)} / ${etiquetaJugador(second, substituteSecond)}`;
}

const Marcador: React.FC = () => {
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get("partidoId");
  const originValue = searchParams.get("tipo");
  const origin = originValue === "zona" || originValue === "llave" || originValue === "individual" ? originValue : null;
  const localStorageKey = matchId ? `${LOCAL_STORAGE_KEY}:${matchId}` : LOCAL_STORAGE_KEY;
  const [state, setState] = useState<PadelState>(leerEstadoGuardado);
  const [linkedMatch, setLinkedMatch] = useState<PartidoVinculado | null>(null);
  const [linkLoading, setLinkLoading] = useState(Boolean(matchId));
  const [linkError, setLinkError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"local" | "loading" | "saving" | "saved" | "error">(matchId ? "loading" : "local");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isVictoryOpen, setIsVictoryOpen] = useState(false);
  const [retrySave, setRetrySave] = useState(0);
  const readyMatchId = useRef<string | null>(null);
  const finalizingMatchId = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(localStorageKey, JSON.stringify(state));
    if (state.winner) setIsVictoryOpen(true);
  }, [state, localStorageKey]);

  useEffect(() => {
    if (!matchId) {
      setLinkedMatch(null);
      setLinkLoading(false);
      setLinkError(null);
      readyMatchId.current = null;
      setSyncStatus("local");
      return;
    }
    if (!origin) {
      setLinkLoading(false);
      setLinkError("El enlace al partido no es válido. Volvé a Canchas en vivo y abrilo desde allí.");
      setSyncStatus("error");
      return;
    }

    let cancelled = false;
    readyMatchId.current = null;
    setLinkedMatch(null);
    setLinkLoading(true);
    setLinkError(null);
    setSyncStatus("loading");

    const loadMatch = async () => {
      const table = TABLA_POR_ORIGEN[origin];
      const { data: row, error: matchError } = await (supabase as any)
        .from(table)
        .select("*")
        .eq("id", matchId)
        .single();
      if (matchError) throw matchError;
      if (row.estado !== "en_juego" && row.estado !== "finalizado") {
        throw new Error("Este partido todavía no está en juego. Inícialo desde Canchas en vivo.");
      }
      if (origin !== "individual" && (!row.pareja_local_id || !row.pareja_visitante_id)) {
        throw new Error("Este partido todavía no tiene las dos parejas definidas.");
      }

      let tournamentId: string;
      if (origin === "individual") {
        tournamentId = row.torneo_id;
      } else if (origin === "zona") {
        const { data, error } = await supabase.from("zonas").select("torneo_id").eq("id", row.zona_id).single();
        if (error) throw error;
        tournamentId = data.torneo_id;
      } else {
        const { data, error } = await supabase.from("llaves").select("torneo_id").eq("id", row.llave_id).single();
        if (error) throw error;
        tournamentId = data.torneo_id;
      }

      const { data: tournament, error: tournamentError } = await supabase
        .from("torneos")
        .select("id, nombre")
        .eq("id", tournamentId)
        .single();
      if (tournamentError) throw tournamentError;

      let names: PadelState["nombres"];
      let pairIds: { local: string | null; visitor: string | null };
      if (origin === "individual") {
        const playerIds = [row.jugador1_id, row.jugador2_id, row.jugador3_id, row.jugador4_id].filter(Boolean);
        const { data: players, error: playersError } = playerIds.length
          ? await (supabase as any).from("jugadores_publicos").select("id, nombre, apellido").in("id", playerIds)
          : { data: [], error: null };
        if (playersError) throw playersError;
        const playersById = new Map((players ?? []).map((player: any) => [player.id, player]));
        names = {
          p1: etiquetaPareja(playersById.get(row.jugador1_id), playersById.get(row.jugador2_id), row.suplente1_nombre, row.suplente2_nombre),
          p2: etiquetaPareja(playersById.get(row.jugador3_id), playersById.get(row.jugador4_id), row.suplente3_nombre, row.suplente4_nombre),
        };
        pairIds = { local: `${row.id}-p1`, visitor: `${row.id}-p2` };
      } else {
        const localId = row.pareja_local_id as string | null;
        const visitorId = row.pareja_visitante_id as string | null;
        const ids = [localId, visitorId].filter(Boolean) as string[];
        const { data: registrations, error: registrationsError } = ids.length
          ? await (supabase as any).from("inscripciones").select("id, jugador1_id, jugador2_id").in("id", ids)
          : { data: [], error: null };
        if (registrationsError) throw registrationsError;
        const playerIds = [...new Set((registrations ?? []).flatMap((registration: any) => [registration.jugador1_id, registration.jugador2_id]).filter(Boolean))];
        const { data: players, error: playersError } = playerIds.length
          ? await (supabase as any).from("jugadores_publicos").select("id, nombre, apellido").in("id", playerIds)
          : { data: [], error: null };
        if (playersError) throw playersError;
        const registrationsById = new Map((registrations ?? []).map((registration: any) => [registration.id, registration]));
        const playersById = new Map((players ?? []).map((player: any) => [player.id, player]));
        const registrationLabel = (registrationId: string | null) => {
          const registration: any = registrationId ? registrationsById.get(registrationId) : null;
          if (!registration) return "Pareja pendiente";
          return etiquetaPareja(playersById.get(registration.jugador1_id), playersById.get(registration.jugador2_id));
        };
        names = { p1: registrationLabel(localId), p2: registrationLabel(visitorId) };
        pairIds = { local: localId, visitor: visitorId };
      }

      if (cancelled) return;
      const loadedState = normalizarEstado(row.marcador_en_vivo, names);
      setState(loadedState);
      setIsVictoryOpen(Boolean(loadedState.winner));
      setLinkedMatch({
        id: row.id,
        origen: origin,
        tabla: table,
        torneoId: tournament.id,
        torneoNombre: tournament.nombre,
        cancha: row.cancha ?? null,
        estado: row.estado,
        parejaLocalId: pairIds.local,
        parejaVisitanteId: pairIds.visitor,
      });
      readyMatchId.current = row.id;
      if (row.estado === "finalizado") finalizingMatchId.current = row.id;
      setSyncStatus(row.estado === "finalizado" ? "saved" : "saved");
      setLinkLoading(false);
    };

    loadMatch().catch((error) => {
      if (cancelled) return;
      console.error("No se pudo vincular el marcador al partido", error);
      setLinkError(error?.message || "No se pudo cargar el partido.");
      setSyncStatus("error");
      setLinkLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [matchId, origin]);

  useEffect(() => {
    if (!linkedMatch || linkLoading || readyMatchId.current !== linkedMatch.id || linkedMatch.estado === "finalizado") return;
    const timeout = window.setTimeout(async () => {
      setSyncStatus("saving");
      const snapshot = { ...state, history: [] };
      const { error } = await (supabase as any)
        .from(linkedMatch.tabla)
        .update({ marcador_en_vivo: snapshot })
        .eq("id", linkedMatch.id);

      if (error) {
        console.error("No se pudo sincronizar el marcador", error);
        setSyncStatus("error");
        const missingColumn = error.code === "42703" || error.code === "PGRST204";
        toast.error(missingColumn
          ? "Falta aplicar en Supabase la migración para sincronizar el marcador."
          : `No se pudo sincronizar con la TV: ${error.message}`);
        return;
      }

      if (!state.winner) {
        setSyncStatus("saved");
        return;
      }

      if (finalizingMatchId.current === linkedMatch.id) {
        setSyncStatus("saved");
        return;
      }
      finalizingMatchId.current = linkedMatch.id;

      try {
        const completedSets = state.sets.filter((set) => set.p1 !== set.p2);
        if (completedSets.length === 0) throw new Error("No hay sets completos para guardar.");

        if (linkedMatch.origen === "individual") {
          const { error: deleteError } = await supabase.from("sets_partido_individual").delete().eq("partido_individual_id", linkedMatch.id);
          if (deleteError) throw deleteError;
          const { error: insertError } = await supabase.from("sets_partido_individual").insert(
            completedSets.map((set, index) => ({
              partido_individual_id: linkedMatch.id,
              numero_set: index + 1,
              games_pareja1: set.p1,
              games_pareja2: set.p2,
            }))
          );
          if (insertError) throw insertError;
          const wins1 = completedSets.filter((set) => set.p1 > set.p2).length;
          const wins2 = completedSets.filter((set) => set.p2 > set.p1).length;
          const { error: updateError } = await supabase.from("partidos_individuales").update({
            estado: "finalizado",
            sets_pareja1: wins1,
            sets_pareja2: wins2,
            marcador_en_vivo: snapshot,
          }).eq("id", linkedMatch.id);
          if (updateError) throw updateError;
        } else {
          const winnerId = state.winner === "p1" ? linkedMatch.parejaLocalId : linkedMatch.parejaVisitanteId;
          if (!winnerId) throw new Error("El partido todavía no tiene definida la pareja ganadora.");
          const setColumn = linkedMatch.origen === "zona" ? "partido_id" : "partido_llave_id";
          const { error: deleteError } = await (supabase as any).from("sets_partido").delete().eq(setColumn, linkedMatch.id);
          if (deleteError) throw deleteError;
          const rows = completedSets.map((set, index) => ({
            numero_set: index + 1,
            games_local: set.p1,
            games_visitante: set.p2,
            partido_id: linkedMatch.origen === "zona" ? linkedMatch.id : null,
            partido_llave_id: linkedMatch.origen === "llave" ? linkedMatch.id : null,
          }));
          const { error: insertError } = await supabase.from("sets_partido").insert(rows as never);
          if (insertError) throw insertError;
          const { error: updateError } = await (supabase as any).from(linkedMatch.tabla).update({
            estado: "finalizado",
            ganador_id: winnerId,
            marcador_en_vivo: snapshot,
          }).eq("id", linkedMatch.id);
          if (updateError) throw updateError;
        }

        setLinkedMatch((current) => current ? { ...current, estado: "finalizado" } : current);
        setSyncStatus("saved");
        toast.success("Resultado definitivo guardado y enviado a la TV.");
      } catch (error: any) {
        finalizingMatchId.current = null;
        setSyncStatus("error");
        console.error("No se pudo finalizar el partido desde el marcador", error);
        toast.error(`El punto final quedó guardado, pero no se pudo cerrar el resultado: ${error?.message || "Error desconocido"}`);
      }
    }, state.winner ? 100 : 350);

    return () => window.clearTimeout(timeout);
  }, [state, linkedMatch, linkLoading, retrySave]);

  const handleSumarPunto = (player: "p1" | "p2") => {
    if (linkedMatch?.estado === "finalizado" || (linkedMatch && state.winner)) return;
    setState((previous) => sumarPunto(previous, player));
  };
  const handleDeshacer = () => {
    if (linkedMatch?.estado === "finalizado" || (linkedMatch && state.winner)) return;
    setState((previous) => deshacerPunto(previous));
  };

  const handleElegirSacadorSuperTieBreak = (server: "p1" | "p2") => {
    if (!state.isSuperTieBreak || state.points.p1 + state.points.p2 > 0 || linkedMatch?.estado === "finalizado") return;
    setState((previous) => ({ ...previous, server }));
  };

  const handleReiniciar = useCallback(() => {
    if (linkedMatch && state.winner && linkedMatch.estado !== "finalizado") {
      toast.info("Estamos guardando el resultado definitivo. Esperá la confirmación antes de salir.");
      return;
    }
    if (linkedMatch?.estado === "finalizado") {
      toast.info("Este partido ya quedó finalizado. El resultado se conserva en el torneo.");
      setIsVictoryOpen(false);
      return;
    }
    setState((previous) => reiniciarPartido(previous));
    setIsVictoryOpen(false);
  }, [linkedMatch, state.winner]);

  const handleSaveConfig = (config: Partial<PadelState["config"]>, nombres: PadelState["nombres"], manualSets: SetScore[]) => {
    if (linkedMatch?.estado === "finalizado") {
      toast.info("El resultado de este partido ya está cerrado.");
      return;
    }
    setState((previous) => {
      let nextState = actualizarConfiguracion(previous, config, nombres);
      nextState = forzarSetsPrevios(nextState, manualSets);
      return nextState;
    });
  };

  const abrirConfiguracion = () => {
    if (linkedMatch?.estado === "finalizado") {
      toast.info("El resultado de este partido ya está cerrado.");
      return;
    }
    setIsConfigOpen(true);
  };

  const syncLabel = useMemo(() => {
    if (syncStatus === "loading") return "Conectando con el partido…";
    if (syncStatus === "saving") return "Enviando marcador a la TV…";
    if (syncStatus === "saved") return linkedMatch?.estado === "finalizado" ? "Resultado guardado" : "Sincronizado con la TV";
    if (syncStatus === "error") return "Sin conexión con el partido";
    return "Marcador local";
  }, [syncStatus, linkedMatch?.estado]);

  if (linkLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center gap-3 text-white"><Loader2 className="h-5 w-5 animate-spin text-padel-accent" />Cargando partido…</div>;
  }

  if (linkError) {
    return (
      <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-rose-400/25 bg-slate-900 p-6 text-center text-white">
        <p className="mb-4 text-sm text-rose-200">{linkError}</p>
        <Button asChild variant="outline"><Link to="/canchas-en-vivo"><ArrowLeft className="mr-2 h-4 w-4" />Volver a Canchas en vivo</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-3 sm:p-6 flex flex-col">
      <header className="mx-auto mb-4 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 text-white sm:mb-8">
        <div className="flex min-w-0 items-center gap-3">
          <MonitorPlay className="h-7 w-7 shrink-0 text-padel-accent sm:h-8 sm:w-8" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black uppercase tracking-widest text-padel-accent sm:text-2xl">Marcador en Vivo</h1>
            {linkedMatch && <p className="truncate text-xs text-slate-300">{linkedMatch.torneoNombre} · {linkedMatch.cancha || "Partido"} · {state.nombres.p1} vs {state.nombres.p2}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {linkedMatch ? (
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${syncStatus === "error" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-padel-accent/25 bg-padel-accent/10 text-padel-accent"}`}>
              {syncStatus === "saved" ? <CheckCircle2 className="h-3 w-3" /> : <Radio className="h-3 w-3" />}{syncLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-400"><Activity className="h-3 w-3" />Solo en este dispositivo</span>
          )}
        </div>
      </header>

      {linkedMatch?.estado === "finalizado" && (
        <div className="mx-auto mb-3 flex w-full max-w-4xl items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          <Trophy className="h-4 w-4" />Este partido ya está finalizado y su resultado quedó guardado.
        </div>
      )}

      <main className="flex-1 flex flex-col">
        <Scoreboard state={state} />
        <SetHistory state={state} />
        {state.isSuperTieBreak && state.points.p1 + state.points.p2 === 0 && !state.winner && (
          <section className="mx-auto mt-4 w-full max-w-4xl rounded-xl border border-padel-accent/25 bg-padel-accent/[0.06] p-3 text-white sm:mt-5 sm:p-4" aria-label="Elegir quién comienza sacando el super tie-break">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-padel-accent sm:text-sm">¿Qué pareja comienza sacando el super tie-break?</p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {(["p1", "p2"] as const).map((player) => (
                <Button
                  key={player}
                  type="button"
                  variant={state.server === player ? "default" : "outline"}
                  aria-pressed={state.server === player}
                  onClick={() => handleElegirSacadorSuperTieBreak(player)}
                  disabled={linkedMatch?.estado === "finalizado"}
                  className={`h-auto min-h-12 whitespace-normal px-2 py-2 text-xs font-bold sm:text-sm ${state.server === player ? "bg-padel-accent text-slate-950 hover:bg-padel-accent/90" : "border-white/15 bg-slate-900/70 text-white hover:bg-white/10"}`}
                >
                  <span className="line-clamp-2">{state.nombres[player]}</span>
                </Button>
              ))}
            </div>
          </section>
        )}
        <ControlPanel
          state={state}
          disabled={linkedMatch?.estado === "finalizado" || Boolean(linkedMatch && state.winner)}
          onSumarPunto={handleSumarPunto}
          onDeshacer={handleDeshacer}
          onReiniciar={handleReiniciar}
          onConfigurar={abrirConfiguracion}
        />
        {syncStatus === "error" && linkedMatch && linkedMatch.estado !== "finalizado" && (
          <div className="mx-auto mt-3 flex max-w-4xl items-center justify-between gap-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-100">
            <span>{syncLabel}. Los cambios locales se conservan.</span>
            <Button size="sm" variant="outline" onClick={() => setRetrySave((count) => count + 1)}><Save className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>
          </div>
        )}
      </main>

      <ConfigModal open={isConfigOpen} onOpenChange={setIsConfigOpen} state={state} onSave={handleSaveConfig} />
      <VictoryModal
        open={isVictoryOpen}
        winnerName={state.winner ? state.nombres[state.winner] : null}
        onReiniciar={handleReiniciar}
        onClose={() => setIsVictoryOpen(false)}
        newMatchDisabled={Boolean(linkedMatch)}
      />
    </div>
  );
};

export default Marcador;
