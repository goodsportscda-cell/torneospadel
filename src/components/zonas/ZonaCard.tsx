import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Trash2, GripVertical, X, ArrowUpDown, ChevronDown, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { calcularTabla, generarFixture, type PartidoConSets } from "@/lib/zonas";
import { PartidoCard } from "./PartidoCard";
import { TablaPosiciones } from "./TablaPosiciones";

export type Zona = {
  id: string;
  nombre: string;
  tamanio: number;
  orden: number;
};

export type ParejaInscripta = {
  inscripcion_id: string;
  label: string;
};

type ZonaPareja = {
  id: string;
  zona_id: string;
  inscripcion_id: string;
  posicion_siembra: number;
};

type Partido = {
  id: string;
  zona_id: string;
  orden: number;
  tipo: "directo" | "ganadores" | "perdedores";
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  posicion_local: number | null;
  posicion_visitante: number | null;
  estado: "pendiente" | "en_juego" | "finalizado";
  ganador_id: string | null;
  fecha_hora: string | null;
  cancha: string | null;
};

type Props = {
  zona: Zona;
  parejasDisponibles: ParejaInscripta[];
  parejaLabel: (id: string) => string;
  onChanged: () => void;
  onDeleted: () => void;
};

function SlotDroppable({
  zonaId,
  posicion,
  children,
}: {
  zonaId: string;
  posicion: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${zonaId}-${posicion}`,
    data: { zonaId, posicion },
  });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border-2 border-dashed p-2 min-h-[42px] transition-colors ${
        isOver ? "border-primary bg-primary/10" : "border-muted-foreground/30"
      }`}
    >
      {children}
    </div>
  );
}

