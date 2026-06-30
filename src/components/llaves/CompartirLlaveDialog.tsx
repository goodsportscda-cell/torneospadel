import React, { useState, useMemo, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Trophy, 
  Download, 
  Copy, 
  Calendar, 
  MapPin, 
  Image as ImageIcon, 
  Sparkles, 
  Check, 
  X,
  Share2
} from "lucide-react";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { parseRef, NOMBRE_RONDA, ORDEN_RONDA, type RondaLlave } from "@/lib/llaves";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface CompartirLlaveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  torneo: {
    id: string;
    nombre: string;
    tipo?: string;
    categoria_libre?: string;
    categoria_id?: string;
    multiplicador_puntos?: number;
    numero_fecha?: number | null;
    sede?: string | null;
    premios?: string | null;
  } | null;
  categoriaNombre?: string;
  partidos: any[];
  setsLlave: Record<string, any[]>;
  inscripciones: any[];
}

type AspectRatio = "square" | "story";
type ThemePreset = "dark-emerald" | "royal-gold" | "cyber-cyan";

export function CompartirLlaveDialog({
  isOpen,
  onOpenChange,
  torneo,
  categoriaNombre,
  partidos,
  setsLlave,
  inscripciones,
}: CompartirLlaveDialogProps) {
  const [ratio, setRatio] = useState<AspectRatio>("square");
  const [theme, setTheme] = useState<ThemePreset>("dark-emerald");
  const [showSchedule, setShowSchedule] = useState(true);
  const [showScores, setShowScores] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);

  // Mapea inscripcion_id a label de parejas
  const getParejaName = (id: string | null, ref: string | null) => {
    if (!id) {
      if (!ref) return "— por definir —";
      const parsed = parseRef(ref);
      if (parsed.tipo === "clasificado") return `${parsed.posicion}° Zona ${parsed.zona}`;
      if (parsed.tipo === "ganador") return `Ganador P${parsed.numeroPartido}`;
      if (parsed.tipo === "manual") return parsed.label;
      return `(${ref})`;
    }
    const ins = inscripciones.find((x) => x.id === id);
    if (!ins) return "?";
    const j1 = ins.jugador1?.apellido || ins.jugador1?.nombre || "?";
    const j2 = ins.jugador2?.apellido || ins.jugador2?.nombre || "?";
    return `${j1} / ${j2}`;
  };

  // Agrupar y ordenar partidos por ronda
  const rondasDisponibles = useMemo(() => {
    const map = new Map<RondaLlave, any[]>();
    partidos.forEach((p) => {
      const arr = map.get(p.ronda as RondaLlave) ?? [];
      arr.push(p);
      map.set(p.ronda as RondaLlave, arr);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => ORDEN_RONDA[a] - ORDEN_RONDA[b])
      .map(([ronda, list]) => ({
        ronda,
        partidos: list.sort((a, b) => a.numero - b.numero),
      }));
  }, [partidos]);

  // Selección inteligente de ronda mínima inicial por defecto
  const [minRonda, setMinRonda] = useState<RondaLlave>(() => {
    if (rondasDisponibles.length <= 3) {
      return rondasDisponibles[0]?.ronda || "final";
    }
    // Si hay más de 3 rondas (ej. octavos, cuartos, semis, final), mostrar desde cuartos por defecto
    const indexCuartos = rondasDisponibles.findIndex(r => r.ronda === "cuartos");
    if (indexCuartos !== -1) {
      return "cuartos";
    }
    const indexSemis = rondasDisponibles.findIndex(r => r.ronda === "semifinal");
    if (indexSemis !== -1) {
      return "semifinal";
    }
    return rondasDisponibles[0]?.ronda || "final";
  });

  // Filtrar las rondas según la selección
  const rondasFiltradas = useMemo(() => {
    const minIdx = ORDEN_RONDA[minRonda];
    return rondasDisponibles.filter((r) => ORDEN_RONDA[r.ronda] >= minIdx);
  }, [rondasDisponibles, minRonda]);

  // Encontrar al Campeón si ya finalizó la final
  const campeonInfo = useMemo(() => {
    const finalMatch = partidos.find((p) => p.ronda === "final");
    if (finalMatch && finalMatch.estado === "finalizado" && finalMatch.ganador_id) {
      return {
        id: finalMatch.ganador_id,
        nombre: getParejaName(finalMatch.ganador_id, null),
      };
    }
    return null;
  }, [partidos, inscripciones]);

  // Definir temas (estilos inline rígidos para garantizar renderizado idéntico con html2canvas)
  const themeStyles = {
    "dark-emerald": {
      background: "linear-gradient(135deg, #022c22 0%, #060b11 50%, #021a14 100%)",
      titleColor: "#34d399", // emerald-400
      accentBgColor: "rgba(2, 44, 34, 0.5)",
      accentBorderColor: "rgba(16, 185, 129, 0.2)",
      accentTextColor: "#a7f3d0", // emerald-300
      cardStyle: {
        backgroundColor: "rgba(9, 21, 18, 0.9)",
        borderColor: "rgba(6, 95, 70, 0.4)",
      },
      highlightCardStyle: {
        backgroundColor: "rgba(2, 44, 34, 0.4)",
        borderColor: "#34d399",
      },
      scoreWinStyle: {
        backgroundColor: "#10b981",
        color: "#ffffff",
      },
      scoreLoseStyle: {
        backgroundColor: "rgba(2, 44, 34, 0.8)",
        color: "rgba(52, 211, 153, 0.7)",
      },
      textColorPrimary: "#f4f4f5",
      textColorMuted: "rgba(52, 211, 153, 0.6)",
      lineColor: "#10b98133",
      championCardStyle: {
        background: "linear-gradient(135deg, rgba(2, 44, 34, 0.8) 0%, rgba(13, 148, 136, 0.4) 50%, rgba(2, 44, 34, 0.8) 100%)",
        borderColor: "#34d399",
      },
      watermarkColor: "rgba(16, 185, 129, 0.4)",
    },
    "royal-gold": {
      background: "linear-gradient(135deg, #1c1917 0%, #0c0a09 60%, #1c1917 100%)",
      titleColor: "#fbbf24", // amber-400
      accentBgColor: "rgba(120, 53, 4, 0.4)",
      accentBorderColor: "rgba(245, 158, 11, 0.2)",
      accentTextColor: "#fde68a", // amber-300
      cardStyle: {
        backgroundColor: "rgba(23, 21, 19, 0.9)",
        borderColor: "#2e2a24",
      },
      highlightCardStyle: {
        backgroundColor: "rgba(120, 53, 4, 0.2)",
        borderColor: "#fbbf24",
      },
      scoreWinStyle: {
        backgroundColor: "#f59e0b",
        color: "#000000",
        fontWeight: "bold" as const,
      },
      scoreLoseStyle: {
        backgroundColor: "#1c1917",
        color: "rgba(245, 158, 11, 0.5)",
      },
      textColorPrimary: "#f5f5f4",
      textColorMuted: "rgba(168, 162, 158, 0.7)",
      lineColor: "#f59e0b2a",
      championCardStyle: {
        background: "linear-gradient(135deg, rgba(120, 53, 4, 0.7) 0%, rgba(28, 25, 23, 0.9) 60%, rgba(120, 53, 4, 0.7) 100%)",
        borderColor: "#fbbf24",
      },
      watermarkColor: "rgba(245, 158, 11, 0.4)",
    },
    "cyber-cyan": {
      background: "linear-gradient(135deg, #0f172a 0%, #020617 50%, #0f172a 100%)",
      titleColor: "#22d3ee", // cyan-400
      accentBgColor: "rgba(8, 47, 73, 0.4)",
      accentBorderColor: "rgba(6, 182, 212, 0.2)",
      accentTextColor: "#67e8f9", // cyan-300
      cardStyle: {
        backgroundColor: "rgba(11, 19, 41, 0.95)",
        borderColor: "#0f172a",
      },
      highlightCardStyle: {
        backgroundColor: "rgba(8, 47, 73, 0.3)",
        borderColor: "#22d3ee",
      },
      scoreWinStyle: {
        backgroundColor: "#06b6d4",
        color: "#0f172a",
        fontWeight: "bold" as const,
      },
      scoreLoseStyle: {
        backgroundColor: "#0f172a",
        color: "rgba(34, 211, 238, 0.4)",
      },
      textColorPrimary: "#f1f5f9",
      textColorMuted: "rgba(34, 211, 238, 0.5)",
      lineColor: "#06b6d433",
      championCardStyle: {
        background: "linear-gradient(135deg, rgba(8, 47, 73, 0.8) 0%, rgba(15, 23, 42, 0.9) 60%, rgba(8, 47, 73, 0.8) 100%)",
        borderColor: "#22d3ee",
      },
      watermarkColor: "rgba(6, 182, 212, 0.4)",
    },
  }[theme];

  const currentThemePreset = themeStyles;

  // Lógica de exportación
  const exportarImagen = async (action: "download" | "copy") => {
    if (!captureRef.current) return;
    setExporting(true);

    const toastId = toast.loading(
      action === "download" ? "Generando imagen..." : "Copiando al portapapeles..."
    );

    try {
      // Configuraciones óptimas para html2canvas (evita bordes pixelados y asegura CORS)
      const canvas = await html2canvas(captureRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // Calidad 2x para redes sociales
        backgroundColor: null,
        logging: false,
      });

      if (action === "download") {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        const categoryLabel = torneo?.categoria_libre || categoriaNombre || "categoria";
        link.download = `bracket-${torneo?.nombre.toLowerCase().replace(/\s+/g, "-")}-${categoryLabel.toLowerCase().replace(/\s+/g, "-")}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Imagen descargada con éxito!", { id: toastId });
      } else {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            toast.error("Error al generar la imagen", { id: toastId });
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            setCopied(true);
            toast.success("Imagen copiada al portapapeles!", { id: toastId });
            setTimeout(() => setCopied(false), 2000);
          } catch (err) {
            console.error("Clipboard write failed: ", err);
            // Fallback si el navegador bloquea la API del portapapeles
            const dataUrl = canvas.toDataURL("image/png");
            const tempInput = document.createElement("input");
            tempInput.value = dataUrl;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
            toast.error("Tu navegador no soporta copiado directo de imágenes. Descargala en su lugar.", { id: toastId });
          }
        }, "image/png");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al procesar la imagen", { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // Formato para mostrar fecha y hora corta en la imagen
  const formatFechaHora = (isoString: string | null) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString("es-AR", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(".", ""); // Quita el punto del día ej: "sáb."
  };

  // Renderizar la estructura del Cuadro (reutilizada para el canvas off-screen y la vista previa)
  const renderBracketContent = (isExportSize: boolean) => {
    const isSquare = ratio === "square";
    
    // Altura fija del contenedor según ratio
    const containerHeight = isSquare ? "1080px" : "1920px";
    
    return (
      <div
        style={{
          width: "1080px",
          height: containerHeight,
          background: currentThemePreset.background,
          padding: "54px 44px",
        }}
        className="flex flex-col justify-between font-sans text-white select-none relative overflow-hidden"
      >
        {/* Decoraciones del fondo (Grilla y círculos de luz) */}
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
            width: "500px",
            height: "500px",
            borderRadius: "9999px",
            backgroundColor: "rgba(16, 185, 129, 0.04)",
            filter: "blur(120px)",
            pointerEvents: "none",
          }}
        ></div>
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            right: "-10%",
            width: "500px",
            height: "500px",
            borderRadius: "9999px",
            backgroundColor: "rgba(59, 130, 246, 0.04)",
            filter: "blur(120px)",
            pointerEvents: "none",
          }}
        ></div>

        {/* HEADER */}
        <div className="flex items-center justify-between border-b pb-6 z-10 border-white/10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span
                style={{ letterSpacing: '0.2em' }}
                className="text-xs uppercase font-extrabold px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white/80"
              >
                {torneo?.tipo === "oficial" ? "Torneo Oficial" : "Torneo Especial"}
              </span>
              {torneo?.numero_fecha && (
                <span
                  style={{
                    backgroundColor: currentThemePreset.accentBgColor,
                    borderColor: currentThemePreset.accentBorderColor,
                    color: currentThemePreset.titleColor,
                    letterSpacing: '0.1em',
                  }}
                  className="text-xs uppercase font-extrabold px-3 py-1 rounded border"
                >
                  Fecha {torneo.numero_fecha}
                </span>
              )}
            </div>
            
            <h1 className="text-5xl font-black tracking-tight text-white leading-none mt-3.5">
              {torneo?.nombre}
            </h1>
            
            <div className="flex items-center gap-6 text-base font-bold text-white/60 mt-4">
              {(torneo?.categoria_libre || categoriaNombre) && (
                <span style={{ color: currentThemePreset.accentTextColor }} className="flex items-center gap-2">
                  🏆 Categoría: {torneo.categoria_libre || categoriaNombre}
                </span>
              )}
              {torneo?.sede && (
                <span className="flex items-center gap-1.5">
                  📍 {torneo.sede}
                </span>
              )}
            </div>
          </div>

          {/* Logo del Sitio */}
          <div className="flex items-center gap-3.5 bg-white/5 border border-white/10 rounded-2xl p-3.5 pr-5">
            <PadelIdLogo size={52} />
            <div className="text-left">
              <p className="text-lg font-black leading-none text-white tracking-tight">Padel <span className="text-primary">ID</span></p>
              <p style={{ fontSize: '10px' }} className="text-white/40 uppercase tracking-widest font-extrabold mt-1.5">Anita Quiroga</p>
            </div>
          </div>
        </div>

        {/* BRACKET COLUMNS GRID */}
        <div className="flex-1 flex flex-row items-stretch justify-between gap-6 py-8 z-10 overflow-hidden">
          {rondasFiltradas.map(({ ronda, partidos: rondaPartidos }) => (
            <div key={ronda} style={{ minWidth: '200px' }} className="flex flex-col flex-1 justify-between h-full">
              {/* Encabezado de la Ronda */}
              <div className="text-center pb-2 border-b border-white/5 mb-4">
                <span style={{ color: currentThemePreset.titleColor }} className="text-base font-extrabold tracking-widest uppercase">
                  {NOMBRE_RONDA[ronda]}
                </span>
                <p className="text-xs text-white/40 font-semibold mt-1">{rondaPartidos.length} {rondaPartidos.length === 1 ? 'partido' : 'partidos'}</p>
              </div>

              {/* Contenedor Vertical de Partidos */}
              <div className="flex-1 flex flex-col justify-around py-4">
                {rondaPartidos.map((p) => {
                  const localWinner = p.ganador_id && p.ganador_id === p.pareja_local_id;
                  const visiWinner = p.ganador_id && p.ganador_id === p.pareja_visitante_id;
                  const sets = setsLlave[p.id] ?? [];
                  const isFinished = p.estado === "finalizado";

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '16px 12px',
                        ...(p.ganador_id ? currentThemePreset.highlightCardStyle : currentThemePreset.cardStyle)
                      }}
                      className="rounded-xl space-y-3 border shadow-lg"
                    >
                      {/* Info del Partido (Programación) */}
                      {showSchedule && (p.fecha_hora || p.cancha) && !isFinished && (
                        <div style={{ paddingBottom: '6px' }} className="flex items-center justify-between text-xs font-bold text-white/50 border-b border-white/5">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                            {p.fecha_hora ? formatFechaHora(p.fecha_hora) : "Pendiente"}
                          </span>
                          {p.cancha && (
                            <span style={{ maxWidth: '110px' }} className="flex items-center gap-1.5 truncate">
                              <MapPin className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                              {p.cancha}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Parejas y Scores */}
                      <div className="space-y-2.5">
                        {/* Pareja Local Row */}
                        <div style={{ minHeight: '34px' }} className="flex items-center gap-2.5 min-w-0 py-0.5">
                          <div
                            className={`flex items-center gap-2 font-bold min-w-0 flex-1 ${
                              isFinished
                                ? localWinner
                                  ? "text-white font-extrabold"
                                  : "text-white/60"
                                : "text-white/95"
                            }`}
                          >
                            {localWinner && <Trophy className="h-4 w-4 text-amber-400 shrink-0" />}
                            <span style={{ fontSize: '18px', fontWeight: '800' }} className="truncate flex-1 text-left leading-tight">
                              {getParejaName(p.pareja_local_id, p.ref_local)}
                            </span>
                          </div>

                          {/* Sets Local */}
                          {showScores && sets.length > 0 && (
                            <div className="flex gap-1 shrink-0 font-mono select-none">
                              {sets.map((s, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    fontSize: '15px',
                                    ...(s.games_local > s.games_visitante
                                      ? currentThemePreset.scoreWinStyle
                                      : currentThemePreset.scoreLoseStyle)
                                  }}
                                  className="flex items-center justify-center rounded font-extrabold"
                                >
                                  {s.games_local}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Pareja Visitante Row */}
                        <div style={{ minHeight: '34px' }} className="flex items-center gap-2.5 min-w-0 py-0.5">
                          <div
                            className={`flex items-center gap-2 font-bold min-w-0 flex-1 ${
                              isFinished
                                ? visiWinner
                                  ? "text-white font-extrabold"
                                  : "text-white/60"
                                : "text-white/95"
                            }`}
                          >
                            {visiWinner && <Trophy className="h-4 w-4 text-amber-400 shrink-0" />}
                            <span style={{ fontSize: '18px', fontWeight: '800' }} className="truncate flex-1 text-left leading-tight">
                              {getParejaName(p.pareja_visitante_id, p.ref_visitante)}
                            </span>
                          </div>

                          {/* Sets Visitante */}
                          {showScores && sets.length > 0 && (
                            <div className="flex gap-1 shrink-0 font-mono select-none">
                              {sets.map((s, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    fontSize: '15px',
                                    ...(s.games_visitante > s.games_local
                                      ? currentThemePreset.scoreWinStyle
                                      : currentThemePreset.scoreLoseStyle)
                                  }}
                                  className="flex items-center justify-center rounded font-extrabold"
                                >
                                  {s.games_visitante}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Columna especial de Campeón (Si está la final seleccionada) */}
          {minRonda !== "final" && (
            <div style={{ width: '220px' }} className="flex flex-col justify-center items-center h-full">
              <div className="text-center pb-2 mb-4">
                <span className="text-base font-extrabold tracking-widest uppercase text-amber-400">
                  Campeón 🏆
                </span>
                <p className="text-xs text-white/40 font-semibold mt-1">Finalizado</p>
              </div>

              <div className="flex-1 flex items-center justify-center">
                {campeonInfo ? (
                  <div
                    style={{
                      ...currentThemePreset.championCardStyle,
                    }}
                    className="rounded-2xl p-6 text-center border-2 shadow-2xl relative overflow-hidden w-full"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full blur-xl pointer-events-none"></div>
                    <Trophy className="h-14 w-14 text-amber-400 mx-auto mb-4 animate-pulse" />
                    <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">¡Ganador!</p>
                    <h3 className="text-base font-black text-white leading-snug drop-shadow-md">
                      {campeonInfo.nombre}
                    </h3>
                  </div>
                ) : (
                  <div
                    style={{
                      borderColor: currentThemePreset.cardStyle.borderColor,
                      backgroundColor: currentThemePreset.cardStyle.backgroundColor,
                    }}
                    className="rounded-2xl p-6 text-center border border-dashed w-full py-10"
                  >
                    <Trophy className="h-12 w-12 text-white/10 mx-auto mb-3" />
                    <p className="text-xs font-bold text-white/30 uppercase tracking-wider">En definición</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER / WATERMARK */}
        <div className="flex items-center justify-between border-t pt-4 z-10 border-white/5 text-sm font-bold">
          <span style={{ color: currentThemePreset.watermarkColor }}>
            padel-id.com • Anita Quiroga
          </span>
          <span className="text-white/20">
            {new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long" })}
          </span>
        </div>
      </div>
    );
  };

  // Calcular las dimensiones de la vista previa según la relación de aspecto
  const scale = ratio === "square" ? 0.32 : 0.22;
  const previewWidth = 1080 * scale;
  const previewHeight = (ratio === "square" ? 1080 : 1920) * scale;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-5 overflow-hidden flex flex-col md:grid md:grid-cols-12 gap-5 max-h-[90vh]">
        
        {/* Lado Izquierdo: Configuración (4 columnas en md) */}
        <div className="md:col-span-5 flex flex-col justify-between space-y-5 pr-2 md:border-r border-muted md:h-full">
          <div className="space-y-4">
            <DialogHeader className="p-0">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Generar Imagen para Redes
              </DialogTitle>
              <DialogDescription className="text-xs">
                Personalizá y descargá el fixture del torneo para subir a tus historias o posts.
              </DialogDescription>
            </DialogHeader>

            {/* Ajustes de Imagen */}
            <div className="space-y-3.5 pt-2">
              {/* Selector de Relación de Aspecto */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Formato (Redes)</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={ratio === "square" ? "default" : "outline"}
                    size="sm"
                    className="text-xs font-semibold h-9"
                    onClick={() => setRatio("square")}
                  >
                    <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                    Post (Cuadrado 1:1)
                  </Button>
                  <Button
                    type="button"
                    variant={ratio === "story" ? "default" : "outline"}
                    size="sm"
                    className="text-xs font-semibold h-9"
                    onClick={() => setRatio("story")}
                  >
                    <Share2 className="h-3.5 w-3.5 mr-1.5 rotate-90" />
                    Historia (Vertical 9:16)
                  </Button>
                </div>
              </div>

              {/* Selector de Tema */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tema de Color</label>
                <Select value={theme} onValueChange={(val: ThemePreset) => setTheme(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark-emerald">Esmeralda (Anita Quiroga Brand)</SelectItem>
                    <SelectItem value="royal-gold">Oro Imperial (Premium Black)</SelectItem>
                    <SelectItem value="cyber-cyan">Cyber Cyan (Futurista)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de Ronda Mínima */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Instancia Inicial</label>
                <Select
                  value={minRonda}
                  onValueChange={(val: RondaLlave) => setMinRonda(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rondasDisponibles.map(({ ronda }) => (
                      <SelectItem key={ronda} value={ronda}>
                        Ver desde {NOMBRE_RONDA[ronda]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Opciones de Visualización */}
              <div className="space-y-2 pt-2 border-t">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Detalles a mostrar</label>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showSchedule"
                    checked={showSchedule}
                    onCheckedChange={(checked) => setShowSchedule(!!checked)}
                  />
                  <label
                    htmlFor="showSchedule"
                    className="text-xs font-medium leading-none cursor-pointer select-none"
                  >
                    Horarios y Canchas
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showScores"
                    checked={showScores}
                    onCheckedChange={(checked) => setShowScores(!!checked)}
                  />
                  <label
                    htmlFor="showScores"
                    className="text-xs font-medium leading-none cursor-pointer select-none"
                  >
                    Resultados de Sets
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="space-y-2 pt-4 md:pt-0">
            <Button
              className="w-full font-semibold h-10 gap-2"
              onClick={() => exportarImagen("download")}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              Descargar Imagen (PNG)
            </Button>
            
            <Button
              variant="outline"
              className="w-full font-semibold h-10 gap-2"
              onClick={() => exportarImagen("copy")}
              disabled={exporting}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copiado al Portapapeles!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar al Portapapeles
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Lado Derecho: Live Preview (7 columnas en md) */}
        <div className="md:col-span-7 flex flex-col items-center justify-center bg-muted/30 rounded-xl border border-dashed p-4 md:h-[480px]">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
            Vista previa interactiva
          </span>

          <div
            style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
            className="relative overflow-hidden shadow-2xl rounded-lg border border-black/35 select-none bg-black flex items-center justify-center shrink-0"
          >
            {/* Elemento que duplicamos en escala para renderizar en pantalla */}
            <div
              style={{
                transform: `scale(${scale})`,
                width: "1080px",
                height: ratio === "square" ? "1080px" : "1920px",
              }}
              className="origin-top-left absolute top-0 left-0 shrink-0 pointer-events-none"
            >
              {renderBracketContent(false)}
            </div>
          </div>
        </div>

        {/* ELEMENTO OCULTO OFF-SCREEN DE EXPORTACIÓN (html2canvas leerá este exacto pixel element) */}
        <div className="absolute left-[-9999px] top-[-9999px] pointer-events-none">
          <div ref={captureRef} style={{ width: "1080px", overflow: "hidden" }} className="shrink-0">
            {renderBracketContent(true)}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
