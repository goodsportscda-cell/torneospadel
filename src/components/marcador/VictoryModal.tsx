import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';

interface VictoryModalProps {
  open: boolean;
  winnerName: string | null;
  onReiniciar: () => void;
  onClose: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ open, winnerName, onReiniciar, onClose }) => {
  useEffect(() => {
    if (open && winnerName) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
      }, 250);

      return () => clearInterval(interval);
    }
  }, [open, winnerName]);

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px] bg-padel-dark border-padel-accent/50 text-white text-center">
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-black text-padel-accent flex flex-col items-center gap-4 py-6">
            <Trophy className="w-20 h-20" />
            ¡VICTORIA!
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <p className="text-lg text-slate-300 mb-2">Felicitaciones a</p>
          <h2 className="text-3xl font-bold uppercase">{winnerName}</h2>
        </div>
        
        <DialogFooter className="sm:justify-center flex-col sm:flex-row gap-3">
          <Button onClick={onClose} variant="outline" className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 w-full">
            Ver Tablero
          </Button>
          <Button onClick={onReiniciar} className="bg-padel-accent text-padel-dark hover:bg-padel-accent/90 font-bold w-full">
            Nuevo Partido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
