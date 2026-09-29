import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, CalendarClock, MapPin, ExternalLink, CheckCircle2, Clock, Trophy, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
const PAGO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
};

const PAGO_BADGE: Record<string, string> = {
  pendiente: "bg-destructive text-destructive-foreground",
  parcial: "bg-secondary text-secondary-foreground",
  pagado: "bg-primary text-primary-foreground",
};

const ESTADO_INSC_LABELS: Record<string, string> = {
  pendiente_confirmacion: "Por confirmar",
  confirmada: "Confirmada",
  lista_espera: "Lista de espera",
  cancelada: "Cancelada",
};

const ESTADO_INSC_BADGE: Record<string, string> = {
  pendiente_confirmacion: "bg-secondary text-secondary-foreground border-border",
  confirmada: "bg-primary/15 text-primary border-primary/30",
  lista_espera: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-destructive/15 text-destructive border-destructive/30",
};

type Props = {
  jugadorId: string;
};

type PartidoProgramado = {
  id: string;
  faseNombre: string;
  fecha_hora: string;
  cancha: string | null;
  torneo_nombre: string;
};

type MiInscripcion = {
  id: string;
  torneo_id: string;
  torneo_nombre: string;
  tipo_torneo?: string;
  modalidad?: string;
  estado: string;
  estado_pago: string;
  companero_nombre: string;
  disponibilidad_horaria: string;
  franjas: { id: string; label: string; seleccionada: boolean }[];
  torneo_estado: string;
  torneo_fecha_inicio: string | null;
  partidos: PartidoProgramado[];
};

const fechaHoyArgentina = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

