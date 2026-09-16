import React, { useState, useRef } from "react";
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
import { Download, Check, X, Share2, Calendar, Sparkles } from "lucide-react";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CompartirFixtureIndividualDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  torneo: {
    nombre: string;
    modalidad?: string | null;
  } | null;
  fechaNum: number;
  partidos: any[];
}

type ThemePreset = "cyber-neon" | "dark-sport";

export function CompartirFixtureIndividualDialog({
  isOpen,
  onOpenChange,
  torneo,
  fechaNum,
  partidos,
}: CompartirFixtureIndividualDialogProps) {
  const [theme, setTheme] = useState<ThemePreset>("cyber-neon");
  const [exporting, setExporting] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const themeStyles = {
    "cyber-neon": {
      background: "linear-gradient(135deg, #0a0a0f 0%, #1a1025 50%, #0a0a0f 100%)",
      titleColor: "#9d4edd",
      cardStyle: {
        backgroundColor: "rgba(15, 10, 20, 0.7)",
        borderColor: "rgba(157, 78, 221, 0.3)",
      },
      vsColor: "rgba(255, 10, 84, 0.9)",
      textColorPrimary: "#ffffff",
      textColorMuted: "rgba(157, 78, 221, 0.7)",
      watermarkColor: "rgba(157, 78, 221, 0.15)",
    },
    "dark-sport": {
      background: "linear-gradient(135deg, #050505 0%, #120508 50%, #050505 100%)",
      titleColor: "#ff0a54",
      cardStyle: {
        backgroundColor: "rgba(20, 5, 10, 0.7)",
        borderColor: "rgba(255, 10, 84, 0.3)",
      },
      vsColor: "rgba(157, 78, 221, 0.9)",
      textColorPrimary: "#ffffff",
      textColorMuted: "rgba(255, 10, 84, 0.7)",
      watermarkColor: "rgba(255, 10, 84, 0.15)",
    },
  };

  const currentTheme = themeStyles[theme];

  // Group matches by "Cancha"
  const partidosPorCancha = partidos.reduce((acc, p) => {
    const cancha = p.cancha || "Sin Cancha";
    if (!acc[cancha]) acc[cancha] = [];
    acc[cancha].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  // Sort canchas
  const canchasOrdenadas = Object.keys(partidosPorCancha).sort((a, b) => {
    return a.localeCompare(b);
  });

  const getPlayerInitials = (pName?: string) => {
    if (!pName) return "?";
    return pName.substring(0, 2).toUpperCase();
  };

  const getPartnerName = (j1: any, j2: any) => {
    const n1 = j1 ? `${j1.nombre} ${j1.apellido}` : "?";
    const n2 = j2 ? `${j2.nombre} ${j2.apellido}` : "?";
    return `${n1} / ${n2}`;
  };

  const getMatchDateText = (p: any) => {
    if (!p.fecha_programada) return "A coordinar";
    try {
      const d = new Date(`${p.fecha_programada}T${p.hora_programada || "00:00:00"}`);
      return format(d, "EEE dd MMM - HH:mm", { locale: es }).replace(".", "");
    } catch {
      return "Fecha inválida";
    }
  };

  const handleExport = async () => {
    if (!captureRef.current) return;
    try {
      setExporting(true);
      
      // Render at a higher scale for better quality
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
      link.download = `fixture-fecha-${fechaNum}-${torneo?.nombre.replace(/\\s+/g, "-").toLowerCase()}.png`;
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 backdrop-blur border-border/50 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 md:p-6 border-b shrink-0 flex flex-row items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Share2 className="h-5 w-5 text-primary" />
              Compartir Fixture Fecha {fechaNum}
            </DialogTitle>
            <DialogDescription>
              Genera una imagen con los partidos de la fecha lista para compartir.
            </DialogDescription>
          </div>
          <div className="flex gap-2 items-center !mt-0">
            <Select value={theme} onValueChange={(v: ThemePreset) => setTheme(v)}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cyber-neon">Cyber Neon</SelectItem>
                <SelectItem value="dark-sport">Dark Sport</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleExport} disabled={exporting} size="sm" className="h-9 gap-2">
              {exporting ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" /> Generando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Descargar PNG
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-4 md:p-8 bg-muted/30 flex-1 flex justify-center items-start">
          {/* Contenedor principal de la imagen */}
          <div
            ref={captureRef}
            className="relative w-full max-w-[500px] overflow-hidden flex flex-col font-sans"
            style={{
              background: currentTheme.background,
              color: currentTheme.textColorPrimary,
              minHeight: "800px",
            }}
          >
            {/* Header */}
            <div className="p-6 pb-2 flex justify-between items-center z-10 relative">
              <div className="flex items-center gap-2">
                <PadelIdLogo className="w-8 h-8" />
                <span className="font-bold text-white tracking-tight" style={{ fontSize: "16px" }}>
                  Padel ID
                </span>
              </div>
              <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: currentTheme.titleColor }}>
                FECHA {fechaNum}
              </div>
            </div>

            {/* Titulo del torneo */}
            <div className="px-6 py-4 text-center z-10 relative">
              <h1 className="text-2xl font-black uppercase tracking-wide text-white">
                {torneo?.nombre}
              </h1>
            </div>

            {/* Watermark Logo */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 opacity-10 pointer-events-none"
              style={{ color: currentTheme.titleColor }}
            >
              <PadelIdLogo className="w-full h-full" />
            </div>

            <div className="px-6 pb-12 flex-1 flex flex-col gap-6 z-10 relative mt-2">
              {canchasOrdenadas.map((cancha, cIdx) => (
                <div key={cancha} className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="h-[1px] flex-1" style={{ backgroundColor: currentTheme.cardStyle.borderColor }}></div>
                    <span 
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: currentTheme.titleColor }}
                    >
                      {cancha}
                    </span>
                    <div className="h-[1px] flex-1" style={{ backgroundColor: currentTheme.cardStyle.borderColor }}></div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {partidosPorCancha[cancha].map((p, pIdx) => {
                      const p1Name = getPartnerName(p.jugador1, p.jugador2);
                      const p2Name = getPartnerName(p.jugador3, p.jugador4);
                      const dateText = getMatchDateText(p);

                      return (
                        <div 
                          key={p.id}
                          className="flex items-center justify-between rounded-lg border p-2 py-3"
                          style={{ 
                            backgroundColor: currentTheme.cardStyle.backgroundColor,
                            borderColor: currentTheme.cardStyle.borderColor
                          }}
                        >
                          {/* Pareja 1 */}
                          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                            <span className="text-[9px] font-bold text-right leading-tight flex-1 min-w-0 break-words uppercase">
                              {p1Name}
                            </span>
                            <div className="flex -space-x-2 shrink-0">
                              <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: currentTheme.titleColor, color: "black" }}>
                                {getPlayerInitials(p.jugador1?.apellido)}
                              </div>
                              <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: currentTheme.titleColor, color: "black" }}>
                                {getPlayerInitials(p.jugador2?.apellido)}
                              </div>
                            </div>
                          </div>

                          {/* Info Central (VS y Fecha) */}
                          <div 
                            className="mx-2 shrink-0 rounded-full flex flex-col items-center justify-center px-3 py-1.5 w-[80px] text-center"
                            style={{ backgroundColor: currentTheme.vsColor }}
                          >
                            <span className="text-[9px] font-bold text-black uppercase mb-0.5" style={{ textShadow: "0px 1px 2px rgba(255,255,255,0.3)" }}>
                              {dateText}
                            </span>
                            <span className="text-xs font-black text-white" style={{ textShadow: "0px 1px 4px rgba(0,0,0,0.5)" }}>
                              VS
                            </span>
                          </div>

                          {/* Pareja 2 */}
                          <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
                            <div className="flex -space-x-2 shrink-0">
                              <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: currentTheme.titleColor, color: "black" }}>
                                {getPlayerInitials(p.jugador3?.apellido)}
                              </div>
                              <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: currentTheme.titleColor, color: "black" }}>
                                {getPlayerInitials(p.jugador4?.apellido)}
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-left leading-tight flex-1 min-w-0 break-words uppercase">
                              {p2Name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-auto pb-4 pt-4 px-6 text-center z-10 relative">
              <div 
                className="flex items-center justify-center gap-1.5 opacity-80 text-[9px] font-bold tracking-widest uppercase"
                style={{ color: currentTheme.titleColor }}
              >
                <span>Padel ID</span>
                <span className="opacity-50">•</span>
                <span>Todos los derechos reservados</span>
                <span className="opacity-50">•</span>
                <span>padel-id.com</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
