import type { PadelState } from "@/logic/padelLogic";
import { obtenerTextoPuntaje } from "@/logic/padelLogic";

type Props = {
  state: PadelState;
  compact?: boolean;
};

export function LiveScoreSummary({ state, compact = false }: Props) {
  const completedSets = state.sets.map((set) => `${set.p1}–${set.p2}`).join("  ");

  return (
    <div className={`rounded-lg border border-primary/25 bg-primary/[0.07] ${compact ? "p-2" : "p-3"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-primary">Marcador en vivo</span>
        <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-200">Set {state.currentSet}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["p1", "p2"] as const).map((player) => (
          <div key={player} className="min-w-0 rounded-md bg-black/20 px-2 py-1.5">
            <p className="truncate text-[10px] font-semibold text-white/65">{state.nombres[player]}</p>
            <p className={`font-mono font-black text-primary ${compact ? "text-sm" : "text-lg"}`}>
              {state.games[player]} <span className="text-white/25">·</span> {obtenerTextoPuntaje(state, player)}
            </p>
          </div>
        ))}
      </div>
      {completedSets && <p className="mt-2 text-right font-mono text-[9px] text-white/45">Sets anteriores: {completedSets}</p>}
    </div>
  );
}
