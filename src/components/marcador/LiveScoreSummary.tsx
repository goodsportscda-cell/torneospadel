import type { PadelState } from "@/logic/padelLogic";
import { obtenerTextoPuntaje } from "@/logic/padelLogic";

type Props = {
  state: PadelState | null | undefined;
  compact?: boolean;
};

export function LiveScoreSummary({ state, compact = false }: Props) {
  if (!state) return null;

  const currentSet = state.currentSet ?? (state.sets && state.sets.length > 0 ? state.sets.length + 1 : 1);
  const nombres = state.nombres ?? { p1: "Pareja 1", p2: "Pareja 2" };
  const games = state.games ?? { p1: 0, p2: 0 };
  const sets = Array.isArray(state.sets) ? state.sets : [];

  return (
    <div className={`rounded-lg border border-primary/25 bg-primary/[0.07] ${compact ? "p-2" : "p-3"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-primary">Marcador en vivo</span>
        <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-200">Set {currentSet}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["p1", "p2"] as const).map((player) => {
          let scoreText: string | number = 0;
          try {
            const raw = state.points?.[player];
            if (raw === 15 || raw === 30 || raw === 40 || raw === "AD" || raw === "40") {
              scoreText = raw;
            } else if (typeof raw === "number") {
              scoreText = obtenerTextoPuntaje(state, player);
            } else {
              scoreText = raw ?? 0;
            }
          } catch {
            scoreText = state.points?.[player] ?? 0;
          }

          return (
            <div key={player} className="min-w-0 rounded-md bg-black/20 px-2 py-1.5">
              <p className="truncate text-[10px] font-semibold text-white/65">{nombres[player] ?? (player === "p1" ? "Local" : "Visitante")}</p>
              <p className={`font-mono font-black text-primary ${compact ? "text-sm" : "text-lg"}`}>
                {games[player] ?? 0} <span className="text-white/25">·</span> {scoreText}
              </p>
            </div>
          );
        })}
      </div>
      {sets.length > 0 && (
        <div className={`mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] pt-2 ${compact ? "justify-between" : "justify-end"}`}>
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/55">Sets anteriores</span>
          <div className="flex flex-wrap gap-1.5">
            {sets.map((set, index) => (
              <span key={index} className={`rounded-md border border-white/10 bg-black/25 px-2 py-0.5 font-mono font-bold tabular-nums text-white/90 ${compact ? "text-xs" : "text-sm"}`}>
                {set.p1}–{set.p2}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
