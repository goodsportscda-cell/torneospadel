import React from 'react';
import { PadelState } from '@/logic/padelLogic';
import { Button } from '@/components/ui/button';
import { Undo2, RotateCcw, Settings2 } from 'lucide-react';

interface ControlPanelProps {
  state: PadelState;
  onSumarPunto: (player: 'p1' | 'p2') => void;
  onDeshacer: () => void;
  onReiniciar: () => void;
  onConfigurar: () => void;
  disabled?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ state, onSumarPunto, onDeshacer, onReiniciar, onConfigurar, disabled = false }) => {
  return (
    <div className="w-full max-w-4xl mx-auto mt-6 flex flex-col gap-6">
      
      {/* Botones de Puntos */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <Button 
          onClick={() => onSumarPunto('p1')}
          disabled={disabled || !!state.winner}
          className="h-20 px-2 text-base font-bold bg-padel-dark border border-padel-accent/30 hover:bg-padel-dark/80 text-white hover:border-padel-accent transition-all active:scale-95 sm:h-24 sm:px-4 sm:text-2xl"
        >
          + PUNTO {state.nombres.p1}
        </Button>
        <Button 
          onClick={() => onSumarPunto('p2')}
          disabled={disabled || !!state.winner}
          className="h-20 px-2 text-base font-bold bg-padel-dark border border-padel-accent/30 hover:bg-padel-dark/80 text-white hover:border-padel-accent transition-all active:scale-95 sm:h-24 sm:px-4 sm:text-2xl"
        >
          + PUNTO {state.nombres.p2}
        </Button>
      </div>

      {/* Botones de Utilidad */}
      <div className="glass-card rounded-xl p-3 sm:p-4 grid grid-cols-3 items-center gap-2 sm:gap-4">
        <Button 
          variant="outline" 
          onClick={onDeshacer}
          disabled={disabled || state.history.length === 0}
          className="min-w-0 px-2 bg-slate-800/50 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 text-xs sm:text-sm"
        >
          <Undo2 className="w-4 h-4 mr-2" /> Deshacer
        </Button>

        <Button 
          variant="outline" 
          disabled={disabled}
          onClick={onReiniciar}
          className="min-w-0 px-2 bg-slate-800/50 border-slate-700 text-slate-300 hover:text-red-400 hover:bg-slate-700 hover:border-red-900 text-xs sm:text-sm"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Reiniciar
        </Button>

        <Button 
          variant="outline" 
          disabled={disabled}
          onClick={onConfigurar}
          className="min-w-0 px-2 bg-slate-800/50 border-slate-700 text-slate-300 hover:text-padel-accent hover:bg-slate-700 hover:border-padel-accent/50 text-xs sm:text-sm"
        >
          <Settings2 className="w-4 h-4 mr-2" /> Configurar
        </Button>
      </div>

    </div>
  );
};
