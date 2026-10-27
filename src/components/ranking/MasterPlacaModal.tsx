import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Sparkles, Trophy, Users, Star, ShieldCheck } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { isCategoriaSuma } from "@/lib/ranking";
import padelIdLogo from "@/assets/new-padel-id-logo.jpg";

export type PlacaJugadorItem = {
  jugador_id: string;
  nombre: string;
  apellido: string;
  club?: string | null;
  puntos: number;
  torneos_jugados: number;
  posicion_general: number;
  posicion_master: number;
  orden_suplente?: number | null;
};

interface MasterPlacaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoriaNombre: string;
  categoriaGenero: string;
  anio: number;
  cupo: number;
  clasificados: PlacaJugadorItem[];
  suplentes: PlacaJugadorItem[];
  clubNombre?: string;
  clubLogoUrl?: string | null;
  jugadorDestacadoId?: string | null;
  modoInicial?: "categoria" | "individual";
}

export function MasterPlacaModal({
  open,
  onOpenChange,
  categoriaNombre,
  categoriaGenero,
  anio,
  cupo,
  clasificados,
  suplentes,
  clubNombre = "GOOD PADEL",
  clubLogoUrl,
  jugadorDestacadoId,
  modoInicial = "categoria",
}: MasterPlacaModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [modo, setModo] = useState<"categoria" | "individual">(
    jugadorDestacadoId ? modoInicial : "categoria"
  );

  const esSuma = isCategoriaSuma(categoriaNombre);
  const cupoEfectivo = esSuma ? Math.min(cupo || 8, 8) : cupo || 16;
  const topClasificados = clasificados.slice(0, cupoEfectivo);
  const top2Suplentes = suplentes.slice(0, 2);

  const jugadorDestacado = jugadorDestacadoId
    ? topClasificados.find((c) => c.jugador_id === jugadorDestacadoId)
    : null;

  const generoLabel =
    categoriaGenero === "caballeros"
      ? "CABALLEROS"
      : categoriaGenero === "damas"
      ? "DAMAS"
      : "MIXTO";

  const descargarPNG = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2.5,
        cacheBust: true,
        backgroundColor: "#090d16",
      });

      const safeCat = `${categoriaNombre}-${categoriaGenero}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const fileName =
        modo === "individual" && jugadorDestacado
          ? `pase-master-${jugadorDestacado.apellido.toLowerCase()}-${safeCat}-${anio}.png`
          : `clasificados-master-${safeCat}-${anio}.png`;

      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("¡Placa PNG descargada! Lista para subir a Instagram Stories o WhatsApp.");
    } catch (err) {
      console.error("Error generando placa PNG:", err);
      toast.error("No se pudo generar la imagen. Intentá nuevamente.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[94vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generador de Placa — Master de Diciembre {anio}
          </DialogTitle>
          <DialogDescription>
            Formato vertical 9:16 optimizado para Instagram Stories y Estados de WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {jugadorDestacado && (
          <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg">
            <Button
              type="button"
              size="sm"
              variant={modo === "individual" ? "default" : "ghost"}
              className="flex-1 text-xs font-bold"
              onClick={() => setModo("individual")}
            >
              Mi Pase Individual
            </Button>
            <Button
              type="button"
              size="sm"
              variant={modo === "categoria" ? "default" : "ghost"}
              className="flex-1 text-xs font-bold"
              onClick={() => setModo("categoria")}
            >
              Tabla Completa ({categoriaNombre})
            </Button>
          </div>
        )}

        {/* Contenedor de previsualización escalable */}
        <div className="flex justify-center overflow-x-auto py-2">
          <div
            ref={cardRef}
            style={{
              width: "420px",
              minHeight: "746px",
              background:
                "radial-gradient(circle at 50% 0%, #1e293b 0%, #090d16 55%, #05070c 100%)",
              color: "#ffffff",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
            className="relative rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl flex flex-col justify-between p-5 select-none shrink-0"
          >
            {/* Efectos de luz de fondo */}
            <div
              style={{
                position: "absolute",
                top: "-60px",
                right: "-60px",
                width: "200px",
                height: "200px",
                background: "radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-60px",
                left: "-60px",
                width: "220px",
                height: "220px",
                background: "radial-gradient(circle, rgba(227,6,19,0.18) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* HEADER */}
            <div className="relative z-10 text-center space-y-2 border-b border-white/10 pb-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={clubLogoUrl || padelIdLogo}
                    alt={clubNombre}
                    crossOrigin="anonymous"
                    className="h-9 w-9 rounded-lg object-cover border border-amber-400/40"
                  />
                  <div className="text-left">
                    <p className="text-[10px] font-black tracking-widest uppercase text-amber-400">
                      {clubNombre}
                    </p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">
                      Circuito Oficial {anio}
                    </p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-amber-400" />
                  Master Dic {anio}
                </div>
              </div>

              <div className="pt-1">
                <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400/90 font-bold">
                  CARRERA AL MASTER DE DICIEMBRE
                </p>
                <h2 className="text-2xl font-black tracking-tight uppercase text-white leading-tight mt-0.5">
                  {modo === "individual" && jugadorDestacado
                    ? "¡CLASIFICADO AL MASTER!"
                    : `CLASIFICADOS · ${categoriaNombre}`}
                </h2>
                <div className="inline-flex items-center gap-2 mt-1 px-3 py-0.5 rounded-full bg-white/5 border border-white/10">
                  <span className="text-[11px] font-extrabold tracking-widest uppercase text-slate-200">
                    {generoLabel} · {categoriaNombre.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold">
                    ({esSuma ? "TOP 8 TITULARES" : `TOP ${cupoEfectivo}`})
                  </span>
                </div>
              </div>
            </div>

            {/* BODY */}
            <div className="relative z-10 my-3 flex-1 flex flex-col justify-center">
              {modo === "individual" && jugadorDestacado ? (
                <div className="my-auto space-y-5 text-center px-2">
                  <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 shadow-xl shadow-amber-500/20">
                    <div className="w-full h-full bg-[#090d16] rounded-[14px] flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                        PUESTO MASTER
                      </span>
                      <span className="text-4xl font-black text-white leading-none mt-0.5">
                        #{jugadorDestacado.posicion_master}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-amber-400 font-bold">
                      Pase Oficial Confirmado
                    </p>
                    <h3 className="text-3xl font-black uppercase tracking-tight text-white">
                      {jugadorDestacado.apellido}, {jugadorDestacado.nombre}
                    </h3>
                    {jugadorDestacado.club && (
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                        {jugadorDestacado.club}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">Cupo Master</p>
                      <p className="text-xl font-black text-amber-400 mt-0.5">
                        #{jugadorDestacado.posicion_master}/{cupoEfectivo}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">Puntos Año</p>
                      <p className="text-xl font-black text-white mt-0.5">
                        {jugadorDestacado.puntos}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">Torneos</p>
                      <p className="text-xl font-black text-emerald-400 mt-0.5">
                        {jugadorDestacado.torneos_jugados}/7
                      </p>
                    </div>
                  </div>

                  {esSuma && (
                    <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 p-3 text-center">
                      <p className="text-xs font-extrabold text-amber-300 uppercase tracking-wide flex items-center justify-center gap-1.5">
                        <Users className="h-4 w-4" />+ Compañero/a a confirmar (Suma 8)
                      </p>
                      <p className="text-[10px] text-amber-200/80 mt-0.5">
                        El titular clasificado elige compañero/a respetando que ambas categorías sumen 8.
                      </p>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                    <ShieldCheck className="h-4 w-4" />
                    Requisito cumplido (Mín. 4 de 7 torneos del año)
                  </div>
                </div>
              ) : esSuma ? (
                /* DISEÑO SUMA 8: 1 COLUMNA CON LOS 8 CLASIFICADOS TITULARES + BADGE COMPAÑERO/A */
                <div className="space-y-2">
                  <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-1.5 text-center mb-2">
                    <p className="text-[10px] font-bold text-amber-300">
                      ★ Los 8 clasificados titulares eligen compañero/a respetando la suma de categoría = 8
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {Array.from({ length: 8 }).map((_, idx) => {
                      const item = topClasificados[idx];
                      const isHighlighted =
                        item && jugadorDestacadoId && item.jugador_id === jugadorDestacadoId;
                      return (
                        <div
                          key={item?.jugador_id ?? `empty-${idx}`}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                            isHighlighted
                              ? "bg-amber-500/25 border-amber-400"
                              : item
                              ? "bg-white/[0.05] border-white/10"
                              : "bg-white/[0.02] border-white/5 opacity-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${
                                idx < 3
                                  ? "bg-amber-400 text-slate-950"
                                  : "bg-white/10 text-amber-300"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-extrabold text-white truncate">
                                {item ? `${item.apellido}, ${item.nombre}` : "Vacante disponible"}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/30 text-[9px] font-semibold text-amber-300">
                                  + Compañero/a a confirmar (Suma 8)
                                </span>
                              </div>
                            </div>
                          </div>
                          {item && (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-amber-400 block leading-none">
                                {item.puntos} pts
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {item.torneos_jugados}/7 T
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* DISEÑO CATEGORÍA PURA: GRILLA 2 COLUMNAS CON LOS 16 CLASIFICADOS */
                <div className="grid grid-cols-2 gap-1.5">
                  {Array.from({ length: 16 }).map((_, idx) => {
                    const item = topClasificados[idx];
                    const isHighlighted =
                      item && jugadorDestacadoId && item.jugador_id === jugadorDestacadoId;
                    return (
                      <div
                        key={item?.jugador_id ?? `empty-${idx}`}
                        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                          isHighlighted
                            ? "bg-amber-500/25 border-amber-400"
                            : item
                            ? "bg-white/[0.05] border-white/10"
                            : "bg-white/[0.02] border-white/5 opacity-45"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                              idx < 3
                                ? "bg-amber-400 text-slate-950"
                                : "bg-white/10 text-amber-300"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-white truncate leading-tight">
                              {item ? `${item.apellido}, ${item.nombre}` : "Vacante"}
                            </p>
                            {item && (
                              <p className="text-[8.5px] text-slate-400 truncate leading-tight">
                                {item.torneos_jugados}/7 torneos
                              </p>
                            )}
                          </div>
                        </div>
                        {item && (
                          <span className="text-[10px] font-black text-amber-400 shrink-0">
                            {item.puntos}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER: SUPLENTES + BRANDING */}
            <div className="relative z-10 space-y-2.5 pt-2 border-t border-white/10">
              {modo === "categoria" && (
                <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
                      <Star className="h-2.5 w-2.5" /> Suplentes Oficiales (4+ torneos)
                    </span>
                    <span className="text-[8.5px] text-slate-400">Por orden de puntos</span>
                  </div>
                  {top2Suplentes.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">
                      Sin suplentes con 4+ torneos registrados por el momento.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {top2Suplentes.map((sup, sIdx) => (
                        <div
                          key={sup.jugador_id}
                          className="flex items-center justify-between bg-black/30 rounded-md px-2 py-1 border border-white/5"
                        >
                          <span className="text-[10px] text-slate-200 font-semibold truncate">
                            <strong className="text-amber-400">S{sIdx + 1}.</strong> {sup.apellido},{" "}
                            {sup.nombre}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 ml-1 shrink-0">
                            {sup.puntos} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5">
                <span className="font-bold text-slate-300">
                  Requisito: Mín. 4 de 7 torneos jugados en el año
                </span>
                <span className="font-black tracking-wider uppercase text-amber-400">
                  PADEL ID · {anio}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
          <Badge variant="outline" className="text-xs">
            {esSuma ? "Formato Suma 8 (8 titulares)" : `Formato Categoría Pura (${cupoEfectivo} cupos)`}
          </Badge>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cerrar
            </Button>
            <Button onClick={descargarPNG} disabled={downloading} className="flex-1 sm:flex-none gap-2 font-bold">
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar PNG
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

