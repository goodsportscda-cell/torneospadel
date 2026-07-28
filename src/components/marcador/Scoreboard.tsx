import React from 'react';
import { PadelState, obtenerTextoPuntaje } from '@/logic/padelLogic';

interface ScoreboardProps {
  state: PadelState;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ state }) => {
  const p1Score = obtenerTextoPuntaje(state, 'p1');
  const p2Score = obtenerTextoPuntaje(state, 'p2');

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-center w-full max-w-4xl mx-auto mt-8">
      
      {/* Equipo 1 */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <h2 className="text-3xl font-bold text-white uppercase tracking-wider text-center line-clamp-2 min-h-[80px] flex items-center">
          {state.nombres.p1}
        </h2>
        <div className={`text-[120px] font-black leading-none ${state.server === 'p1' ? 'text-padel-accent drop-shadow-[0_0_15px_rgba(196,255,0,0.5)]' : 'text-slate-300'}`}>
          {p1Score}
        </div>
        <div className="text-sm font-medium text-slate-400 uppercase tracking-[0.2em]">
          {state.server === 'p1' ? 'Servicio' : 'Al resto'}
        </div>
      </div>

      {/* Divisor */}
      <div className="hidden md:flex flex-col items-center justify-center px-8">
        <div className="w-px h-32 bg-slate-700/50"></div>
        <div className="py-4 text-slate-500 font-bold">VS</div>
        <div className="w-px h-32 bg-slate-700/50"></div>
      </div>

      {/* Equipo 2 */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <h2 className="text-3xl font-bold text-white uppercase tracking-wider text-center line-clamp-2 min-h-[80px] flex items-center">
          {state.nombres.p2}
        </h2>
        <div className={`text-[120px] font-black leading-none ${state.server === 'p2' ? 'text-padel-accent drop-shadow-[0_0_15px_rgba(196,255,0,0.5)]' : 'text-slate-300'}`}>
          {p2Score}
        </div>
        <div className="text-sm font-medium text-slate-400 uppercase tracking-[0.2em]">
          {state.server === 'p2' ? 'Servicio' : 'Al resto'}
        </div>
      </div>

    </div>
  );
};
