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

  const fechaHoraLabel = fechaHora
    ? new Date(fechaHora).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const abrirEditorEquipos = () => {
    setEditLocalId(parejaLocal?.inscripcion_id ?? "");
    setEditVisiId(parejaVisitante?.inscripcion_id ?? "");
    setEditingEquipos(true);
  };

  const guardarEquipos = async () => {
    if (!editLocalId || !editVisiId) {
      toast.error("Seleccioná ambas parejas");
      return;
    }
    if (editLocalId === editVisiId) {
      toast.error("Las dos parejas no pueden ser la misma");
      return;
    }
    setSavingEquipos(true);
    try {
      const { error } = await supabase
        .from(tabla)
        .update({ pareja_local_id: editLocalId, pareja_visitante_id: editVisiId })
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
    if (setsLocal > setsVis) return parejaLocal.inscripcion_id;
    if (setsVis > setsLocal) return parejaVisitante.inscripcion_id;
    return null;
  };

  const guardar = async () => {
    if (!parejaLocal || !parejaVisitante) return;
    // Si no hay override explícito, intentar calcular por sets
    const ganador = ganadorOverride ?? calcularGanador();
    setSaving(true);
    try {
      const fkColumn = tabla === "partidos_llave" ? "partido_llave_id" : "partido_id";
      // Borrar sets anteriores
      await supabase.from("sets_partido").delete().eq(fkColumn, partidoId);
      // Insertar nuevos
      const setsToInsert = sets
        .filter((s) => s.games_local > 0 || s.games_visitante > 0)
        .map((s) => ({
          [fkColumn]: partidoId,
          numero_set: s.numero_set,
          games_local: s.games_local,
          games_visitante: s.games_visitante,
        }));
      if (setsToInsert.length > 0) {
        const { error } = await supabase.from("sets_partido").insert(setsToInsert as never);
        if (error) throw error;
      }
      const { error: updErr } = await supabase
        .from(tabla)
        .update({
          ganador_id: ganador,
          estado: ganador ? "finalizado" : "pendiente",
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
            {/* Botón editar equipos: solo en partidos_zona y no readOnly */}
            {!readOnly && tabla === "partidos_zona" && parejasZona && parejasZona.length > 0 && (
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
              <p className="text-xs font-semibold text-blue-800">Editar equipos del partido</p>
              <button onClick={() => setEditingEquipos(false)} className="text-blue-500 hover:text-blue-800">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-blue-700 uppercase font-bold">Local</label>
              <Select value={editLocalId} onValueChange={setEditLocalId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar pareja..." />
                </SelectTrigger>
                <SelectContent>
                  {parejasZona.map(p => (
                    <SelectItem key={p.inscripcion_id} value={p.inscripcion_id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-blue-700 uppercase font-bold">Visitante</label>
              <Select value={editVisiId} onValueChange={setEditVisiId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar pareja..." />
                </SelectTrigger>
                <SelectContent>
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
                Guardar
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
            {cancha && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {cancha}
              </span>
            )}
          </div>
        )}

        <div className="space-y-1 text-sm">
          <div
            className={`flex items-center gap-2 ${
              ganadorId === parejaLocal?.inscripcion_id ? "font-semibold text-primary" : ""
            }`}
          >
            {ganadorId === parejaLocal?.inscripcion_id && <Trophy className="h-3 w-3" />}
            <span className="truncate">{parejaLocal?.label ?? "— por definir —"}</span>
          </div>
          <div
            className={`flex items-center gap-2 ${
              ganadorId === parejaVisitante?.inscripcion_id ? "font-semibold text-primary" : ""
            }`}
          >
            {ganadorId === parejaVisitante?.inscripcion_id && <Trophy className="h-3 w-3" />}
            <span className="truncate">{parejaVisitante?.label ?? "— por definir —"}</span>
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

        {!sinParejas && (
          <div className="space-y-2 pt-2 border-t">
            {readOnly ? (
              <div className="flex flex-wrap gap-2 justify-center">
                {setsExistentes.length > 0 ? (
                  setsExistentes.map((s, idx) => (
                    <Badge key={idx} variant="secondary" className="font-bold">
                      {s.games_local}-{s.games_visitante}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">Sin resultados</span>
                )}
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
