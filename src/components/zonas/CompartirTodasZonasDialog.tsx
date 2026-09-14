import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Share2, Sparkles, Loader2 } from "lucide-react";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Zona } from "./ZonaCard";

interface ParejaInfo {
  inscripcion_id: string;
  posicion_siembra: number;
  label: string;
}

interface PartidoDisplay {
  id: string;
  orden: number;
  parejaLocal: ParejaInfo | null;
  parejaVisitante: ParejaInfo | null;
  fechaHora: string | null;
  cancha: string | null;
}

interface ZonaGroup {
  zona: Zona;
  partidos: PartidoDisplay[];
}

interface CompartirTodasZonasDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  torneoId: string;
  torneoNombre: string;
  zonas: Zona[];
}

type ThemePreset = "cyber-neon" | "dark-sport";
type AspectRatio = "story" | "square";

export function CompartirTodasZonasDialog({
  isOpen,
  onOpenChange,
  torneoId,
  torneoNombre,
  zonas,
}: CompartirTodasZonasDialogProps) {
  const [theme, setTheme] = useState<ThemePreset>("cyber-neon");
  const [ratio, setRatio] = useState<AspectRatio>("story");
  const [exporting, setExporting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [zonaGroups, setZonaGroups] = useState<ZonaGroup[]>([]);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !torneoId) return;

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [
          { data: inscripciones },
          { data: jugadores },
          { data: zonasParejas },
          { data: partidosZona },
        ] = await Promise.all([
          supabase.from("inscripciones").select("*").eq("torneo_id", torneoId).eq("estado", "confirmada"),
          supabase.from("jugadores").select("*"),
          supabase.from("zonas_parejas").select("*, zonas!inner(torneo_id)").eq("zonas.torneo_id", torneoId),
          supabase.from("partidos_zona").select("*, zonas!inner(torneo_id)").eq("zonas.torneo_id", torneoId).order("orden"),
        ]);

        const getParejaLabel = (insId: string) => {
          if (!inscripciones || !jugadores) return "TBD";
          const ins = inscripciones.find(i => i.id === insId);
          if (!ins) return "TBD";
          const j1 = jugadores.find(j => j.id === ins.jugador1_id)?.apellido || "";
          const j2 = jugadores.find(j => j.id === ins.jugador2_id)?.apellido || "";
          return `${j1}/${j2}`.toUpperCase();
        };

        const groups: ZonaGroup[] = zonas.map(z => {
          const partidosDeZona = (partidosZona || []).filter(p => p.zona_id === z.id);
          const parejasDeZona = (zonasParejas || []).filter(zp => zp.zona_id === z.id);

          const partidosDisplay: PartidoDisplay[] = partidosDeZona.map(p => {
            return {
              id: p.id,
              orden: p.orden,
              fechaHora: p.fecha_hora,
              cancha: p.cancha_asignada,
              parejaLocal: p.pareja_local_id ? {
                inscripcion_id: p.pareja_local_id,
                posicion_siembra: p.posicion_local ?? 0,
                label: getParejaLabel(p.pareja_local_id)
              } : null,
              parejaVisitante: p.pareja_visitante_id ? {
                inscripcion_id: p.pareja_visitante_id,
                posicion_siembra: p.posicion_visitante ?? 0,
                label: getParejaLabel(p.pareja_visitante_id)
              } : null
            };
          });

          return {
            zona: z,
            partidos: partidosDisplay
          };
        });

        setZonaGroups(groups);
      } catch (error) {
        console.error("Error cargando partidos para compartir:", error);
        toast.error("Error cargando los datos de las zonas");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [isOpen, torneoId, zonas]);

  const themeStyles = {
    "cyber-neon": {
      background: "linear-gradient(135deg, #240046 0%, #0f1016 50%, #10002b 100%)",
      titleColor: "#e0aaff", 
      cardStyle: {
        backgroundColor: "rgba(15, 16, 22, 0.9)",
        borderColor: "rgba(157, 78, 221, 0.4)",
      },
      vsColor: "rgba(255, 10, 84, 0.8)",
      textColorPrimary: "#f4f4f5",
      textColorMuted: "rgba(224, 170, 255, 0.6)",
      watermarkColor: "rgba(224, 170, 255, 0.4)",
    },
    "dark-sport": {
      background: "linear-gradient(135deg, #0a0a0f 0%, #16161a 60%, #0a0a0f 100%)",
      titleColor: "#ff0a54", 
      cardStyle: {
        backgroundColor: "rgba(22, 22, 26, 0.95)",
        borderColor: "rgba(255, 10, 84, 0.4)",
      },
      vsColor: "rgba(255, 10, 84, 0.8)",
      textColorPrimary: "#fdf8f6",
      textColorMuted: "rgba(255, 143, 163, 0.6)",
      watermarkColor: "rgba(255, 10, 84, 0.3)",
    },
  };

  const currentTheme = themeStyles[theme];

  const getMatchDateText = (p: PartidoDisplay) => {
    if (!p.fechaHora) return "A coordinar";
    try {
      const d = new Date(p.fechaHora);
      return format(d, "EEE dd MMM - HH:mm", { locale: es }).replace(".", "");
    } catch {
      return "Fecha inválida";
    }
  };

  const handleExport = async () => {
    if (!captureRef.current) return;
    try {
      setExporting(true);
      // Timeout to let fonts load
      await new Promise(r => setTimeout(r, 200));

      const dataUrl = await toPng(captureRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      });

      const link = document.createElement("a");
      link.download = `fixture-completo-${torneoNombre.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success("Imagen generada correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar la imagen");
    } finally {
      setExporting(false);
    }
  };

  // Dimensions
  const previewWidth = ratio === "story" ? 405 : 500;
  const previewHeight = ratio === "story" ? 720 : 500;
  const canvasWidth = ratio === "story" ? 1080 : 1080;
  const canvasHeight = ratio === "story" ? 1920 : 1080;
  const scale = previewWidth / canvasWidth;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 backdrop-blur border-border/50 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 md:p-6 border-b shrink-0 flex flex-row items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Share2 className="h-5 w-5 text-primary" />
              Fixture Completo - Zonas
            </DialogTitle>
            <DialogDescription>
              Genera una imagen con todos los partidos de las zonas.
            </DialogDescription>
          </div>
          <div className="flex gap-2 items-center !mt-0">
            <Select value={ratio} onValueChange={(v: AspectRatio) => setRatio(v)}>
              <SelectTrigger className="w-[120px] h-9 text-xs">
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="story">Story (9:16)</SelectItem>
                <SelectItem value="square">Post (1:1)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={theme} onValueChange={(v: ThemePreset) => setTheme(v)}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cyber-neon">Cyber Neon</SelectItem>
                <SelectItem value="dark-sport">Dark Sport</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleExport}
              disabled={exporting || loadingData}
              className="h-9 gap-2 bg-primary hover:bg-primary/90 text-white"
              size="sm"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Generando..." : "Descargar"}
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4 md:p-6 overflow-y-auto flex-1 grid md:grid-cols-12 gap-6 bg-muted/10">
          <div className="md:col-span-12 flex flex-col items-center justify-center bg-muted/30 rounded-xl border border-dashed p-4 md:min-h-[500px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              Vista Previa en Vivo ({ratio === "story" ? "Story 9:16" : "Post 1:1"})
            </span>

            {loadingData ? (
              <div className="flex flex-col items-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
                <p className="text-sm">Cargando partidos...</p>
              </div>
            ) : (
              <div
                style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                className="relative overflow-hidden shadow-2xl rounded-lg border border-black/35 select-none bg-black flex items-center justify-center shrink-0"
              >
                <div
                  ref={captureRef}
                  className="absolute top-0 left-0"
                  style={{
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    background: currentTheme.background,
                    fontFamily: "'Outfit', sans-serif",
                    color: currentTheme.textColorPrimary,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                    <PadelIdLogo size={800} />
                  </div>

                  <div className="relative h-full flex flex-col p-12">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 pr-6">
                        <PadelIdLogo size={56} />
                        <div>
                          <p className="text-sm font-black tracking-widest uppercase text-white/50 mb-0.5">Padel ID Tour</p>
                          <h1 className="text-3xl font-black italic text-white leading-none">
                            {torneoNombre}
                          </h1>
                        </div>
                      </div>
                      <div
                        className="text-right py-2 px-6 rounded-xl font-black text-2xl tracking-widest uppercase border border-white/20 bg-black/40 backdrop-blur-md"
                        style={{ color: currentTheme.titleColor }}
                      >
                        FIXTURE ZONAS
                      </div>
                    </div>

                    <div className={`flex-1 grid gap-x-8 gap-y-6 ${ratio === "story" ? "grid-cols-2 content-start" : "grid-cols-2 lg:grid-cols-3 content-start"} overflow-hidden`}>
                      {zonaGroups.map((zg) => (
                        <div key={zg.zona.id} className="flex flex-col gap-3">
                          <h2 
                            className="text-2xl font-black italic border-b-2 pb-1"
                            style={{ borderColor: currentTheme.titleColor, color: currentTheme.titleColor }}
                          >
                            ZONA {zg.zona.nombre}
                          </h2>
                          {zg.partidos.length === 0 ? (
                            <p className="text-sm" style={{ color: currentTheme.textColorMuted }}>Sin partidos</p>
                          ) : (
                            zg.partidos.map((p) => (
                              <div
                                key={p.id}
                                className="rounded-xl border flex flex-col p-3 shadow-lg"
                                style={{
                                  backgroundColor: currentTheme.cardStyle.backgroundColor,
                                  borderColor: currentTheme.cardStyle.borderColor,
                                }}
                              >
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: currentTheme.textColorMuted }}>
                                    {getMatchDateText(p)}
                                  </span>
                                  {p.cancha && (
                                    <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded text-white">
                                      {p.cancha}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 text-center">
                                    <p className="font-bold text-base leading-tight truncate">
                                      {p.parejaLocal ? p.parejaLocal.label : "A definir"}
                                    </p>
                                  </div>
                                  <div 
                                    className="px-2 py-0.5 rounded text-[10px] font-black italic"
                                    style={{ backgroundColor: currentTheme.vsColor, color: "white" }}
                                  >
                                    VS
                                  </div>
                                  <div className="flex-1 text-center">
                                    <p className="font-bold text-base leading-tight truncate">
                                      {p.parejaVisitante ? p.parejaVisitante.label : "A definir"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center text-sm font-bold opacity-70">
                      <span>padelid.com</span>
                      <span>© Padel ID • Todos los derechos reservados</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
