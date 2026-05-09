import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
};

const storageKey = (zonaId: string) => `zona-orden-manual-${zonaId}`;

export function TablaPosiciones({ tabla, parejaLabel, clasifican, zonaId, readOnly = false }: Props) {
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
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              {!readOnly && <TableHead className="w-14"></TableHead>}
              <TableHead>Pareja</TableHead>
              <TableHead className="text-center w-10">PJ</TableHead>
              <TableHead className="text-center w-10">PG</TableHead>
              <TableHead className="text-center w-10">PP</TableHead>
              <TableHead className="text-center w-12">Pts</TableHead>
              <TableHead className="text-center w-14">DifS</TableHead>
              <TableHead className="text-center w-14">DifG</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tablaOrdenada.map((s, idx) => {
              const clasifica = idx < clasifican;
              return (
                <TableRow key={s.inscripcion_id} className={clasifica ? "bg-primary/5" : ""}>
                  <TableCell className="font-medium">
                    {clasifica ? (
                      <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center">
                        {idx + 1}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{idx + 1}</span>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="p-1">
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
                    </TableCell>
                  )}
                  <TableCell className="truncate max-w-[200px]">{parejaLabel(s.inscripcion_id)}</TableCell>
                  <TableCell className="text-center">{s.pj}</TableCell>
                  <TableCell className="text-center">{s.pg}</TableCell>
                  <TableCell className="text-center">{s.pp}</TableCell>
                  <TableCell className="text-center font-semibold">{s.puntos}</TableCell>
                  <TableCell className="text-center">
                    {s.difSets > 0 ? `+${s.difSets}` : s.difSets}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.difGames > 0 ? `+${s.difGames}` : s.difGames}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
