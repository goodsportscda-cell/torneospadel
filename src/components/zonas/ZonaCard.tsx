import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Trash2, X, ArrowUpDown, ChevronDown, Loader2, Share2, RefreshCw, Edit2, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { activeTenant } from "@/lib/tenant";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { calcularTabla, generarFixture, type PartidoConSets } from "@/lib/zonas";
import { PartidoCard } from "./PartidoCard";
import { TablaPosiciones } from "./TablaPosiciones";
import { CompartirFixtureZonaDialog } from "./CompartirFixtureZonaDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Zona = {
  id: string;
  nombre: string;
  tamanio: number;
  orden: number;
};

export type ParejaInscripta = {
  inscripcion_id: string;
  label: string;
};

type ZonaPareja = {
  id: string;
  zona_id: string;
  inscripcion_id: string;
  posicion_siembra: number;
};

type Partido = {
  id: string;
  zona_id: string;
  orden: number;
  tipo: "directo" | "ganadores" | "perdedores";
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  posicion_local: number | null;
  posicion_visitante: number | null;
  estado: "pendiente" | "en_juego" | "finalizado";
  ganador_id: string | null;
  fecha_hora: string | null;
  cancha: string | null;
};

type Props = {
  zona: Zona;
  parejasDisponibles: ParejaInscripta[];
  parejaLabel: (id: string) => string;
  onChanged: () => void;
  onDeleted: () => void;
  onUpdate?: (updates: Partial<Zona>) => void;
  readOnly?: boolean;
  torneoNombre?: string;
  todasLasZonas?: Zona[];
  parejaDisponibilidad?: (id: string) => string | null;
};

