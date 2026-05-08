import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ZonaCard, type Zona } from "@/components/zonas/ZonaCard";
import { PanelDisponibles } from "@/components/zonas/PanelDisponibles";
import { CronogramaPartidos } from "@/components/zonas/CronogramaPartidos";
import { calcularDistribucionZonas, nombreZona } from "@/lib/zonas";
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
  const [zonaParejasGlobal, setZonaParejasGlobal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!torneoId) return;
    try {
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

  useEffect(() => {
    const start = async () => {
      try {
        const { data: ts } = await supabase
          .from("torneos")
          .select("*")
          .eq("tipo", "oficial")
          .order("fecha_inicio", { ascending: false });
        setTorneos((ts ?? []) as Torneo[]);
        if (ts && ts.length > 0 && !torneoId) {
          setTorneoId(ts[0].id);
        }
      } catch (e: any) {
        setError(e.message || "Error cargando torneos");
      } finally {
        setLoading(false);
      }
    };
    start();
  }, [torneoId]);

  useEffect(() => {
    if (torneoId) cargarDatos();
  }, [torneoId, cargarDatos]);

  const jugadorMap = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);

  const parejaLabel = useCallback((inscripcionId: string): string => {
    const ins = inscripciones.find((i) => i.id === inscripcionId);
    if (!ins) return "—";
    const j1 = jugadorMap.get(ins.jugador1_id);
    const j2 = jugadorMap.get(ins.jugador2_id);
    return `${j1?.apellido || "?"} / ${j2?.apellido || "?"}`;
  }, [inscripciones, jugadorMap]);

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
          <Select value={torneoId} onValueChange={setTorneoId}>
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
               {zonas.length > 0 && (
                 <Button variant="outline" onClick={() => cargarDatos()}>Actualizar</Button>
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
                    onDeleted={cargarDatos}
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
