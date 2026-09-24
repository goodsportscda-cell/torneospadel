import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
import { useQueryClient } from "@tanstack/react-query";
import { Trophy, Save, CalendarClock, MapPin, Pencil, X, Lock, Camera, Upload, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadPartidoPhoto, persistPartidoPhoto } from "@/lib/partidoPhotoUpload";
import { extractFotoFromNotas } from "@/logic/torneoStandings";

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
  zonaId?: string;
  torneoId?: string;
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
  zonaId,
  torneoId,
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
  const routeParams = useParams<{ id: string }>();
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

  // Estados de foto de partido (Torneos Oficiales / Zonas / Llaves)
  const [fotoUrl, setFotoUrl] = useState<string>("");
  const [uploadingFoto, setUploadingFoto] = useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [effectiveTorneoId, setEffectiveTorneoId] = useState<string>(torneoId || "");

  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;
    const loadFotoAndTorneo = async () => {
      let tId = torneoId || routeParams.id;
      if (!tId && zonaId) {
        const { data: z } = await supabase.from("zonas").select("torneo_id").eq("id", zonaId).maybeSingle();
        if (z?.torneo_id) tId = z.torneo_id;
      }
      if (!tId && tabla === "partidos_llave") {
        const { data: pl } = await supabase.from("partidos_llave").select("llave_id, llaves(torneo_id)").eq("id", partidoId).maybeSingle();
        if ((pl as any)?.llaves?.torneo_id) tId = (pl as any).llaves.torneo_id;
      }

      if (tId) {
        if (isMounted) setEffectiveTorneoId(tId);
        const { data: t } = await supabase.from("torneos").select("notas").eq("id", tId).maybeSingle();
        if (isMounted && t?.notas) {
          const extracted = extractFotoFromNotas(t.notas, partidoId);
          if (extracted) setFotoUrl(extracted);
        }
      }
    };
    loadFotoAndTorneo();
    return () => { isMounted = false; };
  }, [partidoId, torneoId, zonaId, tabla, routeParams.id]);

  const handleFotoUpload = async (file: File) => {
    if (!file) return;
    setUploadingFoto(true);
    try {
      const url = await uploadPartidoPhoto(file, effectiveTorneoId || "general", partidoId);
      setFotoUrl(url);
      if (effectiveTorneoId) {
        const { data: tData } = await supabase.from("torneos").select("notas").eq("id", effectiveTorneoId).maybeSingle();
        await persistPartidoPhoto(effectiveTorneoId, partidoId, url, tData?.notas);
        queryClient.invalidateQueries({ queryKey: ["torneo-llaves"] });
        queryClient.invalidateQueries({ queryKey: ["torneo-zonas"] });
      }
      toast.success("Foto del partido guardada");
    } catch (err: any) {
      toast.error("Error al subir foto: " + (err?.message || ""));
    } finally {
      setUploadingFoto(false);
    }
  };

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
      queryClient.invalidateQueries({ queryKey: ["torneo-llaves"] });
      queryClient.invalidateQueries({ queryKey: ["torneo-zonas"] });
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
      };

      if (tabla === "partidos_llave") {
        updates.ref_local = editRefLocal.trim() || null;
        updates.ref_visitante = editRefVisitante.trim() || null;
      }

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
      queryClient.invalidateQueries({ queryKey: ["torneo-llaves"] });
      queryClient.invalidateQueries({ queryKey: ["torneo-zonas"] });
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

  const calcularGanadorDB = (): string | null => {
    if (!parejaLocal || !parejaVisitante) return null;
    let setsLocal = 0;
    let setsVis = 0;
    setsExistentes.forEach((s) => {
      if (s.games_local > s.games_visitante) setsLocal++;
      else if (s.games_visitante > s.games_local) setsVis++;
    });
    if (setsLocal >= 2) return parejaLocal.inscripcion_id;
    if (setsVis >= 2) return parejaVisitante.inscripcion_id;
    return null;
  };

  const esForzadoDB = ganadorId && ganadorId !== calcularGanadorDB();

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
      // Crear el payload completo
      const payloadRPC = {
        p_partido_id: partidoId,
        p_tabla: tabla,
        p_ganador_id: ganador,
        p_estado: ganador ? "finalizado" : (setsToInsert.length > 0 ? "en_juego" : "pendiente"),
        p_sets: setsToInsert
      };

      const { error: rpcErr } = await supabase.rpc("guardar_resultado_partido_transaction", payloadRPC);
      if (rpcErr) throw rpcErr;
      
      // Los sets que ya no se usan (ej. se borró el 3er set), los ponemos en 0-0
      if (existingSets) {
        const usedSets = setsToInsert.map(s => s.numero_set);
        const extraSets = existingSets.filter(s => !usedSets.includes(s.numero_set));
        for (const extra of extraSets) {
           await supabase.from("sets_partido").update({ games_local: 0, games_visitante: 0 }).eq("id", extra.id);
        }
      }

      // Si es partido 1 o 2 de una zona, sincronizar los cruces de Ganadores y Perdedores inmediatamente
      if (tabla === "partidos_zona" && zonaId && (orden === 1 || orden === 2)) {
        try {
          await supabase.rpc("recalcular_cruces_zona_4", { p_zona_id: zonaId });
        } catch (recalcErr) {
          console.warn("Recálculo client-side opcional:", recalcErr);
        }
      }

      if (effectiveTorneoId && fotoUrl) {
        try {
          const { data: tData } = await supabase.from("torneos").select("notas").eq("id", effectiveTorneoId).maybeSingle();
          await persistPartidoPhoto(effectiveTorneoId, partidoId, fotoUrl, tData?.notas);
        } catch (photoErr) {
          console.warn("Error guardando foto en notas:", photoErr);
        }
      }

      toast.success("Resultado guardado");
      onUpdated();
      queryClient.invalidateQueries({ queryKey: ["torneo-llaves"] });
      queryClient.invalidateQueries({ queryKey: ["torneo-zonas"] });
    } catch (e: any) {
      console.error(e);
      toast.error("Error al guardar: " + (e.message || "Error desconocido"));
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
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Badge de Foto del Partido o subida rápida */}
            {fotoUrl ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                title="Ver foto del partido"
              >
                <Camera className="h-3 w-3 text-emerald-400" />
                <span>FOTO</span>
              </button>
            ) : !readOnly ? (
              <label
                htmlFor={`header-foto-input-${partidoId}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 px-1.5 py-0.5 rounded-full transition-all cursor-pointer"
                title="Subir o tomar foto del partido"
              >
                {uploadingFoto ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
                <input
                  id={`header-foto-input-${partidoId}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingFoto}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFotoUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}

            {tipoBadge && <Badge variant="outline" className="text-xs">{tipoBadge}</Badge>}
            {estado !== "pendiente" && (
              <Badge variant={estadoBadgeVariant(estado)} className="text-xs flex items-center gap-1">
                {estadoLabel(estado)}
                {estado === "finalizado" && esForzadoDB && (
                  <span title="Ganador forzado manualmente" className="inline-flex items-center">
                    <Lock className="h-3 w-3 text-amber-500" />
                  </span>
                )}
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
            
            {tabla === "partidos_llave" && (
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
            )}

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
                    <p className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      ¿Forzar Ganador?
                    </p>
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
                {/* Sección de Foto del Partido (Competición / Podio / Cancha) */}
                <div className="pt-2 border-t space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Camera className="h-3 w-3 text-primary" />
                      Foto del Partido (Podio / Cancha)
                    </span>
                    {fotoUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          setFotoUrl("");
                          if (effectiveTorneoId) {
                            const { data: tData } = await supabase.from("torneos").select("notas").eq("id", effectiveTorneoId).maybeSingle();
                            await persistPartidoPhoto(effectiveTorneoId, partidoId, "", tData?.notas);
                            toast.info("Foto eliminada");
                          }
                        }}
                        className="text-red-500 hover:text-red-700 normal-case font-normal text-[10px]"
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>

                  {fotoUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-border group h-24 bg-muted/30">
                      <img
                        src={fotoUrl}
                        alt="Foto del partido"
                        className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                        onClick={() => setLightboxOpen(true)}
                      />
                      <div 
                        onClick={() => setLightboxOpen(true)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                        Ampliar foto
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id={`editor-foto-input-${partidoId}`}
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingFoto}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFotoUpload(file);
                          e.target.value = "";
                        }}
                      />
                      <label
                        htmlFor={`editor-foto-input-${partidoId}`}
                        className={`flex items-center justify-center gap-2 border border-dashed rounded-lg p-2 text-xs cursor-pointer transition-all ${
                          uploadingFoto
                            ? "opacity-50 pointer-events-none bg-muted"
                            : "border-primary/40 hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {uploadingFoto ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            <span>Optimizando y subiendo...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 text-primary" />
                            <span>Subir o tomar foto del partido</span>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                </div>

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

      {/* Lightbox para visualización ampliada de la foto */}
      {lightboxOpen && fotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={fotoUrl}
              alt="Foto ampliada del partido"
              className="max-w-full max-h-[75vh] object-contain rounded-xl border border-white/20 shadow-2xl"
            />
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLightboxOpen(false)}
                className="rounded-full text-xs font-semibold px-4"
              >
                Cerrar vista previa
              </Button>
              <a
                href={fotoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-300 hover:text-white underline"
              >
                Abrir original
              </a>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
