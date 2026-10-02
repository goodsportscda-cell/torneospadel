import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Loader2, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { toPng } from "html-to-image";

export type PartidoPlacaDia = {
  id: string;
  hora: string;
  cancha: string | null;
  local: string;
  visitante: string;
  torneo: string;
  fase: string;
};

type PaginaPlaca = { cancha: string; partidos: PartidoPlacaDia[]; parte: number; partes: number };

interface CompartirPartidosDelDiaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fecha: string;
  onFechaChange: (fecha: string) => void;
  clubNombre: string;
  partidos: PartidoPlacaDia[];
}

const CANVAS_WIDTH = 540;
const CANVAS_HEIGHT = 960;
const PARTIDOS_POR_PLACA = 4;

const fechaLegible = (fecha: string) => {
  if (!fecha) return "Fecha a confirmar";
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const nombreCancha = (cancha: string | null) => {
  const numero = cancha?.match(/\d+/)?.[0];
  return numero ? `Cancha ${numero}` : "Cancha a confirmar";
};

const PosterPartidos = forwardRef<HTMLDivElement, { pagina: PaginaPlaca; fecha: string; clubNombre: string }>(
  ({ pagina, fecha, clubNombre }, ref) => {
    const compacto = pagina.partidos.length >= 4;
    return (
      <div
        ref={ref}
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          padding: 30,
          boxSizing: "border-box",
          color: "#f8fafc",
          background: "radial-gradient(ellipse at 15% 0%, rgba(131,56,236,.30), transparent 42%), radial-gradient(ellipse at 100% 90%, rgba(0,245,212,.13), transparent 40%), linear-gradient(155deg,#080b12 0%,#111827 55%,#080b12 100%)",
          fontFamily: "Arial, sans-serif",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.13)", paddingBottom: 18 }}>
          <div>
            <div style={{ color: "#00f5d4", fontSize: 12, fontWeight: 900, letterSpacing: 3 }}>PADEL ID · FIXTURE</div>
            <div style={{ color: "rgba(255,255,255,.72)", fontSize: 15, fontWeight: 700, marginTop: 6 }}>{clubNombre || "Tu club"}</div>
          </div>
          <div style={{ border: "1px solid rgba(0,245,212,.45)", borderRadius: 20, padding: "8px 12px", color: "#00f5d4", fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>PARTIDOS DEL DÍA</div>
        </div>

        <div style={{ padding: "24px 2px 20px" }}>
          <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>Agenda de partidos</div>
          <div style={{ color: "#fff", fontSize: 33, lineHeight: 1.08, fontWeight: 900, marginTop: 8, textTransform: "capitalize" }}>{fechaLegible(fecha)}</div>
          <div style={{ width: 78, height: 4, borderRadius: 4, background: "linear-gradient(90deg,#8338ec,#00f5d4)", marginTop: 15 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 15, padding: "15px 17px", marginBottom: 15, background: "rgba(0,245,212,.09)", border: "1px solid rgba(0,245,212,.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MapPin size={22} color="#00f5d4" />
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>{pagina.cancha}</div>
          </div>
          <div style={{ color: "#9ca3af", fontSize: 13, fontWeight: 800 }}>{pagina.partidos.length} {pagina.partidos.length === 1 ? "PARTIDO" : "PARTIDOS"}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: compacto ? 8 : 11, flex: 1, minHeight: 0 }}>
          {pagina.partidos.map((partido, index) => (
            <div key={partido.id} style={{ borderRadius: 13, padding: compacto ? "10px 13px" : "13px 15px", background: "rgba(15,23,42,.82)", border: "1px solid rgba(255,255,255,.12)", borderLeft: "4px solid #8338ec" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: compacto ? 5 : 8 }}>
                <div style={{ color: "#00f5d4", fontSize: compacto ? 11 : 12, fontWeight: 900, letterSpacing: 1 }}>{partido.hora || "HORARIO A CONFIRMAR"}</div>
                <div style={{ color: "rgba(255,255,255,.55)", fontSize: 10, fontWeight: 800, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 290 }}>{partido.torneo}</div>
              </div>
              <div style={{ color: "#fff", fontSize: compacto ? 14 : 16, lineHeight: 1.25, fontWeight: 800 }}>{partido.local}</div>
              <div style={{ color: "rgba(255,255,255,.42)", fontSize: 9, fontWeight: 900, letterSpacing: 2, margin: "3px 0" }}>VS</div>
              <div style={{ color: "#fff", fontSize: compacto ? 14 : 16, lineHeight: 1.25, fontWeight: 800 }}>{partido.visitante}</div>
              {partido.fase && <div style={{ color: "rgba(255,255,255,.46)", fontSize: 10, marginTop: 5 }}>{partido.fase}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.13)", paddingTop: 13, marginTop: 15, color: "rgba(255,255,255,.45)", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
          <span>BUENOS PARTIDOS. BUENOS MOMENTOS.</span>
          {pagina.partes > 1 && <span>{pagina.parte}/{pagina.partes}</span>}
        </div>
      </div>
    );
  },
);
PosterPartidos.displayName = "PosterPartidos";

export function CompartirPartidosDelDiaDialog({ open, onOpenChange, fecha, onFechaChange, clubNombre, partidos }: CompartirPartidosDelDiaDialogProps) {
  const [paginaActual, setPaginaActual] = useState(0);
  const [generando, setGenerando] = useState(false);
  const capturaRef = useRef<HTMLDivElement>(null);

  const paginas = useMemo(() => {
    const grupos = new Map<string, PartidoPlacaDia[]>();
    for (const partido of partidos) {
      const cancha = nombreCancha(partido.cancha);
      grupos.set(cancha, [...(grupos.get(cancha) ?? []), partido]);
    }
    const gruposOrdenados = [...grupos.entries()].sort(([a], [b]) => {
      const numA = Number(a.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
      const numB = Number(b.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
      return numA - numB;
    });
    const paginasSinPartes = gruposOrdenados.flatMap(([cancha, partidosCancha]) => {
      const ordenados = [...partidosCancha].sort((a, b) => a.hora.localeCompare(b.hora));
      const partes = Math.ceil(ordenados.length / PARTIDOS_POR_PLACA);
      return Array.from({ length: partes }, (_, parte) => ({
        cancha,
        partidos: ordenados.slice(parte * PARTIDOS_POR_PLACA, (parte + 1) * PARTIDOS_POR_PLACA),
        parte: parte + 1,
        partes,
      }));
    });
    return paginasSinPartes;
  }, [partidos]);

  useEffect(() => setPaginaActual((pagina) => Math.min(pagina, Math.max(0, paginas.length - 1))), [paginas.length]);

  const descargarPlacas = async () => {
    if (!capturaRef.current || paginas.length === 0) return;
    setGenerando(true);
    const paginaOriginal = paginaActual;
    try {
      for (let indice = 0; indice < paginas.length; indice++) {
        setPaginaActual(indice);
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        if (!capturaRef.current) continue;
        const dataUrl = await toPng(capturaRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#080b12" });
        const link = document.createElement("a");
        const numeroCancha = paginas[indice].cancha.match(/\d+/)?.[0] ?? "sin-asignar";
        const parteArchivo = paginas[indice].partes > 1 ? `-parte-${paginas[indice].parte}-de-${paginas[indice].partes}` : "";
        link.download = `partidos-${fecha}-cancha-${numeroCancha}${parteArchivo}.png`;
        link.href = dataUrl;
        link.click();
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
      setPaginaActual(paginaOriginal);
      toast.success(paginas.length > 1 ? `Se generaron ${paginas.length} placas para historias` : "Placa para historia descargada");
    } catch (error) {
      console.error("No se pudo generar la placa de partidos del día", error);
      toast.error("No se pudo generar la placa. Intentá nuevamente.");
    } finally {
      setGenerando(false);
    }
  };

  const pagina = paginas[paginaActual];
  const previewScale = 0.38;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Placa de partidos del día</DialogTitle>
          <DialogDescription>Elegí la fecha y descargá historias por cancha. Cada placa incluye hasta cuatro partidos para que toda la información entre completa y legible.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_270px]">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fecha-placa-partidos" className="text-sm font-medium">Día de juego</label>
              <Input id="fecha-placa-partidos" type="date" value={fecha} onChange={(event) => onFechaChange(event.target.value)} />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              La placa separa los partidos por cancha e indica la hora, las parejas y el torneo. Si hay más de cuatro en una cancha, se descargan partes numeradas para incluirlos todos.
            </div>
            {paginas.length > 0 ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Button variant="outline" size="icon" onClick={() => setPaginaActual((p) => Math.max(0, p - 1))} disabled={paginaActual === 0 || generando} aria-label="Placa anterior"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-semibold">{pagina?.cancha} · Placa {paginaActual + 1} de {paginas.length}</span>
                <Button variant="outline" size="icon" onClick={() => setPaginaActual((p) => Math.min(paginas.length - 1, p + 1))} disabled={paginaActual >= paginas.length - 1 || generando} aria-label="Placa siguiente"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No hay partidos oficiales programados para esta fecha y selección.</div>
            )}
            <Button onClick={descargarPlacas} disabled={generando || paginas.length === 0} className="w-full gap-2">
              {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {generando ? "Generando placas..." : paginas.length > 1 ? `Descargar ${paginas.length} placas` : "Descargar historia"}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> Imagen vertical 9:16, lista para Instagram o WhatsApp.</p>
          </div>

          <div className="flex min-h-[390px] items-start justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30 p-3">
            {pagina ? (
              <div style={{ width: CANVAS_WIDTH * previewScale, height: CANVAS_HEIGHT * previewScale, overflow: "hidden", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.3)" }}>
                <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                  <PosterPartidos pagina={pagina} fecha={fecha} clubNombre={clubNombre} />
                </div>
              </div>
            ) : <div className="m-auto text-center text-xs text-muted-foreground">La vista previa aparecerá cuando haya partidos.</div>}
          </div>
        </div>

        {pagina && (
          <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
            <PosterPartidos ref={capturaRef} pagina={pagina} fecha={fecha} clubNombre={clubNombre} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
