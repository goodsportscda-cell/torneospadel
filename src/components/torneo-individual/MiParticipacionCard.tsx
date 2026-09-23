import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Flame,
  ArrowRight,
  ShieldCheck,
  Swords,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Award,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];
type PartidoInd = Database["public"]["Tables"]["partidos_individuales"]["Row"] & {
  jugador1?: Jugador | null;
  jugador2?: Jugador | null;
  jugador3?: Jugador | null;
  jugador4?: Jugador | null;
  sets?: any[];
};

export interface MiParticipacionCardProps {
  torneo: Torneo;
  jugador: Jugador;
  standing?: any;
  rank?: number;
  partidoActual?: PartidoInd | null;
  fechaActualNum: number;
  esPuntosPorSet?: boolean;
  onGoToFixture?: () => void;
  onGoToRanking?: () => void;
}

export function MiParticipacionCard({
  torneo,
  jugador,
  standing,
  rank = 0,
  partidoActual,
  fechaActualNum,
  esPuntosPorSet = false,
  onGoToFixture,
  onGoToRanking,
}: MiParticipacionCardProps) {
  const countCanchas = torneo.canchas_count ?? 3;

  // Determinar zona/cancha según ranking
  const zonaInfo = useMemo(() => {
    if (!rank || rank <= 0) return { nombre: "En Clasificación", badge: "bg-blue-950/60 text-blue-300 border-blue-500/30" };
    if (rank <= 4) {
      return { nombre: "Zona Élite (Cancha 1)", badge: "bg-[#9d4edd]/20 text-[#c77dff] border-[#9d4edd]/50" };
    }
    if (rank <= 8 && countCanchas >= 2) {
      return { nombre: "Zona Desafío (Cancha 2)", badge: "bg-[#ff0a54]/20 text-[#ff758f] border-[#ff0a54]/50" };
    }
    if (rank <= 12 && countCanchas >= 3) {
      return { nombre: "Zona Base (Cancha 3)", badge: "bg-blue-950/60 text-blue-300 border-blue-500/40" };
    }
    return { nombre: "Zona Promoción (Cancha 4)", badge: "bg-emerald-950/60 text-emerald-300 border-emerald-500/40" };
  }, [rank, countCanchas]);

  // Resolver compañero y rivales del partido actual
  const matchDetails = useMemo(() => {
    if (!partidoActual) return null;

    const jId = jugador.id;
    const isJ1 = partidoActual.jugador1_id === jId;
    const isJ2 = partidoActual.jugador2_id === jId;
    const isJ3 = partidoActual.jugador3_id === jId;
    const isJ4 = partidoActual.jugador4_id === jId;

    const isTeam1 = isJ1 || isJ2;
    const isTeam2 = isJ3 || isJ4;

    if (!isTeam1 && !isTeam2) return null;

    // Compañero
    let partnerName = "Por definir";
    if (isJ1) {
      partnerName = partidoActual.suplente2_nombre || (partidoActual.jugador2 ? `${partidoActual.jugador2.apellido}, ${partidoActual.jugador2.nombre}` : "Por definir");
    } else if (isJ2) {
      partnerName = partidoActual.suplente1_nombre || (partidoActual.jugador1 ? `${partidoActual.jugador1.apellido}, ${partidoActual.jugador1.nombre}` : "Por definir");
    } else if (isJ3) {
      partnerName = partidoActual.suplente4_nombre || (partidoActual.jugador4 ? `${partidoActual.jugador4.apellido}, ${partidoActual.jugador4.nombre}` : "Por definir");
    } else if (isJ4) {
      partnerName = partidoActual.suplente3_nombre || (partidoActual.jugador3 ? `${partidoActual.jugador3.apellido}, ${partidoActual.jugador3.nombre}` : "Por definir");
    }

    // Rivales
    let rival1Name = "Por definir";
    let rival2Name = "Por definir";
    if (isTeam1) {
      rival1Name = partidoActual.suplente3_nombre || (partidoActual.jugador3 ? `${partidoActual.jugador3.apellido}, ${partidoActual.jugador3.nombre}` : "Rival 1");
      rival2Name = partidoActual.suplente4_nombre || (partidoActual.jugador4 ? `${partidoActual.jugador4.apellido}, ${partidoActual.jugador4.nombre}` : "Rival 2");
    } else {
      rival1Name = partidoActual.suplente1_nombre || (partidoActual.jugador1 ? `${partidoActual.jugador1.apellido}, ${partidoActual.jugador1.nombre}` : "Rival 1");
      rival2Name = partidoActual.suplente2_nombre || (partidoActual.jugador2 ? `${partidoActual.jugador2.apellido}, ${partidoActual.jugador2.nombre}` : "Rival 2");
    }

    // Resultado si finalizado
    const isFinished = partidoActual.estado === "finalizado";
    const team1Won = (partidoActual.sets_pareja1 || 0) > (partidoActual.sets_pareja2 || 0);
    const userWon = (isTeam1 && team1Won) || (isTeam2 && !team1Won);

    const userSets = isTeam1 ? partidoActual.sets_pareja1 : partidoActual.sets_pareja2;
    const rivalSets = isTeam1 ? partidoActual.sets_pareja2 : partidoActual.sets_pareja1;

    // Detalle de sets
    const setsDetail = partidoActual.sets && partidoActual.sets.length > 0
      ? partidoActual.sets.map((s: any) => isTeam1 ? `${s.games_pareja1}-${s.games_pareja2}` : `${s.games_pareja2}-${s.games_pareja1}`).join(" | ")
      : null;

    return {
      isFinished,
      userWon,
      userSets,
      rivalSets,
      setsDetail,
      partnerName,
      rival1Name,
      rival2Name,
      cancha: partidoActual.cancha,
      hora: partidoActual.hora_programada,
      fechaStr: partidoActual.fecha_programada,
    };
  }, [partidoActual, jugador.id]);

  const puntosTotales = standing?.puntos ?? 0;
  const puntosHeredados = Number(standing?.puntos_iniciales) || 0;
  const setsGanados = standing?.setsGanados ?? 0;
  const setsPerdidos = standing?.setsPerdidos ?? 0;
  const difGames = standing?.difGames ?? 0;
  const partidosJugados = standing?.partidosJugados ?? 0;

  return (
    <Card className="relative overflow-hidden border-[#9d4edd]/50 bg-gradient-to-br from-[#0a0a0f] via-[#120e24] to-[#0a0a0f] text-white shadow-[0_0_35px_rgba(157,78,221,0.22)] rounded-2xl">
      {/* Resplandor decorativo Cyber Neon */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#9d4edd]/20 via-[#ff0a54]/15 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-gradient-to-tr from-[#ff0a54]/10 via-[#9d4edd]/10 to-transparent rounded-full blur-2xl pointer-events-none -ml-20 -mb-20" />

      <CardContent className="p-4 sm:p-6 space-y-5 relative z-10">
        {/* Encabezado: Saludo y Badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#9d4edd]/25 text-[#c77dff] border border-[#9d4edd]/40 shadow-[0_0_12px_rgba(157,78,221,0.4)]">
                <Sparkles className="h-3 w-3 text-[#ff0a54]" />
                Tu Participación
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                {torneo.nombre}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>¡Hola, {jugador.nombre}!</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {onGoToRanking && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGoToRanking}
                className="h-8 text-xs border-[#9d4edd]/40 bg-[#9d4edd]/10 hover:bg-[#9d4edd]/25 text-purple-200"
              >
                Ver en la Tabla
              </Button>
            )}
            {onGoToFixture && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGoToFixture}
                className="h-8 text-xs border-[#ff0a54]/40 bg-[#ff0a54]/10 hover:bg-[#ff0a54]/25 text-pink-200"
              >
                Ver en el Fixture
              </Button>
            )}
          </div>
        </div>

        {/* Métricas Principales en Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Posición */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              Posición Actual
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-400">
                {rank > 0 ? `${rank}º` : "—"}
              </span>
              {rank > 0 && rank <= 3 && (
                <span className="text-[10px] font-black text-amber-300 uppercase px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">
                  {rank === 1 ? "Oro 🏆" : rank === 2 ? "Plata 🥈" : "Bronce 🥉"}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {torneo.modalidad === "parejas" ? "En tabla de parejas" : "En tabla general"}
            </span>
          </div>

          {/* Cancha / Zona */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-[#ff0a54]" />
              Zona de Cancha
            </span>
            <div className="mt-1">
              <Badge variant="outline" className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 border ${zonaInfo.badge}`}>
                {zonaInfo.nombre}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1">
              {rank <= 4 ? "Disputa puestos de punta" : "Asignación viva por ranking"}
            </span>
          </div>

          {/* Puntos Acumulados */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-[#9d4edd]" />
              Puntos Acumulados
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-[#c77dff]">
                {puntosTotales}
              </span>
              <span className="text-xs text-muted-foreground font-bold">pts</span>
            </div>
            {puntosHeredados > 0 ? (
              <span className="text-[9px] text-[#ff758f] font-semibold" title="Incluye 50% de puntos heredados por reemplazo">
                (+{puntosHeredados} pts heredados)
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {partidosJugados} {partidosJugados === 1 ? "partido jugado" : "partidos jugados"}
              </span>
            )}
          </div>

          {/* Rendimiento */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              Sets y Games
            </span>
            <div className="mt-1 text-sm font-bold">
              <span className="text-emerald-400">{setsGanados}</span>
              <span className="text-muted-foreground mx-1">-</span>
              <span className="text-rose-400">{setsPerdidos}</span>
              <span className="text-[10px] text-muted-foreground ml-1 font-normal">Sets</span>
            </div>
            <div className="text-[10px] mt-0.5">
              <span className="text-muted-foreground">Dif. Games: </span>
              <span className={`font-bold ${difGames > 0 ? "text-emerald-400" : difGames < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
                {difGames > 0 ? `+${difGames}` : difGames}
              </span>
            </div>
          </div>
        </div>

        {/* Sección: Tu Partido de la Fecha */}
        <div className="rounded-xl border border-white/15 bg-black/40 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#9d4edd]/20 text-[#c77dff] border border-[#9d4edd]/30">
                <Swords className="h-4 w-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white">
                Tu Encuentro de la Fecha {fechaActualNum}
              </span>
            </div>

            {matchDetails && (
              <div className="flex items-center gap-2">
                {matchDetails.isFinished ? (
                  <Badge className={`text-[10px] font-bold uppercase px-2 py-0.5 ${matchDetails.userWon ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"}`}>
                    {matchDetails.userWon ? "Victoria 🏆" : "Resultado Final"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#ff0a54]/15 text-[#ff758f] border-[#ff0a54]/40 animate-pulse">
                    Por Jugar
                  </Badge>
                )}
              </div>
            )}
          </div>

          {matchDetails ? (
            <div className="space-y-3 pt-1">
              {/* Info de Cancha y Horario */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5 font-bold text-white bg-white/5 px-2 py-1 rounded-md border border-white/10">
                  <MapPin className="h-3.5 w-3.5 text-[#ff0a54]" />
                  {matchDetails.cancha}
                </span>
                {(matchDetails.hora || matchDetails.fechaStr) && (
                  <span className="flex items-center gap-1.5 text-muted-foreground bg-white/5 px-2 py-1 rounded-md border border-white/10">
                    <Clock className="h-3.5 w-3.5 text-[#9d4edd]" />
                    {matchDetails.fechaStr && <span>{matchDetails.fechaStr}</span>}
                    {matchDetails.hora && <span>{matchDetails.hora} hs</span>}
                  </span>
                )}
              </div>

              {/* Cruce: Tu Pareja vs Rivales */}
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-2.5 items-center p-3 rounded-xl bg-white/[0.02] border border-white/10">
                {/* Tu Equipo */}
                <div className="sm:col-span-3 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-[#9d4edd] block">
                    Tu Pareja / Equipo
                  </span>
                  <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                    <span className="truncate">{jugador.apellido}, {jugador.nombre}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#9d4edd]/30 text-purple-200 border border-[#9d4edd]/50 shrink-0 font-bold">
                      TÚ
                    </span>
                  </div>
                  <div className="text-xs text-purple-200/80 font-medium truncate">
                    + {matchDetails.partnerName}
                  </div>
                </div>

                {/* Marcador / VS Central */}
                <div className="sm:col-span-1 flex flex-col items-center justify-center my-1 sm:my-0">
                  {matchDetails.isFinished ? (
                    <div className="text-center">
                      <div className="text-base sm:text-lg font-black text-white px-2 py-0.5 rounded bg-white/10 border border-white/20">
                        {matchDetails.userSets} - {matchDetails.rivalSets}
                      </div>
                      {matchDetails.setsDetail && (
                        <span className="text-[9px] text-muted-foreground block mt-0.5 font-mono">
                          {matchDetails.setsDetail}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-[#ff0a54]/20 border border-[#ff0a54]/40 text-[#ff758f] flex items-center justify-center font-black text-xs shadow-[0_0_12px_rgba(255,10,84,0.4)]">
                      VS
                    </div>
                  )}
                </div>

                {/* Rivales */}
                <div className="sm:col-span-3 space-y-1 text-left sm:text-right">
                  <span className="text-[10px] uppercase font-black tracking-wider text-rose-400 block">
                    Rivales en Cancha
                  </span>
                  <div className="font-semibold text-xs sm:text-sm text-white/90 truncate">
                    {matchDetails.rival1Name}
                  </div>
                  <div className="text-xs text-white/70 truncate">
                    + {matchDetails.rival2Name}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground space-y-1">
              <p>Los cruces y horarios de la Fecha {fechaActualNum} están en armado o aún no han sido publicados.</p>
              <p className="text-[11px] text-muted-foreground/70">
                Aparecerán aquí automáticamente en cuanto la organización publique el fixture de la semana.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
