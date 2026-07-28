import React, { useState, useEffect } from 'react';
import { 
  initialState, 
  PadelState, 
  sumarPunto, 
  deshacerPunto, 
  reiniciarPartido, 
  actualizarConfiguracion,
  forzarSetsPrevios,
  SetScore
} from '@/logic/padelLogic';
import { Scoreboard } from '@/components/marcador/Scoreboard';
import { ControlPanel } from '@/components/marcador/ControlPanel';
import { SetHistory } from '@/components/marcador/SetHistory';
import { ConfigModal } from '@/components/marcador/ConfigModal';
import { VictoryModal } from '@/components/marcador/VictoryModal';
import { MonitorPlay } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'padel_scoreboard_state_v1';

const Marcador: React.FC = () => {
  const [state, setState] = useState<PadelState>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load scoreboard state', e);
      }
    }
    return initialState;
  });

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isVictoryOpen, setIsVictoryOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    if (state.winner) {
      setIsVictoryOpen(true);
    }
  }, [state]);

  const handleSumarPunto = (player: 'p1' | 'p2') => {
    setState(prev => sumarPunto(prev, player));
  };

  const handleDeshacer = () => {
    setState(prev => deshacerPunto(prev));
  };

  const handleReiniciar = () => {
    setState(prev => reiniciarPartido(prev));
    setIsVictoryOpen(false);
  };

  const handleSaveConfig = (config: any, nombres: any, manualSets: SetScore[]) => {
    setState(prev => {
      let nextState = actualizarConfiguracion(prev, config, nombres);
      nextState = forzarSetsPrevios(nextState, manualSets);
      return nextState;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col">
      <header className="flex items-center gap-3 mb-8 text-white max-w-4xl mx-auto w-full">
        <MonitorPlay className="w-8 h-8 text-padel-accent" />
        <h1 className="text-2xl font-black uppercase tracking-widest text-padel-accent">Marcador en Vivo</h1>
      </header>

      <main className="flex-1 flex flex-col">
        <Scoreboard state={state} />
        
        <SetHistory state={state} />

        <ControlPanel 
          state={state} 
          onSumarPunto={handleSumarPunto}
          onDeshacer={handleDeshacer}
          onReiniciar={handleReiniciar}
          onConfigurar={() => setIsConfigOpen(true)}
        />
      </main>

      <ConfigModal 
        open={isConfigOpen} 
        onOpenChange={setIsConfigOpen}
        state={state}
        onSave={handleSaveConfig}
      />

      <VictoryModal 
        open={isVictoryOpen} 
        winnerName={state.winner ? state.nombres[state.winner] : null}
        onReiniciar={handleReiniciar}
        onClose={() => setIsVictoryOpen(false)}
      />
    </div>
  );
};

export default Marcador;