export function ZonaCard({ zona, parejasDisponibles, parejaLabel, onChanged, onDeleted, onUpdate, readOnly = false, torneoNombre = "", todasLasZonas = [], parejaDisponibilidad }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [zonaParejas, setZonaParejas] = useState<ZonaPareja[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [partidosCargados, setPartidosCargados] = useState(false);
  const [generandoFixture, setGenerandoFixture] = useState(false);
  const [setsByPartido, setSetsByPartido] = useState<Record<string, any>>({});
  const [shareFixtureOpen, setShareFixtureOpen] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

  // Transfer state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferOcupado, setTransferOcupado] = useState<ZonaPareja | null>(null);
  const [transferDestZona, setTransferDestZona] = useState<string>("");
  const [transferDestPosicion, setTransferDestPosicion] = useState<string>("");

  const handleTransferirPareja = async () => {
    if (!transferOcupado || !transferDestZona || !transferDestPosicion) return;
    
    const toastId = toast.loading("Moviendo pareja...");
    try {
      const { data: destPareja } = await supabase
        .from("zonas_parejas")
        .select("*")
        .eq("zona_id", transferDestZona)
        .eq("posicion_siembra", parseInt(transferDestPosicion))
        .maybeSingle();

      if (destPareja) {
        await supabase
          .from("zonas_parejas")
          .update({ zona_id: zona.id, posicion_siembra: transferOcupado.posicion_siembra })
          .eq("id", destPareja.id);
      }
      
      await supabase
        .from("zonas_parejas")
        .update({ zona_id: transferDestZona, posicion_siembra: parseInt(transferDestPosicion) })
        .eq("id", transferOcupado.id);

      toast.success("Pareja movida correctamente", { id: toastId });
      setTransferDialogOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error("Error al mover pareja: " + e.message, { id: toastId });
    }
  };

  const cargar = useCallback(async () => {
    try {
      const [{ data: zp }, { data: parts }] = await Promise.all([
        supabase.from("zonas_parejas").select("*").eq("zona_id", zona.id).order("posicion_siembra"),
        supabase.from("partidos_zona").select("*").eq("zona_id", zona.id).order("orden"),
      ]);
      setZonaParejas((zp ?? []) as ZonaPareja[]);
      setPartidos((parts ?? []) as Partido[]);
      setPartidosCargados(true);

      if (parts && parts.length > 0) {
        const ids = parts.map((p) => p.id);
        const { data: sets } = await supabase.from("sets_partido").select("*").in("partido_id", ids);
        const map: any = {};
        (sets ?? []).forEach((s) => {
          if (!map[s.partido_id]) map[s.partido_id] = [];
          map[s.partido_id].push(s);
        });
        setSetsByPartido(map);
      }
    } catch (e) {
      console.error(e);
    }
  }, [zona.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Generar fixture si no existe
  useEffect(() => {
    if (!partidosCargados || partidos.length > 0 || generandoFixture) return;
    
    const generar = async () => {
      setGenerandoFixture(true);
      try {
        const fixture = generarFixture(zona.tamanio as 3 | 4);
        const inserts = fixture.map(f => ({
          zona_id: zona.id,
          orden: f.orden,
          tipo: f.tipo,
          posicion_local: f.posicion_local,
          posicion_visitante: f.posicion_visitante,
          estado: "pendiente"
        }));
        const { error } = await supabase.from("partidos_zona").insert(inserts);
        if (error) {
          if (error.code === '23505') {
            // Ignorar error de duplicado (se generó en otro render/request simultáneo)
          } else {
            throw error;
          }
        }
        cargar();
      } catch (e: any) {
        toast.error("Error al generar fixture: " + e.message);
      } finally {
        setGenerandoFixture(false);
      }
    };
    generar();
  }, [partidosCargados, partidos.length, zona.id, zona.tamanio, generandoFixture, cargar]);

  const handleRegenerarFixture = async () => {
    const confirm = window.confirm("¿Seguro que quieres regenerar el fixture? Se borrarán todos los partidos y resultados de esta zona.");
    if (!confirm) return;

    const toastId = toast.loading("Regenerando fixture...");
    try {
      // 1. Borrar partidos y sets
      const { data: parts } = await supabase.from("partidos_zona").select("id").eq("zona_id", zona.id);
      if (parts && parts.length > 0) {
        const pIds = parts.map(p => p.id);
        await supabase.from("sets_partido").delete().in("partido_id", pIds);
        await supabase.from("partidos_zona").delete().in("id", pIds);
      }
      
      // 2. Generar nuevos
      const fixture = generarFixture(zona.tamanio as 3 | 4);
      const inserts = fixture.map(f => ({
        zona_id: zona.id,
        orden: f.orden,
        tipo: f.tipo,
        posicion_local: f.posicion_local,
        posicion_visitante: f.posicion_visitante,
        estado: "pendiente"
      }));
      const { error } = await supabase.from("partidos_zona").insert(inserts);
      if (error) throw error;
      
      toast.success("Fixture regenerado", { id: toastId });
      cargar();
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: toastId });
    }
  };

  // Agrega el partido faltante (para zonas de 4 que solo tienen 3 partidos)
  const handleAgregarPartidoFaltante = async (tipo: "ganadores" | "perdedores") => {
    const toastId = toast.loading("Agregando partido...");
    try {
      const maxOrden = partidos.reduce((max, p) => Math.max(max, p.orden), 0);
      const { error } = await supabase.from("partidos_zona").insert({
        zona_id: zona.id,
        orden: maxOrden + 1,
        tipo,
        posicion_local: null,
        posicion_visitante: null,
        estado: "pendiente",
      });
      if (error) throw error;
      toast.success(`Partido "${tipo === "ganadores" ? "Ganadores" : "Perdedores"}" agregado`, { id: toastId });
      cargar();
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: toastId });
    }
  };

  // Sincronizar parejas en los partidos según posiciones asignadas
  useEffect(() => {
    if (!partidosCargados || partidos.length === 0 || readOnly) return;

    const sync = async () => {
      let anyChanged = false;
      for (const p of partidos) {
        let newLocalId = p.pareja_local_id;
        let newVisiId = p.pareja_visitante_id;
        let matchChanged = false;

        if (p.tipo === "directo") {
          const l = zonaParejas.find(zp => zp.posicion_siembra === p.posicion_local)?.inscripcion_id || null;
          const v = zonaParejas.find(zp => zp.posicion_siembra === p.posicion_visitante)?.inscripcion_id || null;
          if (l !== p.pareja_local_id || v !== p.pareja_visitante_id) {
            newLocalId = l;
            newVisiId = v;
            matchChanged = true;
          }
        } else if (zona.tamanio === 4 && (p.tipo === "ganadores" || p.tipo === "perdedores")) {
          // Solo auto-completar si el partido está VACÍO (sin equipos asignados)
          // Si ya tiene equipos (asignados manual o automáticamente), no pisar
          if (p.pareja_local_id || p.pareja_visitante_id) continue;

          const m1 = partidos.find(x => x.orden === 1);
          const m2 = partidos.find(x => x.orden === 2);
          if (m1?.estado === "finalizado" && m2?.estado === "finalizado" && m1.ganador_id && m2.ganador_id) {
            if (p.tipo === "ganadores") {
              newLocalId = m1.ganador_id;
              newVisiId = m2.ganador_id;
            } else {
              newLocalId = m1.ganador_id === m1.pareja_local_id ? m1.pareja_visitante_id : m1.pareja_local_id;
              newVisiId = m2.ganador_id === m2.pareja_local_id ? m2.pareja_visitante_id : m2.pareja_local_id;
            }
            if (newLocalId !== p.pareja_local_id || newVisiId !== p.pareja_visitante_id) {
              matchChanged = true;
            }
          }
        }

        if (matchChanged) {
          anyChanged = true;
          await supabase.from("partidos_zona").update({
            pareja_local_id: newLocalId,
            pareja_visitante_id: newVisiId
          }).eq("id", p.id);
        }
      }
      if (anyChanged) cargar();
    };

    sync();
  }, [zonaParejas, partidos, partidosCargados, readOnly, zona.tamanio, cargar]);

  const slotsLlenos = useMemo(() => {
    const map = new Map<number, ZonaPareja>();
    zonaParejas.forEach((zp) => map.set(zp.posicion_siembra, zp));
    return map;
  }, [zonaParejas]);

  const asignarParejaManual = async (inscripcionId: string, posicion: number) => {
    const existente = zonaParejas.find(zp => zp.posicion_siembra === posicion);
    if (existente) await supabase.from("zonas_parejas").delete().eq("id", existente.id);
    await supabase.from("zonas_parejas").insert({
      zona_id: zona.id,
      inscripcion_id: inscripcionId,
      posicion_siembra: posicion,
    });
    toast.success("Pareja asignada");
    cargar();
    onChanged();
  };

  const quitarPareja = async (id: string) => {
    await supabase.from("zonas_parejas").delete().eq("id", id);
    cargar();
    onChanged();
  };

  const descargarImagen = async () => {
    if (!storyRef.current) return;
    setDescargando(true);
    try {
      const dataUrl = await toPng(storyRef.current, {
        cacheBust: true,
        backgroundColor: "#09090b",
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: storyRef.current.offsetWidth + "px",
          height: storyRef.current.offsetHeight + "px",
          opacity: "1",
          position: "relative",
          top: "0",
          left: "0"
        },
        pixelRatio: 2,
        fontEmbedCSS: ''
      });
      const link = document.createElement("a");
      link.download = `Historia-Zona-${zona.nombre}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagen generada");
    } catch (error) {
      console.error("Error al generar imagen:", error);
      toast.error("Error al generar la imagen");
    } finally {
      setDescargando(false);
    }
  };

  const compartirImagen = async () => {
    if (!storyRef.current) return;
    setDescargando(true);
    try {
      const dataUrl = await toPng(storyRef.current, {
        cacheBust: true,
        backgroundColor: "#09090b",
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: storyRef.current.offsetWidth + "px",
          height: storyRef.current.offsetHeight + "px",
          opacity: "1",
          position: "relative",
          top: "0",
          left: "0"
        },
        pixelRatio: 2,
        fontEmbedCSS: ''
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `Historia-Zona-${zona.nombre}.png`, { type: "image/png" });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Zona ${zona.nombre}`,
          text: `Mirá la Zona ${zona.nombre} del torneo`,
          files: [file],
        });
      } else {
        toast.error("Tu navegador no soporta compartir directamente. Se descargará la imagen.");
        const link = document.createElement("a");
        link.download = `Historia-Zona-${zona.nombre}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error("Error sharing image:", error);
      toast.error("Error al compartir la imagen");
    } finally {
      setDescargando(false);
    }
  };

  const tabla = useMemo(() => {
    const pConSets: PartidoConSets[] = partidos.map(p => ({
      ...p,
      sets: setsByPartido[p.id] ?? []
    }));
    return calcularTabla(zonaParejas.map(zp => ({
      inscripcion_id: zp.inscripcion_id,
      posicion_siembra: zp.posicion_siembra
    })), pConSets);
  }, [zonaParejas, partidos, setsByPartido]);

  const clasifican = zona.tamanio === 4 ? 3 : 2;

  return (
    <>
      <Card className="overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3 flex-1">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-3 text-left">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <CardTitle className="text-lg">Zona {zona.nombre}</CardTitle>
                </button>
              </CollapsibleTrigger>
              
              {!readOnly && onUpdate && (
                <div className="flex items-center gap-2 ml-4">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Orden:</span>
                    <Input 
                      type="number" 
                      value={zona.orden} 
                      onChange={(e) => onUpdate({ orden: parseInt(e.target.value) || 0 })}
                      className="w-12 h-7 text-xs px-1"
                    />
                  </div>
                  <Input 
                    type="text" 
                    value={zona.nombre} 
                    onChange={(e) => onUpdate({ nombre: e.target.value })}
                    className="w-14 h-7 text-xs px-1"
                    placeholder="Nombre"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold text-red-500">Tam:</span>
                    <Select 
                      value={zona.tamanio.toString()} 
                      onValueChange={(val) => onUpdate({ tamanio: parseInt(val) })}
                    >
                      <SelectTrigger className="w-14 h-7 text-xs px-1 bg-red-50 border-red-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={descargarImagen} 
                disabled={descargando}
                title="Descargar placa"
                className="text-primary hover:text-primary/80 hover:bg-primary/10"
              >
                {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={compartirImagen} 
                disabled={descargando}
                title="Compartir placa"
                className="text-primary hover:text-primary/80 hover:bg-primary/10"
              >
                {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              </Button>

              {!readOnly && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={handleRegenerarFixture}
                    title="Regenerar Fixture"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta zona?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminarán todos los partidos y resultados de la zona {zona.nombre}. 
                          Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={onDeleted} className="bg-destructive text-destructive-foreground">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
          <CollapsibleContent className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">Parejas</p>
              {Array.from({ length: zona.tamanio }, (_, i) => i + 1).map((pos) => {
                const ocupado = slotsLlenos.get(pos);
                return (
                  <div key={pos} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-4">{pos}.</span>
                    <div className="flex-1 border rounded p-2 text-sm bg-background min-h-[40px] flex items-center justify-between">
                      {ocupado ? (
                        <>
                          <div className="flex flex-col overflow-hidden min-w-0">
                            <span className="truncate">{parejaLabel(ocupado.inscripcion_id)}</span>
                            {parejaDisponibilidad && parejaDisponibilidad(ocupado.inscripcion_id) && (
                              <span className="text-[10px] text-muted-foreground truncate" title={parejaDisponibilidad(ocupado.inscripcion_id)!}>
                                Disp: {parejaDisponibilidad(ocupado.inscripcion_id)}
                              </span>
                            )}
                          </div>
                          {!readOnly && (
                            <div className="flex items-center gap-2">
                              <ArrowRightLeft 
                                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary" 
                                onClick={() => {
                                  setTransferOcupado(ocupado);
                                  setTransferDestZona("");
                                  setTransferDestPosicion("");
                                  setTransferDialogOpen(true);
                                }}
                                title="Cambiar a otra zona"
                              />
                              <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => quitarPareja(ocupado.id)} title="Quitar pareja" />
                            </div>
                          )}
                        </>
                      ) : !readOnly ? (
                        <Select onValueChange={(val) => asignarParejaManual(val, pos)}>
                          <SelectTrigger className="h-7 text-xs border-none bg-transparent">
                            <SelectValue placeholder="Asignar pareja..." />
                          </SelectTrigger>
                          <SelectContent>
                            {parejasDisponibles.map(p => {
                              const disp = parejaDisponibilidad ? parejaDisponibilidad(p.inscripcion_id) : null;
                              return (
                                <SelectItem key={p.inscripcion_id} value={p.inscripcion_id}>
                                  {p.label} {disp ? `(${disp})` : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-muted-foreground">Fixture</p>
                {partidos.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 px-2 py-0"
                    onClick={() => setShareFixtureOpen(true)}
                  >
                    <Share2 className="h-3 w-3 mr-1.5" />
                    Compartir Fixture
                  </Button>
                )}
              </div>
              
              {/* Aviso si faltan partidos en zona de 4 */}
              {!readOnly && zona.tamanio === 4 && partidosCargados && partidos.length > 0 && partidos.length < 4 && (() => {
                const tiposExistentes = partidos.map(p => p.tipo);
                const faltaGanadores = !tiposExistentes.includes("ganadores");
                const faltaPerdedores = !tiposExistentes.includes("perdedores");
                return (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800">
                      ⚠️ Zona de 4: faltan {4 - partidos.length} partido{4 - partidos.length > 1 ? "s" : ""}.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {faltaGanadores && (
                        <Button size="sm" variant="outline" className="text-xs h-7 border-amber-400 text-amber-800 hover:bg-amber-100" onClick={() => handleAgregarPartidoFaltante("ganadores")}>
                          + Agregar partido Ganadores
                        </Button>
                      )}
                      {faltaPerdedores && (
                        <Button size="sm" variant="outline" className="text-xs h-7 border-amber-400 text-amber-800 hover:bg-amber-100" onClick={() => handleAgregarPartidoFaltante("perdedores")}>
                          + Agregar partido Perdedores
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {partidos.map(p => (
                <PartidoCard
                  key={p.id}
                  partidoId={p.id}
                  orden={p.orden}
                  tipo={p.tipo}
                  parejaLocal={p.pareja_local_id ? { 
                    inscripcion_id: p.pareja_local_id, 
                    posicion_siembra: p.posicion_local ?? 0,
                    label: parejaLabel(p.pareja_local_id) 
                  } : null}
                  parejaVisitante={p.pareja_visitante_id ? { 
                    inscripcion_id: p.pareja_visitante_id, 
                    posicion_siembra: p.posicion_visitante ?? 0,
                    label: parejaLabel(p.pareja_visitante_id) 
                  } : null}
                  estado={p.estado}
                  ganadorId={p.ganador_id}
                  setsExistentes={setsByPartido[p.id] ?? []}
                  onUpdated={cargar}
                  fechaHora={p.fecha_hora}
                  cancha={p.cancha}
                  showProgramacion
                  readOnly={readOnly}
                  parejasZona={zonaParejas.map(zp => ({
                    inscripcion_id: zp.inscripcion_id,
                    label: parejaLabel(zp.inscripcion_id),
                  }))}
                />
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">Posiciones</p>
              <TablaPosiciones tabla={tabla} parejaLabel={parejaLabel} clasifican={clasifican} zonaId={zona.id} readOnly={readOnly} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <div 
        ref={storyRef}
        className="dark"
        style={{
          width: '540px',
          height: '960px',
          position: 'fixed',
          top: 0,
          left: 0,
          opacity: 0.0001,
          pointerEvents: 'none',
          background: 'linear-gradient(135deg, #022c22 0%, #060b11 50%, #021a14 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 40px',
          color: '#fafafa',
          zIndex: -100,
        }}
      >
        {/* Background grids and blurs to match brackets design */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            pointerEvents: "none",
          }}
        ></div>
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "-10%",
            width: "300px",
            height: "300px",
            borderRadius: "9999px",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            filter: "blur(80px)",
            pointerEvents: "none",
          }}
        ></div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px', zIndex: 10 }}>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 pr-5">
            <PadelIdLogo size={40} />
            <div className="text-left">
              <p className="text-sm font-black leading-none text-white tracking-tight">Padel <span className="text-emerald-400">ID</span></p>
              <p style={{ fontSize: '8px' }} className="text-white/40 uppercase tracking-widest font-extrabold mt-1">Anita Quiroga</p>
            </div>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '35px', zIndex: 10 }}>
          {torneoNombre && (
            <p style={{ fontSize: '18px', fontWeight: '800', color: '#fafafa', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
              {torneoNombre}
            </p>
          )}
          <p style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '0.15em', color: 'rgba(52, 211, 153, 0.6)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Resultados Clasificación
          </p>
          <h1 style={{ fontSize: '42px', fontWeight: '900', color: '#34d399', lineHeight: '1.1', letterSpacing: '-0.02em' }}>
            Zona {zona.nombre}
          </h1>
        </div>

        <div style={{ 
          flex: 1, 
          backgroundColor: 'rgba(9, 21, 18, 0.95)', 
          borderRadius: '16px', 
          padding: '16px', 
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)', 
          color: '#fafafa', 
          border: '1px solid rgba(6, 95, 70, 0.4)',
          zIndex: 10 
        }}>
            <TablaPosiciones tabla={tabla} parejaLabel={parejaLabel} clasifican={clasifican} zonaId={zona.id} readOnly={true} hideDiferencias={true} />
        </div>

        <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: '20px', zIndex: 10 }}>
           <p style={{ fontSize: '16px', fontWeight: '800', color: '#34d399', letterSpacing: '0.05em', marginBottom: '4px' }}>{activeTenant.name.toUpperCase()}</p>
           {activeTenant.instagram && (
             <p style={{ fontSize: '12px', color: 'rgba(52, 211, 153, 0.5)', fontWeight: '500' }}>{activeTenant.instagram}</p>
           )}
        </div>
      </div>

      <AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir Pareja</AlertDialogTitle>
            <AlertDialogDescription>
              Mueve esta pareja a otra zona. Si el destino está ocupado, se intercambiarán (Swap).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4 text-sm text-foreground">
            <div className="space-y-2">
              <label className="text-xs font-semibold">Zona Destino</label>
              <Select value={transferDestZona} onValueChange={setTransferDestZona}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona Zona..." />
                </SelectTrigger>
                <SelectContent>
                  {todasLasZonas.map(z => (
                    <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {transferDestZona && (
              <div className="space-y-2">
                <label className="text-xs font-semibold">Posición (Siembra)</label>
                <Select value={transferDestPosicion} onValueChange={setTransferDestPosicion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona Posición..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: todasLasZonas.find(z => z.id === transferDestZona)?.tamanio || 4 }, (_, i) => i + 1).map(pos => (
                      <SelectItem key={pos} value={pos.toString()}>Posición {pos}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferirPareja} disabled={!transferDestZona || !transferDestPosicion}>Transferir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompartirFixtureZonaDialog
        isOpen={shareFixtureOpen}
        onOpenChange={setShareFixtureOpen}
        torneoNombre={torneoNombre}
        zonaNombre={zona.nombre}
        partidos={partidos.map(p => ({
          id: p.id,
          orden: p.orden,
          parejaLocal: p.pareja_local_id ? {
            inscripcion_id: p.pareja_local_id,
            posicion_siembra: p.posicion_local ?? 0,
            label: parejaLabel(p.pareja_local_id)
          } : null,
          parejaVisitante: p.pareja_visitante_id ? {
            inscripcion_id: p.pareja_visitante_id,
            posicion_siembra: p.posicion_visitante ?? 0,
            label: parejaLabel(p.pareja_visitante_id)
          } : null,
          fechaHora: p.fecha_hora,
          cancha: p.cancha,
        }))}
      />
    </>
  );
}
