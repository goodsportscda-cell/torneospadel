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
import { Trash2, X, ArrowUpDown, ChevronDown, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import goodPadelLogo from "@/assets/good-padel-logo.png";
import { calcularTabla, generarFixture, type PartidoConSets } from "@/lib/zonas";
import { PartidoCard } from "./PartidoCard";
import { TablaPosiciones } from "./TablaPosiciones";
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
};

export function ZonaCard({ zona, parejasDisponibles, parejaLabel, onChanged, onDeleted, onUpdate, readOnly = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [zonaParejas, setZonaParejas] = useState<ZonaPareja[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [partidosCargados, setPartidosCargados] = useState(false);
  const [generandoFixture, setGenerandoFixture] = useState(false);
  const [setsByPartido, setSetsByPartido] = useState<Record<string, any>>({});
  const storyRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!partidosCargados || partidos.length > 0 || generandoFixture) return;
    const generar = async () => {
      setGenerandoFixture(true);
      const fixture = generarFixture(zona.tamanio as 3 | 4);
      const toInsert = fixture.map((f) => ({
        zona_id: zona.id,
        orden: f.orden,
        tipo: f.tipo,
        posicion_local: f.posicion_local,
        posicion_visitante: f.posicion_visitante,
      }));
      await supabase.from("partidos_zona").insert(toInsert);
      setGenerandoFixture(false);
      cargar();
    };
    generar();
  }, [zona.id, partidosCargados, partidos.length, generandoFixture, zona.tamanio, cargar]);

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
      const canvas = await html2canvas(storyRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 450,
        height: 800,
      });
      const link = document.createElement("a");
      link.download = `Historia-Zona-${zona.nombre}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagen generada");
    } catch (error) {
      console.error("Error al generar imagen:", error);
      toast.error("Error al generar la imagen");
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
            {!readOnly && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={descargarImagen} disabled={descargando}>
                  {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
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
              </div>
            )}
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
                          <span className="truncate">{parejaLabel(ocupado.inscripcion_id)}</span>
                          {!readOnly && <X className="h-3 w-3 cursor-pointer" onClick={() => quitarPareja(ocupado.id)} />}
                        </>
                      ) : !readOnly ? (
                        <Select onValueChange={(val) => asignarParejaManual(val, pos)}>
                          <SelectTrigger className="h-7 text-xs border-none bg-transparent">
                            <SelectValue placeholder="Asignar pareja..." />
                          </SelectTrigger>
                          <SelectContent>
                            {parejasDisponibles.map(p => (
                              <SelectItem key={p.inscripcion_id} value={p.inscripcion_id}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">Fixture</p>
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
                  readOnly={readOnly}
                />
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground">Posiciones</p>
              <TablaPosiciones tabla={tabla} parejaLabel={parejaLabel} clasifican={clasifican} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <div 
        ref={storyRef}
        style={{
          width: '450px',
          height: '800px',
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '40px 24px',
          color: '#0f172a',
          zIndex: -100,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
          <img src={goodPadelLogo} alt="Logo" style={{ width: '110px' }} />
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <p style={{ fontSize: '14px', fontWeight: '600', letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
            Resultados Clasificación
          </p>
          <h1 style={{ fontSize: '48px', fontWeight: '800', color: '#ef4444', lineHeight: '1' }}>
            Zona {zona.nombre}
          </h1>
        </div>

        <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '10px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}>
            <TablaPosiciones tabla={tabla} parejaLabel={parejaLabel} clasifican={clasifican} />
        </div>

        <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: '30px' }}>
           <p style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444', marginBottom: '4px' }}>GOOD PADEL</p>
           <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>@goodsports.jb</p>
        </div>
      </div>
    </>
  );
}
