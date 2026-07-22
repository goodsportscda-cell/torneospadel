import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import type { StatsPareja } from "@/lib/zonas";

type Props = {
  tabla: StatsPareja[];
  parejaLabel: (id: string) => string;
  clasifican: number;
  zonaId?: string;      // para persistir el orden en localStorage
  readOnly?: boolean;
  hideDiferencias?: boolean;
};

const storageKey = (zonaId: string) => `zona-orden-manual-${zonaId}`;

export function TablaPosiciones({ tabla, parejaLabel, clasifican, zonaId, readOnly = false, hideDiferencias = false }: Props) {
  // orden es un array de inscripcion_id en el orden manual
  const [ordenManual, setOrdenManual] = useState<string[] | null>(null);

  // Cargar override guardado en localStorage al montar
  useEffect(() => {
    if (!zonaId) return;
    try {
      const raw = localStorage.getItem(storageKey(zonaId));
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        // Solo usarlo si coinciden las parejas (mismas inscripcion_id)
        const ids = tabla.map(s => s.inscripcion_id).sort().join(",");
        const savedIds = [...saved].sort().join(",");
        if (ids === savedIds) setOrdenManual(saved);
      }
    } catch {
      // ignorar errores de localStorage
    }
  }, [zonaId, tabla]);

  const guardarOrden = useCallback((nuevoOrden: string[]) => {
    setOrdenManual(nuevoOrden);
    if (zonaId) {
      try {
        localStorage.setItem(storageKey(zonaId), JSON.stringify(nuevoOrden));
      } catch { /* ignorar */ }
    }
  }, [zonaId]);

  const resetOrden = () => {
    setOrdenManual(null);
    if (zonaId) {
      try { localStorage.removeItem(storageKey(zonaId)); } catch { /* ignorar */ }
    }
  };

  const mover = (idx: number, direccion: -1 | 1) => {
    const orden = ordenManual ?? tabla.map(s => s.inscripcion_id);
    const nuevoOrden = [...orden];
    const swapIdx = idx + direccion;
    if (swapIdx < 0 || swapIdx >= nuevoOrden.length) return;
    [nuevoOrden[idx], nuevoOrden[swapIdx]] = [nuevoOrden[swapIdx], nuevoOrden[idx]];
    guardarOrden(nuevoOrden);
  };

  if (tabla.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin parejas asignadas</p>;
  }

  // Construir la tabla ordenada
  const idMap = new Map(tabla.map(s => [s.inscripcion_id, s]));
  const ordenActual = ordenManual ?? tabla.map(s => s.inscripcion_id);
  const tablaOrdenada = ordenActual
    .map(id => idMap.get(id))
    .filter(Boolean) as StatsPareja[];

  const tieneOverride = ordenManual !== null;

  return (
    <div className="space-y-1">
      {tieneOverride && !readOnly && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-amber-600 font-semibold uppercase">
            ✎ Orden ajustado manualmente
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground px-2"
            onClick={resetOrden}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Restablecer automático
          </Button>
        </div>
      )}
      <div className={`rounded-md border ${readOnly ? 'bg-black/40 border-white/10' : 'overflow-x-auto'}`}>
        <table className={`w-full ${readOnly ? 'text-[15px]' : 'text-sm caption-bottom'}`}>
          <thead className={readOnly ? 'border-b border-white/10' : '[&_tr]:border-b'}>
            <tr className={readOnly ? 'border-b border-white/10' : 'border-b transition-colors hover:bg-muted/50'}>
              <th className={`h-12 px-4 text-left align-middle font-medium ${readOnly ? 'text-white/70' : 'text-muted-foreground'} w-12`}>#</th>
              {!readOnly && <th className="h-12 px-4 align-middle w-14"></th>}
              <th className={`h-12 px-4 text-left align-middle font-medium ${readOnly ? 'text-white/70' : 'text-muted-foreground'}`}>Pareja</th>
              <th className={`h-12 px-4 text-center align-middle font-medium ${readOnly ? 'text-white/70' : 'text-muted-foreground'} w-12`}>PJ</th>
              <th className={`h-12 px-4 text-center align-middle font-medium ${readOnly ? 'text-white/70' : 'text-muted-foreground'} w-12`}>PG</th>
              <th className={`h-12 px-4 text-center align-middle font-medium ${readOnly ? 'text-white/70' : 'text-muted-foreground'} w-12`}>PP</th>
              <th className={`h-12 px-4 text-center align-middle font-medium ${readOnly ? 'text-white/70' : 'text-muted-foreground'} w-14`}>Pts</th>
              {!hideDiferencias && (
                <>
                  <th className={`h-12 px-4 text-center align-middle font-medium ${readOnly ? 'text-white/70' : 'text-muted-foreground'} w-14`}>DifS</th>
                  <th className={`h-12 px-4 text-center align-middle font-medium ${readOnly ? 'text-white/70' : 'text-muted-foreground'} w-14`}>DifG</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className={readOnly ? '[&_tr:last-child]:border-0' : '[&_tr:last-child]:border-0'}>
            {tablaOrdenada.map((s, idx) => {
              const clasifica = idx < clasifican;
              return (
                <tr 
                  key={s.inscripcion_id} 
                  className={`${clasifica ? (readOnly ? "bg-white/5 border-l-2 border-l-primary" : "bg-primary/5 border-l-2 border-l-primary") : ""} ${readOnly ? 'border-b border-white/10' : 'border-b transition-colors hover:bg-muted/50'}`}
                >
                  <td className="p-4 align-middle font-medium">
                    {clasifica ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="hsl(var(--primary))" />
                        <text x="12" y="16" fontSize="12" fontWeight="bold" fill="hsl(var(--primary-foreground))" textAnchor="middle">{idx + 1}</text>
                      </svg>
                    ) : (
                      <span className={`${readOnly ? 'text-white/50' : 'text-muted-foreground'} pl-1.5 font-mono text-sm`}>{idx + 1}</span>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="p-1 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => mover(idx, -1)}
                          disabled={idx === 0}
                          className="rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
                          title="Subir"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => mover(idx, 1)}
                          disabled={idx === tablaOrdenada.length - 1}
                          className="rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
                          title="Bajar"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  )}
                  <td className={`p-4 align-middle truncate max-w-[200px] ${readOnly ? 'text-white font-semibold' : ''}`}>{parejaLabel(s.inscripcion_id)}</td>
                  <td className={`p-4 align-middle text-center ${readOnly ? 'text-white/90 font-medium' : ''}`}>{s.pj}</td>
                  <td className={`p-4 align-middle text-center ${readOnly ? 'text-white/90 font-medium' : ''}`}>{s.pg}</td>
                  <td className={`p-4 align-middle text-center ${readOnly ? 'text-white/90 font-medium' : ''}`}>{s.pp}</td>
                  <td className={`p-4 align-middle text-center font-bold ${readOnly ? 'text-white' : ''}`}>{s.puntos}</td>
                  {!hideDiferencias && (
                    <>
                      <td className="p-4 align-middle text-center">
                        {s.difSets > 0 ? `+${s.difSets}` : s.difSets}
                      </td>
                      <td className="p-4 align-middle text-center">
                        {s.difGames > 0 ? `+${s.difGames}` : s.difGames}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