function ParejaDraggable({
  inscripcionId,
  zonaParejaId,
  label,
  onRemove,
}: {
  inscripcionId: string;
  zonaParejaId: string;
  label: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pareja-${zonaParejaId}`,
    data: { inscripcionId, zonaParejaId },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1 rounded bg-card border px-2 py-1 text-xs ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <span className="flex-1 truncate">{label}</span>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function ZonaCard({ zona, parejaLabel, onChanged, onDeleted }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [zonaParejas, setZonaParejas] = useState<ZonaPareja[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [partidosCargados, setPartidosCargados] = useState(false);
  const [generandoFixture, setGenerandoFixture] = useState(false);
  const [setsByPartido, setSetsByPartido] = useState<
    Record<string, { numero_set: number; games_local: number; games_visitante: number }[]>
  >({});

  const descargarImagen = async () => {
    if (!cardRef.current) return;
    setDescargando(true);
    try {
      const wasClosed = !isOpen;
      if (wasClosed) {
        setIsOpen(true);
        // Esperamos un momento a que se complete la animación de apertura
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `Zona-${zona.nombre}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagen descargada");
    } catch (error) {
      console.error("Error al descargar imagen:", error);
      toast.error("Error al generar la imagen");
    } finally {
      setDescargando(false);
    }
  };

  const cargar = useCallback(async () => {
    const [{ data: zp }, { data: parts }] = await Promise.all([
      supabase.from("zonas_parejas").select("*").eq("zona_id", zona.id).order("posicion_siembra"),
      supabase.from("partidos_zona").select("*").eq("zona_id", zona.id).order("orden"),
    ]);
    setZonaParejas((zp ?? []) as ZonaPareja[]);
    setPartidos((parts ?? []) as Partido[]);
    setPartidosCargados(true);

    if (parts && parts.length > 0) {
      const ids = parts.map((p) => p.id);
      const { data: sets } = await supabase.from("sets_partido").select("*").in("partido_id", ids);
      const map: typeof setsByPartido = {};
      (sets ?? []).forEach((s) => {
        if (!map[s.partido_id]) map[s.partido_id] = [];
        map[s.partido_id].push({
          numero_set: s.numero_set,
          games_local: s.games_local,
          games_visitante: s.games_visitante,
        });
      });
      Object.keys(map).forEach((k) => map[k].sort((a, b) => a.numero_set - b.numero_set));
      setSetsByPartido(map);
    } else {
      setSetsByPartido({});
    }
  }, [zona.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Genera fixture si no existe (solo después de la primera carga real, y con guard contra duplicados)
  useEffect(() => {
    if (!partidosCargados) return;
    if (partidos.length > 0) return;
    if (generandoFixture) return;
    const generarSiHaceFalta = async () => {
      setGenerandoFixture(true);
      try {
        // Doble chequeo contra la BD para evitar carreras entre múltiples cards montadas
        const { data: existentes } = await supabase
          .from("partidos_zona")
          .select("id")
          .eq("zona_id", zona.id);
        if (existentes && existentes.length > 0) {
          await cargar();
          return;
        }
        const fixture = generarFixture(zona.tamanio as 3 | 4);
        const toInsert = fixture.map((f) => ({
          zona_id: zona.id,
          orden: f.orden,
          tipo: f.tipo,
          posicion_local: f.posicion_local,
          posicion_visitante: f.posicion_visitante,
        }));
        const { error } = await supabase.from("partidos_zona").insert(toInsert);
        if (!error) await cargar();
      } finally {
        setGenerandoFixture(false);
      }
    };
    generarSiHaceFalta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona.id, partidosCargados, partidos.length]);

  const slotsLlenos = useMemo(() => {
    const map = new Map<number, ZonaPareja>();
    zonaParejas.forEach((zp) => map.set(zp.posicion_siembra, zp));
    return map;
  }, [zonaParejas]);

  // Sincroniza partidos directos con las posiciones (cuando cambia el sembrado)
  useEffect(() => {
    const sync = async () => {
      const tasks: Promise<unknown>[] = [];
      partidos
        .filter((p) => p.tipo === "directo" && p.posicion_local && p.posicion_visitante)
        .forEach((p) => {
          const local = slotsLlenos.get(p.posicion_local!);
          const visit = slotsLlenos.get(p.posicion_visitante!);
          const newLocal = local?.inscripcion_id ?? null;
          const newVis = visit?.inscripcion_id ?? null;
          if (p.pareja_local_id !== newLocal || p.pareja_visitante_id !== newVis) {
            tasks.push(
              Promise.resolve(
                supabase
                  .from("partidos_zona")
                  .update({ pareja_local_id: newLocal, pareja_visitante_id: newVis })
                  .eq("id", p.id),
              ),
            );
          }
        });
      if (tasks.length > 0) {
        await Promise.all(tasks);
        cargar();
      }
    };
    if (partidos.length > 0) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonaParejas, partidos.length]);

  // Para zona de 4: avanzar ganadores/perdedores
  useEffect(() => {
    if (zona.tamanio !== 4) return;
    const sync = async () => {
      const p1 = partidos.find((p) => p.orden === 1);
      const p2 = partidos.find((p) => p.orden === 2);
      const ganadores = partidos.find((p) => p.tipo === "ganadores");
      const perdedores = partidos.find((p) => p.tipo === "perdedores");
      if (!p1 || !p2 || !ganadores || !perdedores) return;

      const updates: Promise<unknown>[] = [];

      const gan1 = p1.estado === "finalizado" ? p1.ganador_id : null;
      const gan2 = p2.estado === "finalizado" ? p2.ganador_id : null;
      const per1 =
        p1.estado === "finalizado" && p1.ganador_id
          ? p1.pareja_local_id === p1.ganador_id
            ? p1.pareja_visitante_id
            : p1.pareja_local_id
          : null;
      const per2 =
        p2.estado === "finalizado" && p2.ganador_id
          ? p2.pareja_local_id === p2.ganador_id
            ? p2.pareja_visitante_id
            : p2.pareja_local_id
          : null;

      if (ganadores.pareja_local_id !== gan1 || ganadores.pareja_visitante_id !== gan2) {
        updates.push(
          Promise.resolve(
            supabase
              .from("partidos_zona")
              .update({ pareja_local_id: gan1, pareja_visitante_id: gan2 })
              .eq("id", ganadores.id),
          ),
        );
      }
      if (perdedores.pareja_local_id !== per1 || perdedores.pareja_visitante_id !== per2) {
        updates.push(
          Promise.resolve(
            supabase
              .from("partidos_zona")
              .update({ pareja_local_id: per1, pareja_visitante_id: per2 })
              .eq("id", perdedores.id),
          ),
        );
      }
      if (updates.length > 0) {
        await Promise.all(updates);
        cargar();
      }
    };
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidos, zona.tamanio]);

  // Recargar cuando cambia algo externamente (ej: drop desde otra zona/panel)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { zonaId: string } | undefined;
      if (detail?.zonaId === zona.id) cargar();
    };
    window.addEventListener("zonas:changed", handler as EventListener);
    return () => window.removeEventListener("zonas:changed", handler as EventListener);
  }, [zona.id, cargar]);


  const quitarPareja = async (zonaParejaId: string) => {
    await supabase.from("zonas_parejas").delete().eq("id", zonaParejaId);
    await cargar();
    onChanged();
  };

  const eliminarZona = async () => {
    await supabase.from("zonas").delete().eq("id", zona.id);
    onDeleted();
  };

  const cambiarTamanio = async () => {
    const nuevoTamanio = zona.tamanio === 3 ? 4 : 3;
    // Si reducimos de 4 a 3, quitar pareja en posición 4 (si existe)
    if (nuevoTamanio === 3) {
      const pos4 = zonaParejas.find((zp) => zp.posicion_siembra === 4);
      if (pos4) {
        await supabase.from("zonas_parejas").delete().eq("id", pos4.id);
      }
    }
    // Borrar partidos existentes (se regeneran con el nuevo fixture)
    await supabase.from("partidos_zona").delete().eq("zona_id", zona.id);
    // Actualizar tamaño
    const { error } = await supabase
      .from("zonas")
      .update({ tamanio: nuevoTamanio })
      .eq("id", zona.id);
    if (error) {
      toast.error("Error al cambiar tamaño");
      return;
    }
    toast.success(`Zona ${zona.nombre} ahora es de ${nuevoTamanio}`);
    onChanged();
  };

  const tabla = useMemo(() => {
    const partidosConSets: PartidoConSets[] = partidos.map((p) => ({
      id: p.id,
      pareja_local_id: p.pareja_local_id,
      pareja_visitante_id: p.pareja_visitante_id,
      ganador_id: p.ganador_id,
      estado: p.estado,
      sets: setsByPartido[p.id] ?? [],
    }));
    return calcularTabla(
      zonaParejas.map((zp) => ({
        inscripcion_id: zp.inscripcion_id,
        posicion_siembra: zp.posicion_siembra,
      })),
      partidosConSets,
    );
  }, [zonaParejas, partidos, setsByPartido]);

  const clasifican = zona.tamanio === 4 ? 3 : 2;

  return (
    <Card className="overflow-hidden" ref={cardRef}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-3 flex-1 text-left group">
              <div className={`p-1 rounded-full transition-colors ${isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/5"}`}>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </div>
              <CardTitle className="text-lg flex items-center gap-2 m-0">
                Zona {zona.nombre}
                <Badge variant="outline" className="font-normal">{zona.tamanio} parejas</Badge>
              </CardTitle>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary"
              onClick={descargarImagen}
              disabled={descargando}
              title="Descargar imagen de la zona"
            >
              {descargando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title={`Cambiar a zona de ${zona.tamanio === 3 ? 4 : 3}`}>
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    ¿Convertir Zona {zona.nombre} en zona de {zona.tamanio === 3 ? 4 : 3}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Se regenera el fixture y se borran los resultados cargados de esta zona.
                    {zona.tamanio === 4 && " La pareja en la posición 4 (si hay) volverá al panel de disponibles."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={cambiarTamanio}>Convertir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar Zona {zona.nombre}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borrarán todos los partidos y resultados de esta zona. Las parejas vuelven al panel de
                    disponibles.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={eliminarZona}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <CollapsibleContent>
          <CardContent className="p-4 space-y-4 pt-4">
          {/* Slots de siembra */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Sembrado</p>
            {Array.from({ length: zona.tamanio }, (_, i) => i + 1).map((pos) => {
              const ocupado = slotsLlenos.get(pos);
              return (
                <div key={pos} className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-4">{pos}.</span>
                  <div className="flex-1">
                    <SlotDroppable zonaId={zona.id} posicion={pos}>
                      {ocupado ? (
                        <ParejaDraggable
                          inscripcionId={ocupado.inscripcion_id}
                          zonaParejaId={ocupado.id}
                          label={parejaLabel(ocupado.inscripcion_id)}
                          onRemove={() => quitarPareja(ocupado.id)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Arrastrá una pareja aquí</span>
                      )}
                    </SlotDroppable>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fixture */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Fixture</p>
            <div className="space-y-2">
              {partidos.map((p) => (
                <PartidoCard
                  key={p.id}
                  partidoId={p.id}
                  orden={p.orden}
                  tipo={p.tipo}
                  parejaLocal={
                    p.pareja_local_id
                      ? {
                          inscripcion_id: p.pareja_local_id,
                          posicion_siembra: p.posicion_local ?? 0,
                          label: parejaLabel(p.pareja_local_id),
                        }
                      : null
                  }
                  parejaVisitante={
                    p.pareja_visitante_id
                      ? {
                          inscripcion_id: p.pareja_visitante_id,
                          posicion_siembra: p.posicion_visitante ?? 0,
                          label: parejaLabel(p.pareja_visitante_id),
                        }
                      : null
                  }
                  estado={p.estado}
                  ganadorId={p.ganador_id}
                  setsExistentes={setsByPartido[p.id] ?? []}
                  onUpdated={cargar}
                  showProgramacion
                  fechaHora={p.fecha_hora}
                  cancha={p.cancha}
                />
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Posiciones (clasifican {clasifican})
            </p>
            <TablaPosiciones tabla={tabla} parejaLabel={parejaLabel} clasifican={clasifican} />
          </div>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  </Card>
  );
}
