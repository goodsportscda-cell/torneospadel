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
      titleText: "text-emerald-400",
      accentBorder: "border-emerald-500/20",
      accentText: "text-emerald-300",
      accentBg: "bg-emerald-950/50",
      cardBg: "bg-[#091512]/90",
      cardBorder: "border-emerald-900/40",
      scoreBg: "bg-emerald-600 text-white",
      scoreBgLose: "bg-emerald-950/80 text-emerald-400/70",
      textPrimary: "text-zinc-100",
      textMuted: "text-emerald-400/60",
      lineColor: "#10b98133", // emerald-500 con opacity
      highlightBorder: "border-emerald-400 bg-emerald-950/40",
      championCard: "from-emerald-950/80 via-teal-900/80 to-emerald-950/80 border-emerald-400",
      watermarkText: "text-emerald-500/40",
    },
    "royal-gold": {
      background: "linear-gradient(135deg, #1c1917 0%, #0c0a09 60%, #1c1917 100%)",
      titleText: "text-amber-400",
      accentBorder: "border-amber-500/20",
      accentText: "text-amber-300",
      accentBg: "bg-amber-950/40",
      cardBg: "bg-[#171513]/90",
      cardBorder: "border-stone-800",
      scoreBg: "bg-amber-500 text-black font-bold",
      scoreBgLose: "bg-stone-900 text-amber-500/50",
      textPrimary: "text-stone-100",
      textMuted: "text-stone-400/70",
      lineColor: "#f59e0b2a",
      highlightBorder: "border-amber-500/80 bg-amber-950/20",
      championCard: "from-amber-950/70 via-stone-900/90 to-amber-950/70 border-amber-500",
      watermarkText: "text-amber-500/40",
    },
    "cyber-cyan": {
      background: "linear-gradient(135deg, #0f172a 0%, #020617 50%, #0f172a 100%)",
      titleText: "text-cyan-400",
      accentBorder: "border-cyan-500/20",
      accentText: "text-cyan-300",
      accentBg: "bg-cyan-950/40",
      cardBg: "bg-[#0b1329]/95",
      cardBorder: "border-cyan-950",
      scoreBg: "bg-cyan-500 text-slate-950 font-bold",
      scoreBgLose: "bg-slate-900 text-cyan-400/40",
      textPrimary: "text-slate-100",
      textMuted: "text-cyan-400/50",
      lineColor: "#06b6d433",
      highlightBorder: "border-cyan-400 bg-cyan-950/30",
      championCard: "from-cyan-950/80 via-slate-900/90 to-cyan-950/80 border-cyan-400",
      watermarkText: "text-cyan-400/40",
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
          padding: "48px 40px",
        }}
        className="flex flex-col justify-between font-sans text-white select-none relative overflow-hidden"
      >
        {/* Decoraciones del fondo (Grilla y círculos de luz) */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 dark:bg-emerald-500/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none"></div>

        {/* HEADER */}
        <div className="flex items-start justify-between border-b pb-6 z-10 border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-[0.2em] font-extrabold px-2.5 py-1 rounded bg-white/5 border border-white/10 text-white/70">
                {torneo?.tipo === "oficial" ? "Torneo Oficial" : "Torneo Especial"}
              </span>
              {torneo?.numero_fecha && (
                <span className={`text-[11px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded ${currentThemePreset.accentBg} border ${currentThemePreset.accentBorder} ${currentThemePreset.titleText}`}>
                  Fecha {torneo.numero_fecha}
                </span>
              )}
            </div>
            
            <h1 className="text-3xl font-black tracking-tight text-white leading-none mt-2">
              {torneo?.nombre}
            </h1>
            
            <div className="flex items-center gap-4 text-xs font-semibold text-white/50 mt-3.5">
              {(torneo?.categoria_libre || categoriaNombre) && (
                <span className={`flex items-center gap-1.5 ${currentThemePreset.accentText}`}>
                  🏆 Categoría: {torneo.categoria_libre || categoriaNombre}
                </span>
              )}
              {torneo?.sede && (
                <span className="flex items-center gap-1">
                  📍 {torneo.sede}
                </span>
              )}
            </div>
          </div>

          {/* Logo del Sitio */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 pr-4">
            <PadelIdLogo size={36} />
            <div className="text-left">
              <p className="text-sm font-black leading-none text-white tracking-tight">Padel <span className="text-primary">ID</span></p>
              <p className="text-[8px] text-white/40 uppercase tracking-widest font-bold mt-1">Anita Quiroga</p>
            </div>
          </div>
        </div>

        {/* BRACKET COLUMNS GRID */}
        <div className="flex-1 flex flex-row items-stretch justify-between gap-6 py-8 z-10 overflow-hidden">
          {rondasFiltradas.map(({ ronda, partidos: rondaPartidos }) => (
            <div key={ronda} className="flex flex-col flex-1 min-w-[200px] justify-between h-full">
              {/* Encabezado de la Ronda */}
              <div className="text-center pb-2 border-b border-white/5 mb-4">
                <span className={`text-xs font-black tracking-wider uppercase ${currentThemePreset.titleText}`}>
                  {NOMBRE_RONDA[ronda]}
                </span>
                <p className="text-[10px] text-white/30 font-medium mt-0.5">{rondaPartidos.length} {rondaPartidos.length === 1 ? 'partido' : 'partidos'}</p>
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
                      className={`rounded-xl p-3.5 space-y-2 border transition-all ${
                        p.ganador_id
                          ? currentThemePreset.highlightBorder
                          : `${currentThemePreset.cardBg} ${currentThemePreset.cardBorder}`
                      } shadow-lg`}
                    >
                      {/* Info del Partido (Programación) */}
                      {showSchedule && (p.fecha_hora || p.cancha) && !isFinished && (
                        <div className="flex items-center justify-between text-[10px] font-bold text-white/40 pb-1 border-b border-white/5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-primary/70 shrink-0" />
                            {p.fecha_hora ? formatFechaHora(p.fecha_hora) : "Pendiente"}
                          </span>
                          {p.cancha && (
                            <span className="flex items-center gap-1 truncate max-w-[90px]">
                              <MapPin className="h-3 w-3 text-primary/70 shrink-0" />
                              {p.cancha}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Parejas y Scores */}
                      <div className="space-y-1.5">
                        {/* Pareja Local */}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span
                            className={`truncate flex items-center gap-1.5 font-semibold ${
                              isFinished
                                ? localWinner
                                  ? "text-white font-bold"
                                  : "text-white/40"
                                : "text-white/80"
                            }`}
                          >
                            {localWinner && <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                            <span className="truncate">{getParejaName(p.pareja_local_id, p.ref_local)}</span>
                          </span>

                          {/* Sets Local */}
                          {showScores && sets.length > 0 && (
                            <div className="flex gap-0.5 shrink-0 font-mono">
                              {sets.map((s, idx) => (
                                <span
                                  key={idx}
                                  className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                                    s.games_local > s.games_visitante
                                      ? currentThemePreset.scoreBg
                                      : currentThemePreset.scoreBgLose
                                  }`}
                                >
                                  {s.games_local}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Pareja Visitante */}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span
                            className={`truncate flex items-center gap-1.5 font-semibold ${
                              isFinished
                                ? visiWinner
                                  ? "text-white font-bold"
                                  : "text-white/40"
                                : "text-white/80"
                            }`}
                          >
                            {visiWinner && <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                            <span className="truncate">{getParejaName(p.pareja_visitante_id, p.ref_visitante)}</span>
                          </span>

                          {/* Sets Visitante */}
                          {showScores && sets.length > 0 && (
                            <div className="flex gap-0.5 shrink-0 font-mono">
                              {sets.map((s, idx) => (
                                <span
                                  key={idx}
                                  className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                                    s.games_visitante > s.games_local
                                      ? currentThemePreset.scoreBg
                                      : currentThemePreset.scoreBgLose
                                  }`}
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
            <div className="flex flex-col w-[200px] justify-center items-center h-full">
              <div className="text-center pb-2 mb-4">
                <span className="text-xs font-black tracking-wider uppercase text-amber-400">
                  Campeón 🏆
                </span>
                <p className="text-[10px] text-white/30 font-medium mt-0.5">Finalizado</p>
              </div>

              <div className="flex-1 flex items-center justify-center">
                {campeonInfo ? (
                  <div
                    style={{ background: `linear-gradient(135deg, rgba(20,83,45,0.2) 0%, rgba(6,11,17,0.8) 100%)` }}
                    className={`rounded-2xl p-5 text-center border-2 ${currentThemePreset.championCard} shadow-2xl relative overflow-hidden w-full`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full blur-xl pointer-events-none"></div>
                    <Trophy className="h-10 w-10 text-amber-400 mx-auto mb-3 animate-pulse" />
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5">¡Ganador!</p>
                    <h3 className="text-sm font-black text-white leading-snug drop-shadow-md">
                      {campeonInfo.nombre}
                    </h3>
                  </div>
                ) : (
                  <div className={`rounded-2xl p-5 text-center border border-dashed ${currentThemePreset.cardBorder} ${currentThemePreset.cardBg} w-full py-8`}>
                    <Trophy className="h-8 w-8 text-white/10 mx-auto mb-2" />
                    <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider">En definición</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER / WATERMARK */}
        <div className="flex items-center justify-between border-t pt-4 z-10 border-white/5 text-[10px] font-bold">
          <span className={currentThemePreset.watermarkText}>
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
