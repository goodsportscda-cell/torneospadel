import React, { useState, useEffect } from 'react';
import { PadelState, PadelConfig } from '@/logic/padelLogic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PadelState;
  onSave: (config: Partial<PadelConfig>, nombres: { p1: string; p2: string }, manualSets: {p1: number, p2: number}[]) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ open, onOpenChange, state, onSave }) => {
  const [nombres, setNombres] = useState({ p1: '', p2: '' });
  const [config, setConfig] = useState<PadelConfig>({
    modoDeuce: true,
    superTieBreak3erSet: true,
    modoSoloSuperTieBreak: false,
    modoSoloTieBreak: false,
  });
  const [manualSets, setManualSets] = useState<{p1: number, p2: number}[]>([
    { p1: 0, p2: 0 },
    { p1: 0, p2: 0 }
  ]);

  useEffect(() => {
    if (open) {
      setNombres(state.nombres);
      setConfig(state.config);
      // Reset manual sets whenever opened to avoid accidental overwrites
      setManualSets([{ p1: 0, p2: 0 }, { p1: 0, p2: 0 }]);
    }
  }, [open, state]);

  const handleSave = () => {
    onSave(config, nombres, manualSets);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Configuración del Partido</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Parejas</h3>
            <div className="grid gap-2">
              <Label htmlFor="p1">Pareja 1</Label>
              <Input 
                id="p1" 
                value={nombres.p1} 
                onChange={e => setNombres({ ...nombres, p1: e.target.value })}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p2">Pareja 2</Label>
              <Input 
                id="p2" 
                value={nombres.p2} 
                onChange={e => setNombres({ ...nombres, p2: e.target.value })}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Cargar Sets Previos</h3>
            <p className="text-xs text-slate-500">Dejar en 0 si no hubo sets previos.</p>
            
            <div className="flex gap-4 items-center">
              <Label className="w-12">Set 1</Label>
              <Input 
                type="number" min="0" max="7" 
                value={manualSets[0].p1} 
                onChange={e => setManualSets(prev => [{...prev[0], p1: parseInt(e.target.value) || 0}, prev[1]])}
                className="bg-slate-800 border-slate-700 text-center"
              />
              <span className="text-slate-400">-</span>
              <Input 
                type="number" min="0" max="7" 
                value={manualSets[0].p2} 
                onChange={e => setManualSets(prev => [{...prev[0], p2: parseInt(e.target.value) || 0}, prev[1]])}
                className="bg-slate-800 border-slate-700 text-center"
              />
            </div>

            <div className="flex gap-4 items-center">
              <Label className="w-12">Set 2</Label>
              <Input 
                type="number" min="0" max="7" 
                value={manualSets[1].p1} 
                onChange={e => setManualSets(prev => [prev[0], {...prev[1], p1: parseInt(e.target.value) || 0}])}
                className="bg-slate-800 border-slate-700 text-center"
              />
              <span className="text-slate-400">-</span>
              <Input 
                type="number" min="0" max="7" 
                value={manualSets[1].p2} 
                onChange={e => setManualSets(prev => [prev[0], {...prev[1], p2: parseInt(e.target.value) || 0}])}
                className="bg-slate-800 border-slate-700 text-center"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Reglas</h3>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="modoDeuce" className="flex flex-col gap-1 cursor-pointer">
                <span>Modo de Desempate</span>
                <span className="font-normal text-xs text-slate-400">
                  {config.modoDeuce ? 'Ventaja (Deuce)' : 'Punto de Oro'}
                </span>
              </Label>
              <Switch 
                id="modoDeuce" 
                checked={config.modoDeuce}
                onCheckedChange={c => setConfig({ ...config, modoDeuce: c })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="superTie" className="flex flex-col gap-1 cursor-pointer">
                <span>3er Set</span>
                <span className="font-normal text-xs text-slate-400">
                  {config.superTieBreak3erSet ? 'Super Tie-Break a 10' : 'Set normal a 6 juegos'}
                </span>
              </Label>
              <Switch 
                id="superTie" 
                checked={config.superTieBreak3erSet}
                onCheckedChange={c => setConfig({ ...config, superTieBreak3erSet: c })}
                disabled={config.modoSoloSuperTieBreak}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="soloSuper" className="flex flex-col gap-1 cursor-pointer">
                <span className="text-padel-accent">Partido Rápido (a 10)</span>
                <span className="font-normal text-xs text-slate-400">
                  Jugar 1 solo Super Tie-Break a 10 puntos
                </span>
              </Label>
              <Switch 
                id="soloSuper" 
                checked={config.modoSoloSuperTieBreak}
                onCheckedChange={c => setConfig({ ...config, modoSoloSuperTieBreak: c, modoSoloTieBreak: c ? false : config.modoSoloTieBreak })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="soloTie" className="flex flex-col gap-1 cursor-pointer">
                <span className="text-padel-accent">Partido Rápido (a 7)</span>
                <span className="font-normal text-xs text-slate-400">
                  Jugar 1 solo Tie-Break normal a 7 puntos
                </span>
              </Label>
              <Switch 
                id="soloTie" 
                checked={config.modoSoloTieBreak}
                onCheckedChange={c => setConfig({ ...config, modoSoloTieBreak: c, modoSoloSuperTieBreak: c ? false : config.modoSoloSuperTieBreak })}
              />
            </div>

          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={handleSave} className="bg-padel-accent text-padel-dark hover:bg-padel-accent/90 font-bold w-full">
            Guardar Configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
