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
import { toast } from "sonner";
import { Wand2, CalendarDays, Loader2, Calendar, Clock, MapPin, ArrowRightLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { generarZonasAuto, type ZonaGenerada, type FranjaData } from "@/lib/GeneradorZonasAuto";
import { generarFixture } from "@/lib/zonas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  torneoId: string;
  onZonasCreadas: () => void;
  disabled?: boolean;
};

export type ZonaDraft = {
  nombre: string;
  parejas: any[];
  franjaAsignada?: FranjaData;
  canchaSugerida?: string;
  fecha?: string;
  hora?: string;
};

export function GenerarZonasAutoDialog({ torneoId, onZonasCreadas, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [zonasPropuestas, setZonasPropuestas] = useState<ZonaDraft[]>([]);
  const [franjas, setFranjas] = useState<FranjaData[]>([]);

  const cargarDatosYGenerar = async () => {
    setLoading(true);
    try {
      // 1. Obtener canchas disponibles del torneo
      const { data: torneo } = await (supabase as any).from("torneos").select("canchas_disponibles").eq("id", torneoId).single();
      const canchasDisp = (torneo as any)?.canchas_disponibles || 3;

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
      
      // Adaptar borrador editable
      const draft: ZonaDraft[] = propuestas.map((p) => ({
        ...p,
        nombre: p.nombre.replace(/^Zona\s+/i, ""),
        canchaSugerida: p.canchaSugerida || "1",
        fecha: "",
        hora: p.franjaAsignada ? p.franjaAsignada.hora_inicio.substring(0, 5) : ""
      }));

      setZonasPropuestas(draft);
      
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

  const handleUpdateNombre = (idx: number, val: string) => {
    const newZ = [...zonasPropuestas];
    newZ[idx].nombre = val;
    setZonasPropuestas(newZ);
  };

  const handleUpdateCancha = (idx: number, val: string) => {
    const newZ = [...zonasPropuestas];
    newZ[idx].canchaSugerida = val;
    setZonasPropuestas(newZ);
  };

  const handleUpdateFecha = (idx: number, val: string) => {
    const newZ = [...zonasPropuestas];
    newZ[idx].fecha = val;
    setZonasPropuestas(newZ);
  };

  const handleUpdateHora = (idx: number, val: string) => {
    const newZ = [...zonasPropuestas];
    newZ[idx].hora = val;
    setZonasPropuestas(newZ);
  };

  const handleMoverPareja = (fromZoneIdx: number, pIdx: number, toZoneIdx: number) => {
    if (fromZoneIdx === toZoneIdx) return;
    const newZ = [...zonasPropuestas];
    const [parejaMovida] = newZ[fromZoneIdx].parejas.splice(pIdx, 1);
    newZ[toZoneIdx].parejas.push(parejaMovida);
    setZonasPropuestas(newZ);
  };

  const handleConfirmar = async () => {
    setSaving(true);
    const toastId = toast.loading("Guardando zonas y programación...");
    try {
      // Guardar cada zona propuesta
      for (let i = 0; i < zonasPropuestas.length; i++) {
        const zp = zonasPropuestas[i];
        if (zp.parejas.length === 0) continue;
        
        const nombreLimpio = zp.nombre.trim().replace(/^Zona\s+/i, "") || String.fromCharCode(65 + i);

        // 1. Insertar la zona
        const { data: newZona, error: errZona } = await (supabase as any).from("zonas").insert({
          torneo_id: torneoId,
          nombre: nombreLimpio,
          tamanio: zp.parejas.length,
          orden: i,
        }).select("id").single();
        
        if (errZona) throw errZona;
        if (!newZona) continue;

        // 2. Insertar parejas (siembra 1..N)
        const parejasToInsert = zp.parejas.map((p, pIdx) => ({
          zona_id: (newZona as any).id,
          inscripcion_id: p.id,
          posicion_siembra: pIdx + 1
        }));
        
        if (parejasToInsert.length > 0) {
          const { error: errParejas } = await (supabase as any).from("zonas_parejas").insert(parejasToInsert);
          if (errParejas) throw errParejas;
        }

        // 3. Generar partidos e insertar con cancha y fecha_hora
        const fixture = generarFixture(zp.parejas.length as 3 | 4);

        let fechaHoraCombo: string | null = null;
        if (zp.fecha && zp.hora) {
          fechaHoraCombo = `${zp.fecha}T${zp.hora}:00`;
        } else if (zp.fecha) {
          fechaHoraCombo = `${zp.fecha}T00:00:00`;
        }

        const canchaText = zp.canchaSugerida 
          ? (zp.canchaSugerida.toLowerCase().startsWith("cancha") ? zp.canchaSugerida : `Cancha ${zp.canchaSugerida}`)
          : null;

        const partidosToInsert = fixture.map(f => ({
          zona_id: (newZona as any).id,
          orden: f.orden,
          tipo: f.tipo,
          posicion_local: f.posicion_local,
          posicion_visitante: f.posicion_visitante,
          estado: "pendiente",
          cancha: canchaText,
          fecha_hora: fechaHoraCombo
        }));
        
        const { error: errPartidos } = await (supabase as any).from("partidos_zona").insert(partidosToInsert);
        if (errPartidos) throw errPartidos;
      }

      toast.success("Zonas y programación guardadas con éxito", { id: toastId });
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
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Previsualización y Borrador de Zonas</DialogTitle>
          <DialogDescription>
            Revisá la agrupación automática. Podés editar la letra de la zona, cambiar parejas de zona, asignar fecha, horario y cancha antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 pr-2 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-emerald-600" />
              <p>Procesando algoritmos y calculando cruces por horario...</p>
            </div>
          ) : zonasPropuestas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se pudieron generar zonas (faltan inscripciones confirmadas).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zonasPropuestas.map((zp, i) => (
                <div key={i} className="border rounded-xl p-4 bg-card shadow-sm flex flex-col h-full space-y-3">
                  {/* Encabezado editable de la Zona */}
                  <div className="flex items-center justify-between border-b pb-2 gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="font-bold text-sm text-emerald-600 shrink-0">Zona</span>
                      <Input
                        className="h-8 w-16 font-extrabold text-base text-emerald-600 bg-background"
                        value={zp.nombre}
                        onChange={(e) => handleUpdateNombre(i, e.target.value)}
                        placeholder="A"
                      />
                    </div>
                    <Badge variant="outline" className="text-xs bg-muted/50 shrink-0">
                      {zp.parejas.length} Parejas
                    </Badge>
                  </div>
                  
                  {/* Lista de parejas con opción de cambiar de zona */}
                  <div className="space-y-1.5 flex-1 min-h-[100px]">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Parejas</Label>
                    {zp.parejas.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic py-3 text-center border border-dashed rounded">
                        Zona vacía (arrastrá o mové una pareja aquí)
                      </div>
                    ) : (
                      zp.parejas.map((p, pIdx) => (
                        <div key={p.id} className="text-xs bg-muted/40 p-2 rounded border flex flex-col gap-1.5">
                          <div className="font-medium truncate flex items-center justify-between">
                            <span className="truncate">
                              {p.jugador1?.apellido || 'N/A'} / {p.jugador2?.apellido || 'N/A'}
                            </span>
                          </div>

                          {/* Mover a otra zona */}
                          {zonasPropuestas.length > 1 && (
                            <div className="flex items-center justify-end gap-1 text-[10px]">
                              <span className="text-muted-foreground">Mover a:</span>
                              <Select
                                onValueChange={(toIdxStr) => handleMoverPareja(i, pIdx, parseInt(toIdxStr))}
                              >
                                <SelectTrigger className="h-6 text-[10px] px-2 w-[85px] bg-background">
                                  <SelectValue placeholder="Zona..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {zonasPropuestas.map((targetZ, targetIdx) => (
                                    targetIdx !== i && (
                                      <SelectItem key={targetIdx} value={targetIdx.toString()} className="text-xs">
                                        Zona {targetZ.nombre || String.fromCharCode(65 + targetIdx)}
                                      </SelectItem>
                                    )
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Programación: Fecha, Hora, Cancha */}
                  <div className="mt-auto space-y-2.5 pt-3 border-t bg-muted/20 p-2.5 rounded-lg border">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-emerald-600" /> Programación
                      </span>
                      {zp.franjaAsignada && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={zp.franjaAsignada.label_franja}>
                          {zp.franjaAsignada.label_franja}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Fecha</Label>
                        <Input
                          type="date"
                          className="h-7 text-xs px-1.5 bg-background"
                          value={zp.fecha || ""}
                          onChange={(e) => handleUpdateFecha(i, e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Horario</Label>
                        <Input
                          type="time"
                          className="h-7 text-xs px-1.5 bg-background"
                          value={zp.hora || ""}
                          onChange={(e) => handleUpdateHora(i, e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground">Cancha</Label>
                      <Input 
                        className="h-7 text-xs bg-background" 
                        value={zp.canchaSugerida || ""} 
                        onChange={(e) => handleUpdateCancha(i, e.target.value)} 
                        placeholder="Ej: 1 o Cancha 1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t mt-auto">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading || saving || zonasPropuestas.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar y Guardar Zonas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

