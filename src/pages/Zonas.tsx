import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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
import { ZonaCard, type Zona } from "@/components/zonas/ZonaCard";
import { PanelDisponibles } from "@/components/zonas/PanelDisponibles";
import { CronogramaPartidos } from "@/components/zonas/CronogramaPartidos";
import { calcularDistribucionZonas, nombreZona } from "@/lib/zonas";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Inscripcion = Database["public"]["Tables"]["inscripciones"]["Row"];
type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];

export default function Zonas() {
  const { clubId } = useAuth();
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [torneoId, setTorneoId] = useState<string>(() => {
    return localStorage.getItem("ultimo_torneo_consultado") || "";
  });
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaParejasGlobal, setZonaParejasGlobal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!torneoId) return;
    try {
      const [{ data: ins }, { data: jugs }, { data: zs }] = await Promise.all([
        supabase.from("inscripciones").select("*").eq("torneo_id", torneoId).eq("estado", "confirmada"),
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
          .select("*")
          .in("zona_id", ids);
        setZonaParejasGlobal(zp ?? []);
      } else {
        setZonaParejasGlobal([]);
      }
    } catch (e: any) {
      console.error("Error loading data:", e);
      setError(e.message || "Error cargando datos");
    }
  }, [torneoId]);

  const handleBorrarZona = async (id: string) => {
    const toastId = toast.loading("Eliminando zona...");
    try {
      // 1. Delete sets
      const { data: parts } = await supabase.from("partidos_zona").select("id").eq("zona_id", id);
      if (parts && parts.length > 0) {
        await supabase.from("sets_partido").delete().in("partido_id", parts.map(p => p.id));
      }
      // 2. Delete matches
      await supabase.from("partidos_zona").delete().eq("zona_id", id);
      // 3. Delete pairings
      await supabase.from("zonas_parejas").delete().eq("zona_id", id);
      // 4. Delete zone
      const { error } = await supabase.from("zonas").delete().eq("id", id);
      
      if (error) throw error;
      toast.success("Zona eliminada", { id: toastId });
      cargarDatos();
    } catch (e: any) {
      toast.error("Error al eliminar zona: " + e.message, { id: toastId });
    }
  };

  const handleUpdateZona = async (id: string, updates: Partial<Zona>) => {
    const toastId = toast.loading("Actualizando zona...");
    try {
      // Si cambia el tamaño, borramos los partidos para forzar regeneración
      if (updates.tamanio !== undefined) {
        const { data: currentZona } = await supabase.from("zonas").select("tamanio").eq("id", id).maybeSingle();
        if (currentZona && currentZona.tamanio !== updates.tamanio) {
          const { data: parts } = await supabase.from("partidos_zona").select("id").eq("zona_id", id);
          if (parts && parts.length > 0) {
            const pIds = parts.map(p => p.id);
            await supabase.from("sets_partido").delete().in("partido_id", pIds);
            await supabase.from("partidos_zona").delete().in("id", pIds);
          }
        }
      }

      const { error } = await supabase.from("zonas").update(updates).eq("id", id);
      if (error) throw error;
      toast.success("Zona actualizada", { id: toastId });
      cargarDatos();
    } catch (e: any) {
      toast.error("Error al actualizar: " + e.message, { id: toastId });
    }
  };

  const handleAddZona = async () => {
    if (!torneoId) return;
    try {
      const nuevoOrden = zonas.length > 0 ? Math.max(...zonas.map(z => z.orden)) + 1 : 0;
      const { error } = await supabase.from("zonas").insert({
        torneo_id: torneoId,
        nombre: nombreZona(zonas.length),
        tamanio: 3,
        orden: nuevoOrden,
      });
      if (error) throw error;
      toast.success("Zona añadida");
      cargarDatos();
    } catch (e: any) {
      toast.error("Error al añadir zona: " + e.message);
    }
  };

  const handleBorrarTodo = async () => {
    if (!torneoId) return;
    const toastId = toast.loading("Borrando todos los datos...");
    setLoading(true);
    try {
      const { data: zs } = await supabase.from("zonas").select("id").eq("torneo_id", torneoId);
      if (zs && zs.length > 0) {
        const ids = zs.map(z => z.id);
        
        // 1. Delete sets
        const { data: parts } = await supabase.from("partidos_zona").select("id").in("zona_id", ids);
        if (parts && parts.length > 0) {
          await supabase.from("sets_partido").delete().in("partido_id", parts.map(p => p.id));
        }
        
        // 2. Delete matches
        await supabase.from("partidos_zona").delete().in("zona_id", ids);
        
        // 3. Delete pairings
        await supabase.from("zonas_parejas").delete().in("zona_id", ids);
        
        // 4. Delete zones
        await supabase.from("zonas").delete().eq("torneo_id", torneoId);
      }
      
      toast.success("Datos de zonas eliminados", { id: toastId });
      cargarDatos();
    } catch (e: any) {
      toast.error("Error al borrar datos: " + e.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarZonas = async () => {
    if (!torneoId) return;
    const toastId = toast.loading("Generando zonas...");
    const { data: ins } = await supabase
      .from("inscripciones")
      .select("*")
      .eq("torneo_id", torneoId)
      .eq("estado", "confirmada");

    if (!ins || ins.length === 0) {
      toast.error("No hay inscripciones confirmadas para este torneo", { id: toastId });
      return;
    }

    if (zonas.length > 0) {
      toast.error("Ya existen zonas. Borralas primero.", { id: toastId });
      return;
    }

    const distribucion = calcularDistribucionZonas(ins.length);
    if (distribucion.length === 0) {
      toast.error("Mínimo 3 parejas para armar zonas", { id: toastId });
      return;
    }

    setLoading(true);
    try {
      const inserts = distribucion.map((tamanio, i) => ({
        torneo_id: torneoId,
        nombre: nombreZona(i),
        tamanio,
        orden: i,
      }));

      const { error } = await supabase.from("zonas").insert(inserts);
      if (error) throw error;
      
      toast.success("Zonas generadas!", { id: toastId });
      cargarDatos();
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const start = async () => {
      try {
        let tQuery = supabase
          .from("torneos")
          .select("*")
          .eq("tipo", "oficial")
          .order("fecha_inicio", { ascending: false });
        if (clubId) {
          tQuery = tQuery.eq("club_id", clubId);
        }
        const { data: ts } = await tQuery;
        setTorneos((ts ?? []) as Torneo[]);
        
        const savedId = localStorage.getItem("ultimo_torneo_consultado");
        const exists = ts?.some((t) => t.id === savedId);
        if (exists && savedId) {
          setTorneoId(savedId);
        } else if (ts && ts.length > 0) {
          setTorneoId(ts[0].id);
          localStorage.setItem("ultimo_torneo_consultado", ts[0].id);
        }
      } catch (e: any) {
        setError(e.message || "Error cargando torneos");
      } finally {
        setLoading(false);
      }
    };
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (torneoId) cargarDatos();
  }, [torneoId, cargarDatos]);

  const jugadorMap = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);

  const torneoNombre = useMemo(() => {
    const t = torneos.find(x => x.id === torneoId);
    return t?.nombre || "";
  }, [torneos, torneoId]);

  const parejaLabel = useCallback((inscripcionId: string): string => {
    const ins = inscripciones.find((i) => i.id === inscripcionId);
    if (!ins) return "—";
    const j1 = jugadorMap.get(ins.jugador1_id);
    const j2 = jugadorMap.get(ins.jugador2_id);
    return `${j1?.apellido || "?"} / ${j2?.apellido || "?"}`;
  }, [inscripciones, jugadorMap]);

  const parejaDisponibilidad = useCallback((inscripcionId: string): string | null => {
    const ins = inscripciones.find((i) => i.id === inscripcionId);
    return ins?.disponibilidad_horaria || null;
  }, [inscripciones]);

  const todasLasParejas = useMemo(
    () =>
      inscripciones.map((ins) => ({
        inscripcion_id: ins.id,
        label: parejaLabel(ins.id),
      })),
    [inscripciones, parejaLabel]
  );

  const idsAsignados = useMemo(
    () => new Set(zonaParejasGlobal.map((zp) => zp.inscripcion_id)),
    [zonaParejasGlobal]
  );

  const parejasDisponibles = useMemo(
    () => todasLasParejas.filter((p) => !idsAsignados.has(p.inscripcion_id)),
    [todasLasParejas, idsAsignados]
  );

  if (loading) return <div className="p-8">Cargando...</div>;
  if (error) return <div className="p-8 text-destructive">Error: {error}</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Zonas</h1>
      
      <Card>
        <CardContent className="p-4">
          <Select value={torneoId} onValueChange={(val) => {
            setTorneoId(val);
            localStorage.setItem("ultimo_torneo_consultado", val);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccioná un torneo" />
            </SelectTrigger>
            <SelectContent>
              {torneos.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {torneoId && (
        <Tabs defaultValue="zonas">
          <TabsList>
            <TabsTrigger value="zonas">Zonas</TabsTrigger>
            <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          </TabsList>
          
          <TabsContent value="zonas" className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const id = toast.loading("Actualizando...");
                cargarDatos().then(() => toast.success("Datos actualizados", { id }));
              }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>

              <Button variant="secondary" size="sm" onClick={handleAddZona}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir Zona
              </Button>

              {zonas.length === 0 ? (
                <Button size="sm" onClick={handleGenerarZonas}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generar Automáticamente
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Borrar Todo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Borrar todas las zonas?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Eliminará todas las zonas, partidos y resultados. No se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBorrarTodo} className="bg-destructive text-destructive-foreground">
                        Confirmar Borrado
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
              <PanelDisponibles parejas={parejasDisponibles} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {zonas.map((z) => (
                  <ZonaCard
                    key={z.id}
                    zona={z}
                    parejasDisponibles={parejasDisponibles}
                    parejaLabel={parejaLabel}
                    onChanged={cargarDatos}
                    onDeleted={() => handleBorrarZona(z.id)}
                    onUpdate={(updates) => handleUpdateZona(z.id, updates)}
                    torneoNombre={torneoNombre}
                    todasLasZonas={zonas}
                    parejaDisponibilidad={parejaDisponibilidad}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cronograma">
            <CronogramaPartidos
              torneoId={torneoId}
              inscripciones={inscripciones}
              jugadorMap={jugadorMap}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
