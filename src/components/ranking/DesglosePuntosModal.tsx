import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowUpCircle, Trophy } from "lucide-react";
import type { RankingRowUnified } from "@/hooks/useClubRanking";

interface DesglosePuntosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jugador: RankingRowUnified | null;
}

export function DesglosePuntosModal({
  open,
  onOpenChange,
  jugador,
}: DesglosePuntosModalProps) {
  if (!jugador) return null;

  const torneos = jugador.desglose.filter((d) => d.tipo === "torneo");
  const ascensos = jugador.desglose.filter((d) => d.tipo === "ascenso");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Desglose de Puntos: {jugador.jugador_nombre} {jugador.jugador_apellido}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4 border border-primary/20">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Puntos Totales</p>
              <p className="text-3xl font-black text-primary">{jugador.puntos_totales}</p>
            </div>
          </div>

          {torneos.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Puntos por Torneos
              </h4>
              <div className="space-y-2">
                {torneos.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50 border text-sm"
                  >
                    <div>
                      <p className="font-medium">{t.nombre}</p>
                      {t.fecha && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.fecha).toLocaleDateString("es-AR")}
                        </p>
                      )}
                    </div>
                    <div className="font-bold">{t.puntos} pts</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ascensos.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-primary" />
                Puntos por Ascensos
              </h4>
              <div className="space-y-2">
                {ascensos.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-md bg-primary/5 border border-primary/30 text-sm"
                  >
                    <div>
                      <p className="font-medium">{a.nombre}</p>
                      {a.nota && (
                        <p className="text-xs text-primary font-medium mt-0.5">
                          Nota: {a.nota}
                        </p>
                      )}
                      {a.fecha && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(a.fecha).toLocaleDateString("es-AR")}
                        </p>
                      )}
                    </div>
                    <div className="font-bold text-primary">{a.puntos} pts</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
