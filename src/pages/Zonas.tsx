import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Wand2, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { calcularDistribucionZonas, nombreZona } from "@/lib/zonas";
import { ZonaCard, type Zona, type ParejaInscripta } from "@/components/zonas/ZonaCard";
import { PanelDisponibles } from "@/components/zonas/PanelDisponibles";
import { handleDropPareja } from "@/lib/dragZonas";
import { CronogramaPartidos } from "@/components/zonas/CronogramaPartidos";
import type { Database } from "@/integrations/supabase/types";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Inscripcion = Database["public"]["Tables"]["inscripciones"]["Row"];
type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];

export default function Zonas() {
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [torneoId, setTorneoId] = useState<string>("");
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaParejasGlobal, setZonaParejasGlobal] = useState<
    { id: string; inscripcion_id: string; zona_id: string; posicion_siembra: number }[]
  >([]);
  const [activeItem, setActiveItem] = useState<{ id: string; label: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar torneos al inicio
  useEffect(() => {
    const cargar = async () => {
      const { data: ts } = await supabase
        .from("torneos")
        .select("*")
        .eq("tipo", "oficial")
        .order("fecha_inicio", { ascending: false });
      setTorneos((ts ?? []) as Torneo[]);
      if (ts && ts.length > 0 && !torneoId) {
        setTorneoId(ts[0].id);
      }
      setLoading(false);
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar datos del torneo seleccionado
  const cargarDatos = async () => {
    if (!torneoId) return;
    const [{ data: ins }, { data: jugs }, { data: zs }] = await Promise.all([
      supabase.from("inscripciones").select("*").eq("torneo_id", torneoId),
      supabase.from("jugadores").select("*"),
      supabase.from("zonas").select("*").eq("torneo_id", torneoId).order("orden"),
    ]);
    setInscripciones((ins ?? []) as Inscripcion[]);
    setJugadores((jugs ?? []) as Jugador[]);
    setZonas((zs ?? []) as Zona[]);

    if (zs && zs.length > 0) {
      const ids = zs.map((z) => z.id);
      const { data: zp } = await supabase
        .from("zonas_parejas")
        .select("id, inscripcion_id, zona_id, posicion_siembra")
        .in("zona_id", ids);
      setZonaParejasGlobal(zp ?? []);
    } else {
      setZonaParejasGlobal([]);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const onDragStart = (event: DragStartEvent) => {
    try {
      const { active } = event;
      const data = active.data.current as { inscripcionId: string; label?: string } | undefined;
      console.log("[Zonas] drag start", { id: active.id, data });
      if (data) {
        setActiveItem({
          id: active.id as string,
          label: data.label || parejaLabel(data.inscripcionId),
        });
      }
    } catch (e) {
      console.error("[Zonas] Error in onDragStart", e);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveItem(null);
    console.log("[Zonas] drag end", {
      active: event.active?.id,
      over: event.over?.id,
      activeData: event.active?.data?.current,
      overData: event.over?.data?.current,
    });
    const res = await handleDropPareja(event, zonaParejasGlobal);
    if (res.ok) {
      window.dispatchEvent(new CustomEvent("zonas:changed", { detail: { zonaId: res.zonaId } }));
      cargarDatos();
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId]);

  const jugadorMap = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);

  const parejaLabel = (inscripcionId: string): string => {
    const ins = inscripciones.find((i) => i.id === inscripcionId);
    if (!ins) return "—";
    const j1 = jugadorMap.get(ins.jugador1_id);
    const j2 = jugadorMap.get(ins.jugador2_id);
    const n1 = j1 ? `${j1.apellido}` : "?";
    const n2 = j2 ? `${j2.apellido}` : "?";
    return `${n1} / ${n2}`;
  };

  const todasLasParejas: ParejaInscripta[] = useMemo(
    () =>
      inscripciones.map((ins) => ({
        inscripcion_id: ins.id,
        label: parejaLabel(ins.id),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inscripciones, jugadorMap],
  );

  const idsAsignados = useMemo(
    () => new Set(zonaParejasGlobal.map((zp) => zp.inscripcion_id)),
    [zonaParejasGlobal],
  );

  const parejasDisponibles = useMemo(
    () => todasLasParejas.filter((p) => !idsAsignados.has(p.inscripcion_id)),
    [todasLasParejas, idsAsignados],
  );

  const generarZonasAuto = async () => {
    const total = inscripciones.length;
    if (total < 3) {
      toast.error("Se necesitan al menos 3 parejas inscriptas");
      return;
    }
    const distribucion = calcularDistribucionZonas(total);
    const toInsert = distribucion.map((tamanio, idx) => ({
      torneo_id: torneoId,
      nombre: nombreZona(idx),
      tamanio,
      orden: idx,
    }));
    const { error } = await supabase.from("zonas").insert(toInsert);
    if (error) {
      toast.error("Error al crear zonas");
      console.error(error);
      return;
    }
    toast.success(`${distribucion.length} zonas creadas`);
    cargarDatos();
  };

  const agregarZonaManual = async (tamanio: 3 | 4) => {
    const orden = zonas.length;
    const { error } = await supabase.from("zonas").insert({
      torneo_id: torneoId,
      nombre: nombreZona(orden),
      tamanio,
      orden,
    });
    if (error) {
      toast.error("Error al crear zona");
      return;
    }
    cargarDatos();
  };

  const borrarTodasLasZonas = async () => {
    const ids = zonas.map((z) => z.id);
    if (ids.length === 0) return;
    await supabase.from("zonas").delete().in("id", ids);
    toast.success("Zonas eliminadas");
    cargarDatos();
  };

  const torneoSeleccionado = torneos.find((t) => t.id === torneoId);
  const distribucionSugerida = useMemo(
    () => calcularDistribucionZonas(inscripciones.length),
    [inscripciones.length],
  );

  if (loading) {
    return <div className="p-6 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Zonas</h1>
        <p className="text-sm text-muted-foreground">
          Armado de grupos para la fase clasificatoria.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Torneo</label>
              <Select value={torneoId} onValueChange={setTorneoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un torneo oficial" />
                </SelectTrigger>
                <SelectContent>
                  {torneos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {torneoSeleccionado && (
            <div className="flex flex-wrap items-center gap-3 text-sm pt-2 border-t">
              <span>
                <strong>{inscripciones.length}</strong> parejas inscriptas
              </span>
              {inscripciones.length >= 3 && (
                <span className="text-muted-foreground">
                  Sugerido: {distribucionSugerida.length} zonas (
                  {distribucionSugerida.join(" + ")})
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {torneoId && (
        <Tabs defaultValue="zonas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="zonas">Zonas</TabsTrigger>
            <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          </TabsList>

          <TabsContent value="zonas" className="space-y-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActiveItem(null)}
            >
              <div className="flex flex-wrap gap-2">
                {zonas.length === 0 ? (
                  <Button onClick={generarZonasAuto} disabled={inscripciones.length < 3}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generar zonas automáticamente
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => agregarZonaManual(3)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Zona de 3
                    </Button>
                    <Button variant="outline" onClick={() => agregarZonaManual(4)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Zona de 4
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="ml-auto">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Borrar todas las zonas
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Borrar todas las zonas?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminarán todas las zonas, partidos y resultados de este torneo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={borrarTodasLasZonas}>Borrar todo</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>

              {zonas.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                  <div>
                    <PanelDisponibles parejas={parejasDisponibles} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {zonas.map((zona) => (
                      <ZonaCard
                        key={zona.id}
                        zona={zona}
                        parejasDisponibles={parejasDisponibles}
                        parejaLabel={parejaLabel}
                        onChanged={cargarDatos}
                        onDeleted={cargarDatos}
                      />
                    ))}
                  </div>
                </div>
              )}

              {zonas.length === 0 && inscripciones.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Este torneo todavía no tiene parejas inscriptas.
                  </CardContent>
                </Card>
              )}

              <DragOverlay zIndex={1000}>
                {activeItem ? (
                  <div className="flex items-center gap-2 rounded border bg-primary text-primary-foreground px-3 py-2 text-sm shadow-2xl opacity-90 cursor-grabbing pointer-events-none">
                    <GripVertical className="h-4 w-4" />
                    <span className="font-medium">{activeItem.label}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          <TabsContent value="cronograma">
            <CronogramaPartidos
              torneoId={torneoId}
              inscripciones={inscripciones.map((i) => ({
                id: i.id,
                jugador1_id: i.jugador1_id,
                jugador2_id: i.jugador2_id,
              }))}
              jugadorMap={jugadorMap}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
