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
  onSave: (config: Partial<PadelConfig>, nombres: { p1: string; p2: string }) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ open, onOpenChange, state, onSave }) => {
  const [nombres, setNombres] = useState({ p1: '', p2: '' });
  const [config, setConfig] = useState<PadelConfig>({
    modoDeuce: true,
    superTieBreak3erSet: true,
    modoSoloSuperTieBreak: false,
  });

  useEffect(() => {
    if (open) {
      setNombres(state.nombres);
      setConfig(state.config);
    }
  }, [open, state]);

  const handleSave = () => {
    onSave(config, nombres);
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
                <span className="text-padel-accent">Partido Rápido</span>
                <span className="font-normal text-xs text-slate-400">
                  Jugar 1 solo Super Tie-Break a 10 puntos
                </span>
              </Label>
              <Switch 
                id="soloSuper" 
                checked={config.modoSoloSuperTieBreak}
                onCheckedChange={c => setConfig({ ...config, modoSoloSuperTieBreak: c })}
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