export function PlayerInscriptions({ jugadorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [inscripciones, setInscripciones] = useState<MiInscripcion[]>([]);
  const [editing, setEditing] = useState<MiInscripcion | null>(null);
  const [availabilityText, setAvailabilityText] = useState("");
  const [selectedFranjas, setSelectedFranjas] = useState<string[]>([]);
  const [savingAvailability, setSavingAvailability] = useState(false);

  useEffect(() => {
    if (!jugadorId) return;

    const cargar = async () => {
      setLoading(true);
      try {
        // 1. Obtener torneos activos/próximos
        const { data: torneosActivos } = await supabase
          .from("torneos")
          .select("id, nombre, tipo, modalidad, estado, fecha_fin, fecha_inicio")
          .in("estado", ["proximamente", "inscripciones_abiertas", "inscripciones_cerradas", "en_curso"]);
        
        if (!torneosActivos || torneosActivos.length === 0) {
          setInscripciones([]);
          setLoading(false);
          return;
        }

        const tMap = new Map(torneosActivos.map(t => [t.id, t]));
        const tIds = Array.from(tMap.keys());

        const allItems: MiInscripcion[] = [];

        // 2. Obtener inscripciones tradicionales en torneos oficiales/abiertos
        const { data: misInsc } = await supabase
          .from("inscripciones")
          .select("id, torneo_id, jugador1_id, jugador2_id, estado")
          .in("torneo_id", tIds)
          .or(`jugador1_id.eq.${jugadorId},jugador2_id.eq.${jugadorId}`);

        if (misInsc && misInsc.length > 0) {
          const { data: disponibilidades, error: disponibilidadError } = await (supabase as any)
            .rpc("get_my_inscription_availability", { p_jugador_id: jugadorId });
          if (disponibilidadError) throw disponibilidadError;
          const disponibilidadMap = new Map<string, { texto: string; franjas: { id: string; label: string; seleccionada: boolean }[] }>(
            (disponibilidades ?? []).map((row: any) => [row.inscripcion_id, {
              texto: row.disponibilidad_horaria ?? "",
              franjas: row.franjas ?? [],
            }]),
          );
          const { data: pagosPropios } = await (supabase as any).rpc(
            "get_my_inscription_payment_status",
            { p_jugador_id: jugadorId },
          );
          const pagoMap = new Map<string, string>(
            (pagosPropios ?? []).map((p: { inscripcion_id: string; estado_pago: string }) => [p.inscripcion_id, p.estado_pago]),
          );
          const compaIds = new Set<string>();
          misInsc.forEach(i => {
            compaIds.add(i.jugador1_id === jugadorId ? i.jugador2_id : i.jugador1_id);
          });

          const { data: jugs } = await supabase
            .from("jugadores_publicos" as any)
            .select("id, nombre, apellido")
            .in("id", Array.from(compaIds));
            
          const jugMap = new Map((jugs ?? []).map(j => [j.id, `${j.nombre} ${j.apellido}`]));

          const inscIds = misInsc.map(i => i.id);
          
          const { data: pz1 } = await supabase.from("partidos_zona").select("id, zona_id, fecha_hora, cancha").in("pareja_local_id", inscIds).in("estado", ["pendiente", "programado"]).not("fecha_hora", "is", null);
          const { data: pz2 } = await supabase.from("partidos_zona").select("id, zona_id, fecha_hora, cancha").in("pareja_visitante_id", inscIds).in("estado", ["pendiente", "programado"]).not("fecha_hora", "is", null);
          
          const { data: pl1 } = await supabase.from("partidos_llave").select("id, llave_id, ronda, fecha_hora, cancha").in("pareja_local_id", inscIds).in("estado", ["pendiente", "programado"]).not("fecha_hora", "is", null);
          const { data: pl2 } = await supabase.from("partidos_llave").select("id, llave_id, ronda, fecha_hora, cancha").in("pareja_visitante_id", inscIds).in("estado", ["pendiente", "programado"]).not("fecha_hora", "is", null);

          const zonasIds = [...new Set([...(pz1 ?? []), ...(pz2 ?? [])].map(p => p.zona_id))];
          const { data: zonas } = await supabase.from("zonas").select("id, nombre, torneo_id").in("id", zonasIds);
          const zMap = new Map((zonas ?? []).map(z => [z.id, { nombre: z.nombre, torneoId: z.torneo_id }]));

          const llavesIds = [...new Set([...(pl1 ?? []), ...(pl2 ?? [])].map(p => p.llave_id))];
          const { data: llaves } = await supabase.from("llaves").select("id, torneo_id").in("id", llavesIds);
          const llMap = new Map((llaves ?? []).map(ll => [ll.id, ll.torneo_id]));

          const partidosProgramados: (PartidoProgramado & { insc_id: string })[] = [];

          [...(pz1 ?? [])].forEach(p => {
            const zInfo = zMap.get(p.zona_id);
            if (zInfo) partidosProgramados.push({ id: p.id, faseNombre: zInfo.nombre, fecha_hora: p.fecha_hora!, cancha: p.cancha, torneo_nombre: tMap.get(zInfo.torneoId)?.nombre ?? "", insc_id: misInsc.find(i => i.id === p.pareja_local_id)?.id ?? "" });
          });
          [...(pz2 ?? [])].forEach(p => {
            const zInfo = zMap.get(p.zona_id);
            if (zInfo) partidosProgramados.push({ id: p.id, faseNombre: zInfo.nombre, fecha_hora: p.fecha_hora!, cancha: p.cancha, torneo_nombre: tMap.get(zInfo.torneoId)?.nombre ?? "", insc_id: misInsc.find(i => i.id === p.pareja_visitante_id)?.id ?? "" });
          });
          [...(pl1 ?? [])].forEach(p => {
            const tId = llMap.get(p.llave_id);
            if (tId) partidosProgramados.push({ id: p.id, faseNombre: p.ronda, fecha_hora: p.fecha_hora!, cancha: p.cancha, torneo_nombre: tMap.get(tId)?.nombre ?? "", insc_id: misInsc.find(i => i.id === p.pareja_local_id)?.id ?? "" });
          });
          [...(pl2 ?? [])].forEach(p => {
            const tId = llMap.get(p.llave_id);
            if (tId) partidosProgramados.push({ id: p.id, faseNombre: p.ronda, fecha_hora: p.fecha_hora!, cancha: p.cancha, torneo_nombre: tMap.get(tId)?.nombre ?? "", insc_id: misInsc.find(i => i.id === p.pareja_visitante_id)?.id ?? "" });
          });

          misInsc.forEach(i => {
            const tInfo = tMap.get(i.torneo_id);
            allItems.push({
              id: i.id,
              torneo_id: i.torneo_id,
              torneo_nombre: tInfo?.nombre ?? "?",
              tipo_torneo: tInfo?.tipo ?? "oficial",
              estado: i.estado,
              estado_pago: pagoMap.get(i.id) ?? "pendiente",
              companero_nombre: jugMap.get(i.jugador1_id === jugadorId ? i.jugador2_id : i.jugador1_id) ?? "?",
              disponibilidad_horaria: disponibilidadMap.get(i.id)?.texto ?? "",
              franjas: disponibilidadMap.get(i.id)?.franjas ?? [],
              torneo_estado: tInfo?.estado ?? "",
              torneo_fecha_inicio: tInfo?.fecha_inicio ?? null,
              partidos: partidosProgramados.filter(p => p.insc_id === i.id).sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
            });
          });
        }

        // 3. Obtener participaciones en Desafíos Semanales / Torneos Individuales
        const { data: misSemanalesInd } = await (supabase as any)
          .from("torneo_individual_jugadores")
          .select("id, torneo_id, estado")
          .eq("jugador_id", jugadorId)
          .in("torneo_id", tIds);

        (misSemanalesInd ?? []).forEach((s: any) => {
          const tInfo = tMap.get(s.torneo_id);
          if (tInfo && !allItems.some(item => item.torneo_id === s.torneo_id)) {
            allItems.push({
              id: s.id,
              torneo_id: s.torneo_id,
              torneo_nombre: tInfo.nombre,
              tipo_torneo: "americano_individual",
              modalidad: tInfo.modalidad || "individual",
              estado: s.estado || "confirmada",
              estado_pago: "pagado",
              companero_nombre: tInfo.modalidad === "parejas" ? "Pareja fija" : "Modalidad Individual (Rotativo)",
              disponibilidad_horaria: "",
              franjas: [],
              torneo_estado: tInfo.estado ?? "",
              torneo_fecha_inicio: tInfo.fecha_inicio ?? null,
              partidos: []
            });
          }
        });

        // 4. Obtener participaciones en Desafíos Semanales por Parejas
        const { data: misSemanalesParejas } = await (supabase as any)
          .from("torneo_individual_parejas")
          .select("id, torneo_id, jugador1_id, jugador2_id")
          .in("torneo_id", tIds)
          .or(`jugador1_id.eq.${jugadorId},jugador2_id.eq.${jugadorId}`);

        if (misSemanalesParejas && misSemanalesParejas.length > 0) {
          const parejaCompaIds = misSemanalesParejas.map((sp: any) => sp.jugador1_id === jugadorId ? sp.jugador2_id : sp.jugador1_id);
          const { data: compaJugadores } = await supabase
            .from("jugadores_publicos" as any)
            .select("id, nombre, apellido")
            .in("id", parejaCompaIds);
          const compaMap = new Map((compaJugadores ?? []).map(j => [j.id, `${j.apellido}, ${j.nombre}`]));

          misSemanalesParejas.forEach((sp: any) => {
            const tInfo = tMap.get(sp.torneo_id);
            if (tInfo && !allItems.some(item => item.torneo_id === sp.torneo_id)) {
              const compaId = sp.jugador1_id === jugadorId ? sp.jugador2_id : sp.jugador1_id;
              allItems.push({
                id: sp.id,
                torneo_id: sp.torneo_id,
                torneo_nombre: tInfo.nombre,
                tipo_torneo: "americano_individual",
                modalidad: "parejas",
                estado: "confirmada",
                estado_pago: "pagado",
                companero_nombre: compaMap.get(compaId) || "Compañero/a de pareja",
                disponibilidad_horaria: "",
                franjas: [],
                torneo_estado: tInfo.estado ?? "",
                torneo_fecha_inicio: tInfo.fecha_inicio ?? null,
                partidos: []
              });
            }
          });
        }

        setInscripciones(allItems);
      } catch (error) {
        console.error("Error al cargar inscripciones del jugador", error);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [jugadorId]);

  if (loading) {
    return <div className="animate-pulse h-32 bg-muted rounded-xl"></div>;
  }

  if (inscripciones.length === 0) {
    return null;
  }

  const abrirEdicion = (inscripcion: MiInscripcion) => {
    setEditing(inscripcion);
    setAvailabilityText(inscripcion.disponibilidad_horaria);
    setSelectedFranjas(inscripcion.franjas.filter((f) => f.seleccionada).map((f) => f.id));
  };

  const guardarDisponibilidad = async () => {
    if (!editing) return;
    setSavingAvailability(true);
    try {
      const { data, error } = await (supabase as any).rpc("update_my_inscription_availability", {
        p_inscripcion_id: editing.id,
        p_disponibilidad_horaria: availabilityText.trim(),
        p_franjas_ids: selectedFranjas,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "No se pudo guardar la disponibilidad");
      setInscripciones((current) => current.map((item) => item.id === editing.id ? {
        ...item,
        disponibilidad_horaria: availabilityText.trim(),
        franjas: editing.franjas.map((f) => ({ ...f, seleccionada: selectedFranjas.includes(f.id) })),
      } : item));
      setEditing(null);
      toast.success("Disponibilidad actualizada");
    } catch (error: any) {
      toast.error(error.message ?? "No se pudo actualizar la disponibilidad");
    } finally {
      setSavingAvailability(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <ClipboardList className="h-4 w-4" /> Mis Torneos Actuales
      </h2>
      
      <div className="grid gap-4">
        {inscripciones.map(i => (
          <Card key={i.id} className="overflow-hidden">
            <CardHeader className="p-4 bg-muted/30 border-b flex flex-row items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-bold">{i.torneo_nombre}</CardTitle>
                  {i.tipo_torneo === "americano_individual" && (
                    <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] uppercase font-black tracking-wider">
                      Desafío Semanal
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {i.tipo_torneo === "americano_individual" && i.modalidad !== "parejas"
                    ? "Formato: Rotativo individual por canchas"
                    : `Con: ${i.companero_nombre}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0" asChild>
                <Link to={i.tipo_torneo === "americano_individual" ? `/torneo-individual/${i.torneo_id}` : `/torneo/${i.torneo_id}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`text-xs ${ESTADO_INSC_BADGE[i.estado as keyof typeof ESTADO_INSC_BADGE]}`}>
                  {ESTADO_INSC_LABELS[i.estado as keyof typeof ESTADO_INSC_LABELS]}
                </Badge>
                <Badge className={`text-xs ${PAGO_BADGE[i.estado_pago as keyof typeof PAGO_BADGE]}`}>
                  {PAGO_LABELS[i.estado_pago as keyof typeof PAGO_LABELS]}
                </Badge>
              </div>

              {i.tipo_torneo !== "americano_individual" && (
                <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Disponibilidad horaria</p>
                    {["proximamente", "inscripciones_abiertas", "inscripciones_cerradas"].includes(i.torneo_estado) && (i.torneo_fecha_inicio ?? "") > fechaHoyArgentina() && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => abrirEdicion(i)}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                    )}
                  </div>
                  {i.franjas.some((f) => f.seleccionada) ? (
                    <p className="text-xs text-muted-foreground">{i.franjas.filter((f) => f.seleccionada).map((f) => f.label).join(" · ")}</p>
                  ) : i.disponibilidad_horaria ? (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{i.disponibilidad_horaria}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No se informó disponibilidad.</p>
                  )}
                </div>
              )}

              {i.tipo_torneo === "americano_individual" && (
                <div className="pt-1">
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                    asChild
                  >
                    <Link to={`/torneo-individual/${i.torneo_id}`}>
                      <Trophy className="h-3.5 w-3.5" /> Entrar al Desafío Semanal (Tabla y Fixture)
                    </Link>
                  </Button>
                </div>
              )}

              {i.partidos.length > 0 && (
                <div className="pt-3 border-t">
                  <h3 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-3">
                    Próximos Partidos
                  </h3>
                  <div className="space-y-2">
                    {i.partidos.map(p => {
                      const d = new Date(p.fecha_hora);
                      const isHoy = d.toDateString() === new Date().toDateString();
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/20 border border-secondary/30">
                          <div className={`flex flex-col items-center justify-center p-2 rounded ${isHoy ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <CalendarClock className="h-4 w-4 mb-1" />
                            <span className="text-[10px] font-bold leading-none">
                              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold">{p.faseNombre}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground">
                                {isHoy ? "Hoy" : d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
                              </span>
                              {p.cancha ? (
                                <>
                                  <span>•</span>
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{p.cancha.includes('Cancha') ? p.cancha : `Cancha ${p.cancha}`}</span>
                                </>
                              ) : (
                                <>
                                  <span>•</span>
                                  <Clock className="h-3 w-3" />
                                  <span>A confirmar</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && !savingAvailability && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar disponibilidad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{editing?.torneo_nombre}</p>
            {editing?.franjas.length ? (
              <div className="space-y-2">
                <Label>Elegí tus franjas horarias</Label>
                {editing.franjas.map((franja) => (
                  <div key={franja.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`franja-${franja.id}`}
                      checked={selectedFranjas.includes(franja.id)}
                      onCheckedChange={(checked) => setSelectedFranjas((current) => checked
                        ? [...new Set([...current, franja.id])]
                        : current.filter((id) => id !== franja.id))}
                    />
                    <Label htmlFor={`franja-${franja.id}`} className="text-sm font-normal">{franja.label}</Label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="disponibilidad-jugador">Disponibilidad horaria</Label>
                <Textarea id="disponibilidad-jugador" rows={4} maxLength={500} value={availabilityText} onChange={(event) => setAvailabilityText(event.target.value)} placeholder="Ej.: jueves a la noche, viernes después de las 20 h" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingAvailability}>Cancelar</Button>
            <Button onClick={guardarDisponibilidad} disabled={savingAvailability}>
              {savingAvailability && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar disponibilidad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
