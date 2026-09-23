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
import { Download, Share2, Sparkles, Trophy, X } from "lucide-react";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CompartirRankingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  torneo: {
    nombre: string;
    modalidad?: string | null;
    canchas_count?: number | null;
    desafio_semanas?: number | null;
  } | null;
  standings: any[];
  subtitulo?: string;
  esPuntosPorSet?: boolean;
}

type ThemePreset = "cyber-neon" | "dark-sport" | "luxury-gold";

export function CompartirRankingDialog({
  isOpen,
  onOpenChange,
  torneo,
  standings,
  subtitulo,
  esPuntosPorSet,
}: CompartirRankingDialogProps) {
  const [theme, setTheme] = useState<ThemePreset>("cyber-neon");
  const [exporting, setExporting] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const themeStyles = {
    "cyber-neon": {
      background: "linear-gradient(145deg, #07070c 0%, #150d24 50%, #080511 100%)",
      titleColor: "#9d4edd",
      accentGlow: "rgba(157, 78, 221, 0.4)",
      cardBg: "rgba(18, 12, 28, 0.75)",
      cardBorder: "rgba(157, 78, 221, 0.35)",
      pillElite: "bg-purple-950/60 border-purple-500/50 text-purple-300",
      pillDesafio: "bg-pink-950/60 border-pink-500/50 text-pink-300",
      pillBase: "bg-blue-950/60 border-blue-500/50 text-blue-300",
      ptsBadge: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_12px_rgba(157,78,221,0.5)]",
    },
    "dark-sport": {
      background: "linear-gradient(145deg, #050505 0%, #17070b 50%, #060204 100%)",
      titleColor: "#ff0a54",
      accentGlow: "rgba(255, 10, 84, 0.4)",
      cardBg: "rgba(22, 6, 12, 0.75)",
      cardBorder: "rgba(255, 10, 84, 0.35)",
      pillElite: "bg-red-950/60 border-red-500/50 text-red-300",
      pillDesafio: "bg-orange-950/60 border-orange-500/50 text-orange-300",
      pillBase: "bg-neutral-900/80 border-neutral-700/60 text-neutral-300",
      ptsBadge: "bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-[0_0_12px_rgba(255,10,84,0.5)]",
    },
    "luxury-gold": {
      background: "linear-gradient(145deg, #090909 0%, #1a1608 50%, #080702 100%)",
      titleColor: "#f59e0b",
      accentGlow: "rgba(245, 158, 11, 0.4)",
      cardBg: "rgba(24, 20, 10, 0.75)",
      cardBorder: "rgba(245, 158, 11, 0.35)",
      pillElite: "bg-amber-950/60 border-amber-500/50 text-amber-300",
      pillDesafio: "bg-yellow-950/60 border-yellow-500/50 text-yellow-300",
      pillBase: "bg-neutral-900/80 border-neutral-700/60 text-neutral-300",
      ptsBadge: "bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.5)]",
    },
  };

  const currentTheme = themeStyles[theme];

  const handleExport = async () => {
    if (!captureRef.current) return;
    try {
      setExporting(true);

      const dataUrl = await toPng(captureRef.current, {
        quality: 1,
        pixelRatio: 2.5,
        cacheBust: true,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      });

      // Try native share on mobile devices
      if (navigator.share && window.innerWidth < 768) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `ranking-${torneo?.nombre.replace(/\s+/g, "-").toLowerCase()}.png`, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Ranking Oficial - ${torneo?.nombre}`,
              text: `Mirá la tabla de posiciones oficial de ${torneo?.nombre} en Padel ID`,
            });
            toast.success("Placa compartida con éxito");
            return;
          }
        } catch (shareErr) {
          console.log("Fallback to download:", shareErr);
        }
      }

      // Download fallback
      const link = document.createElement("a");
      link.download = `ranking-${torneo?.nombre.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("Placa descargada correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar la imagen");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 backdrop-blur border-border/50 max-h-[92vh] flex flex-col">
        <DialogHeader className="p-4 md:p-6 border-b shrink-0 flex flex-row items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Share2 className="h-5 w-5 text-purple-400" />
              Placa de Posiciones para Redes
            </DialogTitle>
            <DialogDescription className="text-xs">
              Genera una imagen con el ranking acumulado lista para compartir en historias o estados de WhatsApp.
            </DialogDescription>
          </div>
          <div className="flex gap-2 items-center !mt-0">
            <Select value={theme} onValueChange={(v: ThemePreset) => setTheme(v)}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cyber-neon">Cyber Neon</SelectItem>
                <SelectItem value="dark-sport">Dark Sport</SelectItem>
                <SelectItem value="luxury-gold">Luxury Gold</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleExport} disabled={exporting} size="sm" className="h-9 gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium">
              {exporting ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" /> Generando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Descargar Placa
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

        <div className="overflow-y-auto p-4 md:p-6 bg-muted/30 flex-1 flex justify-center items-start">
          {/* Contenedor principal de la placa */}
          <div
            ref={captureRef}
            className="relative w-full max-w-[560px] overflow-hidden flex flex-col font-sans rounded-2xl shadow-2xl p-6"
            style={{
              background: currentTheme.background,
              color: "#ffffff",
              boxShadow: `0 0 40px ${currentTheme.accentGlow}`,
            }}
          >
            {/* Marca de agua de fondo */}
            <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center -rotate-45 z-0 opacity-[0.035]">
              <span className="text-[120px] font-black tracking-widest text-white uppercase">
                PADEL ID
              </span>
            </div>

            {/* Header: Logo & Branding */}
            <div className="flex items-center justify-between z-10 relative pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <PadelIdLogo className="w-9 h-9" />
                <div>
                  <span className="font-black text-white text-base tracking-tight block leading-none">
                    Padel ID
                  </span>
                  <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">
                    Tournament Platform
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border border-purple-500/40 bg-purple-950/40 text-purple-300">
                  {subtitulo || "Fase Regular"}
                </span>
              </div>
            </div>

            {/* Torneo Title */}
            <div className="py-4 text-center z-10 relative">
              <span className="text-[10px] font-extrabold tracking-widest uppercase block text-purple-400 mb-1">
                TABLA OFICIAL DE POSICIONES
              </span>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-white leading-tight">
                {torneo?.nombre}
              </h1>
            </div>

            {/* Standings List */}
            <div className="flex-1 flex flex-col gap-2 z-10 relative my-2">
              {standings.map((s, idx) => {
                const rank = idx + 1;
                const countCanchas = torneo?.canchas_count ?? 3;

                let courtGroup = "Base (C3)";
                let badgeClass = currentTheme.pillBase;

                if (torneo?.modalidad === "parejas") {
                  if (rank <= 2) {
                    courtGroup = "Élite (C1)";
                    badgeClass = currentTheme.pillElite;
                  } else if (rank <= 4) {
                    courtGroup = "Desafío (C2)";
                    badgeClass = currentTheme.pillDesafio;
                  } else {
                    courtGroup = "Base (C3)";
                    badgeClass = currentTheme.pillBase;
                  }
                } else {
                  if (rank <= 4) {
                    courtGroup = "Élite (C1)";
                    badgeClass = currentTheme.pillElite;
                  } else if (rank <= 8 && countCanchas >= 2) {
                    courtGroup = "Desafío (C2)";
                    badgeClass = currentTheme.pillDesafio;
                  } else {
                    courtGroup = "Base (C3)";
                    badgeClass = currentTheme.pillBase;
                  }
                }

                const isPodium1 = rank === 1;
                const isPodium2 = rank === 2;
                const isPodium3 = rank === 3;

                const playerName = torneo?.modalidad === "parejas"
                  ? `${s.jugador1?.apellido || ""} / ${s.jugador2?.apellido || ""}`
                  : `${s.apellido || ""}, ${s.nombre || ""}`;

                return (
                  <div
                    key={s.jugador_id || s.pareja_id || idx}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all"
                    style={{
                      backgroundColor: currentTheme.cardBg,
                      borderColor: isPodium1 ? "rgba(245, 158, 11, 0.5)" : currentTheme.cardBorder,
                    }}
                  >
                    {/* Position & Player */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <div className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: isPodium1 ? "rgba(245, 158, 11, 0.25)" : isPodium2 ? "rgba(148, 163, 184, 0.25)" : isPodium3 ? "rgba(180, 83, 9, 0.25)" : "rgba(255, 255, 255, 0.05)",
                          color: isPodium1 ? "#f59e0b" : isPodium2 ? "#cbd5e1" : isPodium3 ? "#f97316" : "#ffffff",
                          border: isPodium1 ? "1px solid rgba(245, 158, 11, 0.6)" : "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        {isPodium1 ? (
                          <Trophy className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        ) : (
                          `${rank}º`
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-white truncate leading-tight">
                          {playerName}
                        </span>
                        {!esPuntosPorSet && (
                          <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded font-semibold border w-fit mt-0.5 ${badgeClass}`}>
                            {courtGroup}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div className="hidden sm:flex flex-col text-[10px] text-white/60 font-mono">
                        <span>{s.setsGanados}-{s.setsPerdidos} sets</span>
                        <span className={s.difGames > 0 ? "text-emerald-400 font-bold" : s.difGames < 0 ? "text-rose-400 font-bold" : ""}>
                          {s.difGames > 0 ? `+${s.difGames}` : s.difGames} DG
                        </span>
                      </div>

                      <div className={`px-2.5 py-1 rounded-lg text-xs font-black min-w-[58px] text-center ${currentTheme.ptsBadge}`}>
                        {s.puntos} pts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50 z-10 relative">
              <span className="tracking-wide">
                Seguí los resultados en vivo en <strong className="text-white/80">Padel ID</strong>
              </span>
              <span>
                {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
