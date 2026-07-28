import React from 'react';
import { PadelState } from '@/logic/padelLogic';

interface SetHistoryProps {
  state: PadelState;
}

export const SetHistory: React.FC<SetHistoryProps> = ({ state }) => {
  const allSets = [...state.sets];
  // Rellenar hasta 3 sets visualmente si es necesario
  while (allSets.length < 3) {
    if (allSets.length === state.currentSet - 1) {
      // El set actual
      allSets.push({ p1: state.games.p1, p2: state.games.p2 });
    } else {
      // Sets futuros
      allSets.push({ p1: 0, p2: 0 });
    }
  }

  // Si estamos en un cuarto o más sets (improbable, pero por las dudas)
  if (state.currentSet > allSets.length) {
    allSets[state.currentSet - 1] = { p1: state.games.p1, p2: state.games.p2 };
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden mt-6 w-full max-w-4xl mx-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-800/80 text-slate-400 text-sm uppercase tracking-wider">
            <th className="py-4 px-6 font-semibold">Parejas</th>
            {allSets.map((_, i) => (
              <th key={i} className="py-4 px-4 text-center font-semibold w-24">
                Set {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-white font-medium text-lg">
          <tr className="border-b border-slate-700/50">
            <td className="py-4 px-6 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${state.server === 'p1' ? 'bg-padel-accent' : 'bg-transparent'}`}></div>
              {state.nombres.p1}
            </td>
            {allSets.map((set, i) => (
              <td key={`p1-set-${i}`} className={`py-4 px-4 text-center ${(i === state.currentSet - 1) ? 'text-padel-accent font-bold' : ''}`}>
                {set.p1}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-4 px-6 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${state.server === 'p2' ? 'bg-padel-accent' : 'bg-transparent'}`}></div>
              {state.nombres.p2}
            </td>
            {allSets.map((set, i) => (
              <td key={`p2-set-${i}`} className={`py-4 px-4 text-center ${(i === state.currentSet - 1) ? 'text-padel-accent font-bold' : ''}`}>
                {set.p2}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};
