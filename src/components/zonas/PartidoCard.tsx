import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Save, CalendarClock, MapPin, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Pareja = {
  inscripcion_id: string;
  posicion_siembra: number;
  label: string;
};

type SetRow = {
  numero_set: number;
  games_local: number;
  games_visitante: number;
};

type Props = {
  partidoId: string;
  orden: number;
  tipo?: "directo" | "ganadores" | "perdedores" | null;
  parejaLocal: Pareja | null;
  parejaVisitante: Pareja | null;
  estado: string;
  ganadorId: string | null;
  setsExistentes: SetRow[];
  onUpdated: () => void;
  // Tabla destino: 'partidos_zona' (default) o 'partidos_llave'
  tabla?: "partidos_zona" | "partidos_llave";
  labelPartido?: string;
  ref_local?: string | null;
  ref_visitante?: string | null;
  // Programación (opcional, se muestra si se pasa showProgramacion)
  fechaHora?: string | null;
  cancha?: string | null;
  showProgramacion?: boolean;
  readOnly?: boolean;
  // Parejas de la zona para edición manual de equipos
  parejasZona?: { inscripcion_id: string; label: string }[];
};

export function PartidoCard({
  partidoId,
  orden,
  tipo,
  parejaLocal,
  parejaVisitante,
  estado,
  ganadorId,
  setsExistentes,
  onUpdated,
  tabla = "partidos_zona",
  labelPartido,
  ref_local,
  ref_visitante,
  fechaHora,
  cancha,
  showProgramacion = false,
  readOnly = false,
  parejasZona,
}: Props) {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [showProgEditor, setShowProgEditor] = useState(false);
  const [savingProg, setSavingProg] = useState(false);
  const [progFecha, setProgFecha] = useState<string>("");
  const [progHora, setProgHora] = useState<string>("");
  const [progCancha, setProgCancha] = useState<string>("");
  const [progEstado, setProgEstado] = useState<string>(estado);
  const [editingEquipos, setEditingEquipos] = useState(false);
  const [editLocalId, setEditLocalId] = useState<string>("");
  const [editVisiId, setEditVisiId] = useState<string>("");
  const [editRefLocal, setEditRefLocal] = useState<string>("");
  const [editRefVisitante, setEditRefVisitante] = useState<string>("");
  const [savingEquipos, setSavingEquipos] = useState(false);
  // Selección explícita de ganador (tiene prioridad sobre cálculo por sets)
  const [ganadorOverride, setGanadorOverride] = useState<string | null>(ganadorId);

  useEffect(() => {
    if (setsExistentes.length > 0) {
      setSets(setsExistentes);
    } else {
      setSets([
        { numero_set: 1, games_local: 0, games_visitante: 0 },
        { numero_set: 2, games_local: 0, games_visitante: 0 },
      ]);
    }
  }, [setsExistentes]);

  // Sincronizar ganadorOverride cuando cambia ganadorId desde el padre (ej. al recargar)
  useEffect(() => {
    setGanadorOverride(ganadorId);
  }, [ganadorId]);

  // Sincroniza valores de programación cuando llegan del padre
  useEffect(() => {
    if (fechaHora) {
      const d = new Date(fechaHora);
      const pad = (n: number) => String(n).padStart(2, "0");
      setProgFecha(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setProgHora(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      setProgFecha("");
      setProgHora("");
    }
    setProgCancha(cancha ?? "");
    setProgEstado(estado);
  }, [fechaHora, cancha, estado]);

  const guardarProgramacion = async () => {
    setSavingProg(true);
    try {
      let fechaHoraISO: string | null = null;
      if (progFecha && progHora) {
        const [y, m, d] = progFecha.split("-").map(Number);
        const [hh, mm] = progHora.split(":").map(Number);
        fechaHoraISO = new Date(y, m - 1, d, hh, mm).toISOString();
      } else if (progFecha) {
        const [y, m, d] = progFecha.split("-").map(Number);
        fechaHoraISO = new Date(y, m - 1, d, 0, 0).toISOString();
      }
      const payload: Record<string, unknown> = {
        fecha_hora: fechaHoraISO,
        cancha: progCancha.trim() || null,
      };
      // Solo actualizamos estado si NO está finalizado (no pisar resultado)
      if (estado !== "finalizado") {
        payload.estado = progEstado;
      }
      const { error } = await supabase
        .from(tabla)
        .update(payload as never)
        .eq("id", partidoId);
      if (error) throw error;
      toast.success("Programación guardada");
      setShowProgEditor(false);
      onUpdated();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar programación");
    } finally {
      setSavingProg(false);
    }
  };

  let fechaHoraLabel = null;
  if (fechaHora) {
    const d = new Date(fechaHora);
    let weekday = d.toLocaleString("es-AR", { weekday: "short" }).replace(".", "");
    weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const time = d.toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" });
    fechaHoraLabel = `${weekday} ${time} hs`;
  }

  let canchaLabel = null;
  if (cancha) {
    const t = cancha.trim();
    canchaLabel = t.toLowerCase().includes('cancha') ? t : `Cancha ${t}`;
  }

  const abrirEditorEquipos = () => {
    setEditLocalId(parejaLocal?.inscripcion_id || "none");
    setEditVisiId(parejaVisitante?.inscripcion_id || "none");
    setEditRefLocal(ref_local ?? "");
    setEditRefVisitante(ref_visitante ?? "");
    setEditingEquipos(true);
  };

  const guardarEquipos = async () => {
    setSavingEquipos(true);
    try {
      const nuevoLocalId = editLocalId === "none" ? null : editLocalId;
      const nuevoVisiId = editVisiId === "none" ? null : editVisiId;
      
      const updates: any = {
        pareja_local_id: nuevoLocalId, 
        pareja_visitante_id: nuevoVisiId,
        ref_local: editRefLocal.trim() || null,
        ref_visitante: editRefVisitante.trim() || null
      };

      // Si el ganador_id actual no coincide con ninguno de los nuevos equipos, lo limpiamos para evitar inconsistencias
      if (ganadorId && ganadorId !== nuevoLocalId && ganadorId !== nuevoVisiId) {
        updates.ganador_id = null;
        updates.estado = "pendiente";
      }

      const { error } = await supabase
        .from(tabla)
        .update(updates)
        .eq("id", partidoId);
      if (error) throw error;
      toast.success("Equipos actualizados");
      setEditingEquipos(false);
      onUpdated();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setSavingEquipos(false);
    }
  };

  const updateSet = (idx: number, field: "games_local" | "games_visitante", value: string) => {
    const num = parseInt(value, 10);
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: isNaN(num) ? 0 : num } : s)));
  };

  const addSet = () => {
    if (sets.length >= 5) return;
    setSets((prev) => [...prev, { numero_set: prev.length + 1, games_local: 0, games_visitante: 0 }]);
  };

  const removeSet = (idx: number) => {
    if (sets.length <= 1) return;
    setSets((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, numero_set: i + 1 })));
  };

  const calcularGanador = (): string | null => {
    if (!parejaLocal || !parejaVisitante) return null;
    let setsLocal = 0;
    let setsVis = 0;
    sets.forEach((s) => {
      if (s.games_local > s.games_visitante) setsLocal++;
      else if (s.games_visitante > s.games_local) setsVis++;
    });
    if (setsLocal >= 2) return parejaLocal.inscripcion_id;
    if (setsVis >= 2) return parejaVisitante.inscripcion_id;
    return null;
  };

  const guardar = async () => {
    if (!parejaLocal || !parejaVisitante) return;
    // Si no hay override explícito, intentar calcular por sets
    const ganador = ganadorOverride ?? calcularGanador();
    setSaving(true);
    try {
      const fkColumn = tabla === "partidos_llave" ? "partido_llave_id" : "partido_id";
      // Obtener sets existentes para actualizarlos en lugar de borrarlos (evita problemas de RLS DELETE)
      const { data: existingSets } = await supabase
        .from("sets_partido")
        .select("id, numero_set")
        .eq(fkColumn, partidoId);
        
      const existingMap = new Map((existingSets || []).map(s => [s.numero_set, s.id]));
      
      const setsToInsert = sets
        .filter((s) => s.games_local > 0 || s.games_visitante > 0 || (ganadorOverride !== null && s.numero_set <= 2))
        .map((s) => ({
          id: existingMap.get(s.numero_set), // incluir ID si existe para forzar UPSERT o UPDATE
          partido_id: tabla === "partidos_zona" ? partidoId : null,
          partido_llave_id: tabla === "partidos_llave" ? partidoId : null,
          numero_set: s.numero_set,
          games_local: s.games_local,
          games_visitante: s.games_visitante,
        }));

      if (ganador && setsToInsert.length === 0) {
        toast.error("Debe ingresar los resultados de los sets para marcar un ganador.");
        setSaving(false);
        return;
      }

      console.log("Guardando sets:", setsToInsert);

      // Procesar actualizaciones e inserciones
      for (const set of setsToInsert) {
        if (set.id) {
          const { id, ...updateData } = set;
          const { error } = await supabase.from("sets_partido").update(updateData).eq("id", id);
          if (error) {
            console.error("Error al actualizar set:", error);
            throw error;
          }
        } else {
          const { id, ...insertData } = set;
          const { error } = await supabase.from("sets_partido").insert(insertData as never);
          if (error) {
            console.error("Error al insertar set:", error);
            throw error;
          }
        }
      }
      
      // Los sets que ya no se usan (ej. se borró el 3er set), los ponemos en 0-0
      if (existingSets) {
        const usedSets = setsToInsert.map(s => s.numero_set);
        const extraSets = existingSets.filter(s => !usedSets.includes(s.numero_set));
        for (const extra of extraSets) {
           await supabase.from("sets_partido").update({ games_local: 0, games_visitante: 0 }).eq("id", extra.id);
        }
      };

      const { error: updErr } = await supabase
        .from(tabla)
        .update({
          ganador_id: ganador,
          estado: ganador ? "finalizado" : (setsToInsert.length > 0 ? "en_juego" : "pendiente"),
        })
        .eq("id", partidoId);
      if (updErr) throw updErr;
      toast.success("Resultado guardado");
      onUpdated();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const tipoBadge = tipo === "ganadores" ? "Ganadores" : tipo === "perdedores" ? "Perdedores" : null;
  const sinParejas = !parejaLocal || !parejaVisitante;

  const estadoBadgeVariant = (e: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (e) {
      case "finalizado":
        return "default";
      case "en_juego":
        return "destructive";
      case "programado":
        return "secondary";
      case "suspendido":
        return "outline";
      default:
        return "outline";
    }
  };
  const estadoLabel = (e: string): string => {
    switch (e) {
      case "finalizado":
        return "Finalizado";
      case "en_juego":
        return "En juego";
      case "programado":
        return "Programado";
      case "suspendido":
        return "Suspendido";
      default:
        return "Pendiente";
    }
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
          <span className="font-medium">{labelPartido ?? `Partido ${orden}`}</span>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {tipoBadge && <Badge variant="outline" className="text-xs">{tipoBadge}</Badge>}
            {estado !== "pendiente" && (
              <Badge variant={estadoBadgeVariant(estado)} className="text-xs">
                {estadoLabel(estado)}
              </Badge>
            )}
            {/* Botón editar equipos: visible cuando hay parejas disponibles y no es readOnly */}
            {!readOnly && parejasZona && parejasZona.length > 0 && (
              <button
                onClick={abrirEditorEquipos}
                title="Editar equipos manualmente"
                className="ml-1 text-muted-foreground hover:text-primary transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Editor manual de equipos */}
        {editingEquipos && parejasZona && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-800">Editar equipos/referencias</p>
              <button onClick={() => setEditingEquipos(false)} className="text-blue-500 hover:text-blue-800">
                <X className="h-3 w-3" />
              </button>
            </div>
            
            <div className="space-y-2 pb-2 border-b border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 uppercase">Referencias (Manual APA)</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-blue-700">Local (ej: 1°A)</label>
                  <Input 
                    value={editRefLocal} 
                    onChange={(e) => setEditRefLocal(e.target.value)} 
                    className="h-7 text-xs bg-white border-blue-200"
                    placeholder="1°A"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-blue-700">Visitante (ej: G:34)</label>
                  <Input 
                    value={editRefVisitante} 
                    onChange={(e) => setEditRefVisitante(e.target.value)} 
                    className="h-7 text-xs bg-white border-blue-200"
                    placeholder="2°B"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-blue-700 uppercase font-bold">Pareja Local (Fija)</label>
              <Select value={editLocalId} onValueChange={setEditLocalId}>
                <SelectTrigger className="h-8 text-xs bg-white border-blue-200">
                  <SelectValue placeholder="Seleccionar pareja..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— por definir —</SelectItem>
                  {parejasZona.map(p => (
                    <SelectItem key={p.inscripcion_id} value={p.inscripcion_id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-blue-700 uppercase font-bold">Pareja Visitante (Fija)</label>
              <Select value={editVisiId} onValueChange={setEditVisiId}>
                <SelectTrigger className="h-8 text-xs bg-white border-blue-200">
                  <SelectValue placeholder="Seleccionar pareja..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— por definir —</SelectItem>
                  {parejasZona.map(p => (
                    <SelectItem key={p.inscripcion_id} value={p.inscripcion_id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingEquipos(false)}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs" onClick={guardarEquipos} disabled={savingEquipos}>
                <Save className="h-3 w-3 mr-1" />
                Guardar cambios
              </Button>
            </div>
          </div>
        )}

        {showProgramacion && (fechaHoraLabel || cancha) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground -mt-1">
            {fechaHoraLabel && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {fechaHoraLabel}
              </span>
            )}
            {canchaLabel && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {canchaLabel}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 py-1.5">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Pareja Local Row */}
            <div className="flex items-center justify-between gap-2">
              <div
                className={`flex items-center gap-2 truncate min-w-0 ${
                  ganadorId === parejaLocal?.inscripcion_id ? "font-bold text-primary" : "text-foreground/80"
                }`}
              >
                {ganadorId === parejaLocal?.inscripcion_id && <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />}
                <span className="truncate flex items-center gap-1.5">
                  {ref_local && (
                    <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-muted-foreground border shrink-0">
                      {ref_local}
                    </span>
                  )}
                  <span className="truncate">{parejaLocal?.label ?? "— por definir —"}</span>
                </span>
              </div>

              {/* Marcador Local */}
              {setsExistentes.length > 0 && (
                <div className="flex gap-1 shrink-0 font-mono text-xs">
                  {setsExistentes.map((s, idx) => {
                    const localGanadorSet = s.games_local > s.games_visitante;
                    return (
                      <div
                        key={idx}
                        className={`w-7 h-7 flex items-center justify-center rounded-md border text-center transition-all ${
                          localGanadorSet
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                            : "bg-muted/45 text-muted-foreground border-muted-foreground/10"
                        }`}
                      >
                        {s.games_local}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pareja Visitante Row */}
            <div className="flex items-center justify-between gap-2">
              <div
                className={`flex items-center gap-2 truncate min-w-0 ${
                  ganadorId === parejaVisitante?.inscripcion_id ? "font-bold text-primary" : "text-foreground/80"
                }`}
              >
                {ganadorId === parejaVisitante?.inscripcion_id && <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />}
                <span className="truncate flex items-center gap-1.5">
                  {ref_visitante && (
                    <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-muted-foreground border shrink-0">
                      {ref_visitante}
                    </span>
                  )}
                  <span className="truncate">{parejaVisitante?.label ?? "— por definir —"}</span>
                </span>
              </div>

              {/* Marcador Visitante */}
              {setsExistentes.length > 0 && (
                <div className="flex gap-1 shrink-0 font-mono text-xs">
                  {setsExistentes.map((s, idx) => {
                    const visitanteGanadorSet = s.games_visitante > s.games_local;
                    return (
                      <div
                        key={idx}
                        className={`w-7 h-7 flex items-center justify-center rounded-md border text-center transition-all ${
                          visitanteGanadorSet
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                            : "bg-muted/45 text-muted-foreground border-muted-foreground/10"
                        }`}
                      >
                        {s.games_visitante}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {showProgramacion && !readOnly && (
          <div className="pt-2 border-t">
            {!showProgEditor ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs w-full justify-start"
                onClick={() => setShowProgEditor(true)}
              >
                <CalendarClock className="h-3 w-3 mr-1" />
                {fechaHoraLabel || cancha ? "Editar programación" : "Programar partido"}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Fecha</label>
                    <Input
                      type="date"
                      value={progFecha}
                      onChange={(e) => setProgFecha(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Hora</label>
                    <Input
                      type="time"
                      value={progHora}
                      onChange={(e) => setProgHora(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Cancha</label>
                  <Input
                    type="text"
                    placeholder="Cancha 1"
                    value={progCancha}
                    onChange={(e) => setProgCancha(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                {estado !== "finalizado" && (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Estado</label>
                    <Select value={progEstado} onValueChange={setProgEstado}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="programado">Programado</SelectItem>
                        <SelectItem value="en_juego">En juego</SelectItem>
                        <SelectItem value="suspendido">Suspendido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowProgEditor(false)}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={guardarProgramacion} disabled={savingProg}>
                    <Save className="h-3 w-3 mr-1" />
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {!sinParejas && (!readOnly || setsExistentes.length === 0) && (
          <div className="space-y-2 pt-2 border-t">
            {readOnly ? (
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground italic">Sin resultados</span>
              </div>
            ) : (
              <>
                {/* Selector explícito de ganador */}
                {parejaLocal && parejaVisitante && (
                  <div className="space-y-1 pb-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">¿Quién ganó?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setGanadorOverride(
                          ganadorOverride === parejaLocal.inscripcion_id ? null : parejaLocal.inscripcion_id
                        )}
                        className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-all ${
                          ganadorOverride === parejaLocal.inscripcion_id
                            ? "bg-green-500 border-green-600 text-white shadow-sm"
                            : "border-muted-foreground/30 hover:border-green-400 hover:bg-green-50"
                        }`}
                      >
                        🏆 {parejaLocal.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGanadorOverride(
                          ganadorOverride === parejaVisitante.inscripcion_id ? null : parejaVisitante.inscripcion_id
                        )}
                        className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-all ${
                          ganadorOverride === parejaVisitante.inscripcion_id
                            ? "bg-green-500 border-green-600 text-white shadow-sm"
                            : "border-muted-foreground/30 hover:border-green-400 hover:bg-green-50"
                        }`}
                      >
                        🏆 {parejaVisitante.label}
                      </button>
                    </div>
                  </div>
                )}

                {sets.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-8">Set {s.numero_set}</span>
                    <Input
                      type="number"
                      min="0"
                      max="9"
                      value={s.games_local}
                      onChange={(e) => updateSet(idx, "games_local", e.target.value)}
                      className="h-8 w-14 text-center"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      min="0"
                      max="9"
                      value={s.games_visitante}
                      onChange={(e) => updateSet(idx, "games_visitante", e.target.value)}
                      className="h-8 w-14 text-center"
                    />
                    {sets.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => removeSet(idx)}>
                        ×
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  {sets.length < 5 && (
                    <Button variant="outline" size="sm" onClick={addSet} className="text-xs">
                      + Set
                    </Button>
                  )}
                  <Button size="sm" onClick={guardar} disabled={saving} className="ml-auto">
                    <Save className="h-3 w-3 mr-1" />
                    Guardar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
