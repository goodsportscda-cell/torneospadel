import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wand2, CalendarDays, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { generarZonasAuto, type ZonaGenerada, type FranjaData } from "@/lib/GeneradorZonasAuto";
import { generarFixture } from "@/lib/zonas";

type Props = {
  torneoId: string;
  onZonasCreadas: () => void;
  disabled?: boolean;
};

export function GenerarZonasAutoDialog({ torneoId, onZonasCreadas, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [zonasPropuestas, setZonasPropuestas] = useState<ZonaGenerada[]>([]);
  const [franjas, setFranjas] = useState<FranjaData[]>([]);

  const cargarDatosYGenerar = async () => {
    setLoading(true);
    try {
      // 1. Obtener canchas disponibles del torneo
      const { data: torneo } = await supabase.from("torneos").select("canchas_disponibles").eq("id", torneoId).single();
      const canchasDisp = torneo?.canchas_disponibles || 3;

      // 2. Obtener franjas horarias
      const { data: franjasData } = await supabase
        .from("torneo_franjas_horarias")
        .select("*")
        .eq("torneo_id", torneoId);
      
      setFranjas(franjasData || []);

      // 3. Obtener inscripciones confirmadas
      const { data: inscripciones } = await supabase
        .from("inscripciones")
        .select(`
          id,
          jugador1:jugadores!inscripciones_jugador1_id_fkey(nombre, apellido),
          jugador2:jugadores!inscripciones_jugador2_id_fkey(nombre, apellido),
          inscripcion_disponibilidades(franja_id)
        `)
        .eq("torneo_id", torneoId)
        .eq("estado", "confirmada");

      if (!inscripciones || inscripciones.length < 3) {
        toast.error("Se necesitan al menos 3 inscripciones confirmadas para armar zonas.");
        setOpen(false);
        return;
      }

      // 4. Mapear al formato del generador
      const paraGenerador = inscripciones.map((ins: any) => ({
        id: ins.id,
        jugador1: ins.jugador1,
        jugador2: ins.jugador2,
        franjas_ids: ins.inscripcion_disponibilidades?.map((d: any) => d.franja_id) || []
      }));

      // 5. Ejecutar algoritmo
      const propuestas = generarZonasAuto(paraGenerador, franjasData || [], canchasDisp);
      setZonasPropuestas(propuestas);
      
    } catch (e: any) {
      toast.error("Error al preparar zonas: " + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      cargarDatosYGenerar();
    } else {
      setZonasPropuestas([]);
    }
  }, [open, torneoId]);

  const handleUpdateCancha = (idx: number, val: string) => {
    const newZ = [...zonasPropuestas];
    newZ[idx].canchaSugerida = val;
    setZonasPropuestas(newZ);
  };

  const handleConfirmar = async () => {
    setSaving(true);
    const toastId = toast.loading("Guardando zonas...");
    try {
      // Guardar cada zona propuesta
      for (let i = 0; i < zonasPropuestas.length; i++) {
        const zp = zonasPropuestas[i];
        
        // 1. Insertar la zona
        const { data: newZona, error: errZona } = await supabase.from("zonas").insert({
          torneo_id: torneoId,
          nombre: zp.nombre.replace("Zona ", ""), // guardamos solo la letra
          tamanio: zp.parejas.length,
          orden: i,
        }).select("id").single();
        
        if (errZona) throw errZona;
        if (!newZona) continue;

        // 2. Insertar parejas (siembra 1..N)
        const parejasToInsert = zp.parejas.map((p, pIdx) => ({
          zona_id: newZona.id,
          inscripcion_id: p.id,
          posicion_siembra: pIdx + 1
        }));
        
        if (parejasToInsert.length > 0) {
          const { error: errParejas } = await supabase.from("zonas_parejas").insert(parejasToInsert);
          if (errParejas) throw errParejas;
        }

        // 3. Generar partidos e insertar
        const fixture = generarFixture(zp.parejas.length as 3 | 4);
        const partidosToInsert = fixture.map(f => ({
          zona_id: newZona.id,
          orden: f.orden,
          tipo: f.tipo,
          posicion_local: f.posicion_local,
          posicion_visitante: f.posicion_visitante,
          estado: "pendiente",
          cancha: zp.canchaSugerida || null
        }));
        
        const { error: errPartidos } = await supabase.from("partidos_zona").insert(partidosToInsert);
        if (errPartidos) throw errPartidos;
      }

      toast.success("Zonas generadas con éxito", { id: toastId });
      setOpen(false);
      onZonasCreadas();
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message, { id: toastId });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Wand2 className="h-4 w-4 mr-2" />
          Armar Zonas Automáticamente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Previsualización de Zonas</DialogTitle>
          <DialogDescription>
            El sistema intentó agrupar a las parejas según su disponibilidad horaria en común.
            Revisá las zonas propuestas y asigná canchas antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 pr-2 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Procesando algoritmos y calculando cruces...</p>
            </div>
          ) : zonasPropuestas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se pudieron generar zonas (faltan inscripciones).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zonasPropuestas.map((zp, i) => (
                <div key={i} className="border rounded-xl p-4 bg-card shadow-sm flex flex-col h-full relative">
                  <div className="flex items-center justify-between border-b pb-2 mb-3">
                    <h3 className="font-bold text-lg text-emerald-600">{zp.nombre}</h3>
                    <Badge variant="outline" className="text-xs bg-muted/50">
                      {zp.parejas.length} Parejas
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 mb-4 flex-1">
                    {zp.parejas.map((p, pIdx) => (
                      <div key={p.id} className="text-sm bg-muted/30 px-2 py-1.5 rounded flex items-center justify-between">
                        <span className="truncate">{p.jugador1?.apellido || 'N/A'} / {p.jugador2?.apellido || 'N/A'}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto space-y-3 pt-3 border-t">
                    <div className="flex items-start gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold">Horario sugerido</p>
                        <p className="text-xs text-muted-foreground leading-tight">
                          {zp.franjaAsignada ? zp.franjaAsignada.label_franja : "Sin coincidencia horaria exacta"}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Cancha</Label>
                      <Input 
                        className="h-8 text-sm" 
                        value={zp.canchaSugerida || ""} 
                        onChange={(e) => handleUpdateCancha(i, e.target.value)} 
                        placeholder="Ej: Cancha 1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t mt-auto">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading || saving || zonasPropuestas.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar y Guardar Zonas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
