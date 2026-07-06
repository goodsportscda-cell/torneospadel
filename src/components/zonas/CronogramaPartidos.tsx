import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CalendarClock, MapPin, Trophy, Edit2, Wand2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  torneoId: string;
  inscripciones: { id: string; jugador1_id: string; jugador2_id: string; disponibilidad_horaria?: string | null }[];
  jugadorMap: Map<string, { apellido: string; nombre: string }>;
};

type PartidoZona = {
  id: string;
  zona_id: string;
  orden: number;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  estado: string;
  ganador_id: string | null;
  fecha_hora: string | null;
  cancha: string | null;
};

type ZonaInfo = { id: string; nombre: string };

export function CronogramaPartidos({ torneoId, inscripciones, jugadorMap }: Props) {
  const [partidos, setPartidos] = useState<PartidoZona[]>([]);
  const [zonas, setZonas] = useState<ZonaInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: zs } = await supabase
      .from("zonas")
      .select("id, nombre")
      .eq("torneo_id", torneoId);

    setZonas((zs ?? []) as ZonaInfo[]);

    if (zs && zs.length > 0) {
      const ids = zs.map((z) => z.id);
      const { data: parts } = await supabase
        .from("partidos_zona")
        .select("id, zona_id, orden, pareja_local_id, pareja_visitante_id, estado, ganador_id, fecha_hora, cancha")
        .in("zona_id", ids)
        .order("fecha_hora", { ascending: true, nullsFirst: false });
      setPartidos((parts ?? []) as PartidoZona[]);
    } else {
      setPartidos([]);
    }
    setLoading(false);
  }, [torneoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [partidoEnEdicion, setPartidoEnEdicion] = useState<PartidoZona | null>(null);
  const [editForm, setEditForm] = useState({ fecha: "", hora: "", cancha: "" });

  const handleEditClick = (p: PartidoZona) => {
    setPartidoEnEdicion(p);
    let fecha = "";
    let hora = "";
    if (p.fecha_hora) {
      const parts = p.fecha_hora.split("T");
      fecha = parts[0] || "";
      hora = parts[1] ? parts[1].substring(0, 5) : "";
    }
    setEditForm({ fecha, hora, cancha: p.cancha || "" });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!partidoEnEdicion) return;
    const toastId = toast.loading("Guardando...");
    let fecha_hora = null;
    if (editForm.fecha && editForm.hora) {
      fecha_hora = `${editForm.fecha}T${editForm.hora}:00`;
    }

    try {
      const { error } = await supabase
        .from("partidos_zona")
        .update({ fecha_hora, cancha: editForm.cancha || null })
        .eq("id", partidoEnEdicion.id);
      
      if (error) throw error;
      toast.success("Horario actualizado", { id: toastId });
      setEditDialogOpen(false);
      cargar();
    } catch (e: any) {
      toast.error("Error al actualizar: " + e.message, { id: toastId });
    }
  };

  const handleGenerarHorarios = async () => {
    const sinHorario = partidos.filter(p => !p.fecha_hora);
    if (sinHorario.length === 0) {
      toast.info("No hay partidos sin horario programado.");
      return;
    }

    const toastId = toast.loading("Asignando horarios inteligentemente...");
    try {
      const getDisp = (insId: string | null) => {
        if (!insId) return "";
        const ins = inscripciones.find(i => i.id === insId);
        return (ins?.disponibilidad_horaria || "").toLowerCase();
      };

      let assignedCount = 0;
      
      const today = new Date();
      const getNextDay = (dayIndex: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() + ((dayIndex + 7 - d.getDay()) % 7 || 7));
        return d;
      };
      
      const nextFri = getNextDay(5).toISOString().split("T")[0];
      const nextSat = getNextDay(6).toISOString().split("T")[0];
      const nextSun = getNextDay(0).toISOString().split("T")[0];

      let baseHourSat = 9;
      let baseHourSun = 9;

      for (const p of sinHorario) {
        if (!p.pareja_local_id || !p.pareja_visitante_id) continue;
        const d1 = getDisp(p.pareja_local_id);
        const d2 = getDisp(p.pareja_visitante_id);

        let date = nextSat;
        let hour = `${baseHourSat.toString().padStart(2, '0')}:00:00`;
        
        if (d1.includes("domingo") || d2.includes("domingo")) {
          date = nextSun;
          hour = `${baseHourSun.toString().padStart(2, '0')}:00:00`;
          baseHourSun++;
        } else if (d1.includes("viernes") || d2.includes("viernes")) {
          date = nextFri;
          hour = "19:00:00"; 
        } else {
          baseHourSat++; 
        }

        const fecha_hora = `${date}T${hour}`;
        
        await supabase.from("partidos_zona").update({ fecha_hora }).eq("id", p.id);
        assignedCount++;
      }

      toast.success(`Se pre-asignaron horarios a ${assignedCount} partidos`, { id: toastId });
      cargar();
    } catch (e: any) {
      toast.error("Error al asignar: " + e.message, { id: toastId });
    }
  };

  const zonaMap = useMemo(() => new Map(zonas.map((z) => [z.id, z.nombre])), [zonas]);

  const parejaLabel = (inscripcionId: string | null): string => {
    if (!inscripcionId) return "— por definir —";
    const ins = inscripciones.find((i) => i.id === inscripcionId);
    if (!ins) return "—";
    const j1 = jugadorMap.get(ins.jugador1_id);
    const j2 = jugadorMap.get(ins.jugador2_id);
    return `${j1?.apellido ?? "?"} / ${j2?.apellido ?? "?"}`;
  };

  // Only show matches with fecha_hora
  const programados = useMemo(
    () => partidos.filter((p) => p.fecha_hora),
    [partidos],
  );

  // Group by day
  const porDia = useMemo(() => {
    const map = new Map<string, PartidoZona[]>();
    programados.forEach((p) => {
      const day = new Date(p.fecha_hora!).toLocaleDateString("es-AR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(p);
    });
    return map;
  }, [programados]);

  const sinProgramar = useMemo(
    () => partidos.filter((p) => !p.fecha_hora),
    [partidos],
  );

  const estadoBadge = (e: string) => {
    switch (e) {
      case "finalizado": return { variant: "default" as const, label: "Finalizado" };
      case "en_juego": return { variant: "destructive" as const, label: "En juego" };
      case "programado": return { variant: "secondary" as const, label: "Programado" };
      default: return { variant: "outline" as const, label: "Pendiente" };
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando cronograma...</p>;

  if (partidos.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No hay partidos de zona para este torneo.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Horarios de Zonas</h3>
        <Button size="sm" variant="secondary" onClick={handleGenerarHorarios}>
          <Wand2 className="w-4 h-4 mr-2" />
          Borrador Inteligente
        </Button>
      </div>

      {programados.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Ningún partido tiene fecha/hora asignada todavía.
          </CardContent>
        </Card>
      )}

      {Array.from(porDia.entries()).map(([dia, partsDia]) => {
        // Sort by hora first, then cancha
        const sorted = [...partsDia].sort((a, b) => {
          const diff = new Date(a.fecha_hora!).getTime() - new Date(b.fecha_hora!).getTime();
          if (diff !== 0) return diff;
          return (a.cancha ?? "").localeCompare(b.cancha ?? "");
        });

        return (
          <div key={dia} className="space-y-3">
            <h3 className="text-sm font-semibold capitalize border-b pb-1">{dia}</h3>
            <div className="space-y-1.5">
              {sorted.map((p) => {
                const hora = new Date(p.fecha_hora!).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const eb = estadoBadge(p.estado);
                return (
                  <Card key={p.id} className="border">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="text-sm font-mono font-semibold w-12 shrink-0 text-center">
                        {hora}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className={`text-sm truncate ${p.ganador_id === p.pareja_local_id && p.ganador_id ? "font-semibold text-primary" : ""}`}>
                          {p.ganador_id === p.pareja_local_id && p.ganador_id && <Trophy className="h-3 w-3 inline mr-1" />}
                          {parejaLabel(p.pareja_local_id)}
                        </div>
                        <div className={`text-sm truncate ${p.ganador_id === p.pareja_visitante_id && p.ganador_id ? "font-semibold text-primary" : ""}`}>
                          {p.ganador_id === p.pareja_visitante_id && p.ganador_id && <Trophy className="h-3 w-3 inline mr-1" />}
                          {parejaLabel(p.pareja_visitante_id)}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {p.cancha && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {p.cancha}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          Zona {zonaMap.get(p.zona_id) ?? "?"}
                        </Badge>
                        {p.estado !== "pendiente" && (
                          <Badge variant={eb.variant} className="text-[10px]">
                            {eb.label}
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary mt-1" onClick={() => handleEditClick(p)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {sinProgramar.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">
            <CalendarClock className="h-4 w-4 inline mr-1" />
            Sin programar ({sinProgramar.length})
          </h3>
          <div className="space-y-1.5 pl-2">
            {sinProgramar.map((p) => (
              <Card key={p.id} className="border border-dashed">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="text-xs text-muted-foreground w-12 shrink-0 text-center">--:--</div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-sm truncate">{parejaLabel(p.pareja_local_id)}</div>
                    <div className="text-sm truncate">{parejaLabel(p.pareja_visitante_id)}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      Zona {zonaMap.get(p.zona_id) ?? "?"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary mt-1" onClick={() => handleEditClick(p)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* Dialog for editing match schedule */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Horario y Cancha</DialogTitle>
            <DialogDescription>
              Ajusta la programación para este partido de zona.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Fecha</Label>
              <Input
                type="date"
                value={editForm.fecha}
                onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Hora</Label>
              <Input
                type="time"
                value={editForm.hora}
                onChange={(e) => setEditForm({ ...editForm, hora: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Cancha / Info Extra</Label>
              <Input
                type="text"
                value={editForm.cancha}
                onChange={(e) => setEditForm({ ...editForm, cancha: e.target.value })}
                className="h-9 text-xs"
                placeholder="Ej. Cancha 1: Élite"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
