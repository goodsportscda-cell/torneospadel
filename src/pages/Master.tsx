import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Download, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { useClubBrand } from "@/hooks/useClubBrand";
import {
  isAscenso,
  construirContextoAscensosYTorneos,
  aplicarReglasMaster,
  getCupoDefaultCategoria,
  isCategoriaSuma,
  TORNEOS_REQUERIDOS_MASTER,
  TORNEOS_TOTALES_ANIO,
} from "@/lib/ranking";
import { MasterPlacaModal, type PlacaJugadorItem } from "@/components/ranking/MasterPlacaModal";
import padelIdLogo from "@/assets/new-padel-id-logo.jpg";

// Convierte una imagen importada a dataURL para incrustarla en el PDF
const loadImageAsDataURL = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas ctx"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

type Categoria = { id: string; nombre: string; genero: string; orden: number };

type ClasificadoRow = {
  jugador_id: string;
  apellido: string;
  nombre: string;
  club: string | null;
  puntos: number;
  torneos_jugados: number;
  posicion_general: number;
  posicion_master: number;
  orden_suplente?: number | null;
};

type CategoriaMaster = {
  categoria: Categoria;
  cupos: number;
  clasificados: ClasificadoRow[];
  suplentes: ClasificadoRow[];
};

const labelGenero = (g: string) =>
  g === "caballeros" ? "Caballeros" : g === "damas" ? "Damas" : "Mixto";

export default function Master() {
  const clubBrand = useClubBrand();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<CategoriaMaster[]>([]);
  const [placaCat, setPlacaCat] = useState<CategoriaMaster | null>(null);
  const anio = new Date().getFullYear();

  const cargar = async () => {
    setLoading(true);
    const [{ data: cats }, { data: cupos }, { data: ascensos }] = await Promise.all([
      supabase
        .from("categorias")
        .select("id, nombre, genero, orden")
        .eq("activa", true)
        .order("orden"),
      supabase.from("cupos_master").select("categoria_id, cupos"),
      supabase
        .from("ascensos")
        .select(
          "jugador_id, puntos_transferidos, categoria_destino_id, categoria_origen_id, created_at, fecha"
        )
        .eq("anio", anio),
    ]);

    let ranking: any[] = [];
    const { data: rData, error: rErr } = await (supabase as any)
      .from("ranking_jugadores")
      .select("jugador_id, puntos, torneo_id, categoria_id, instancia, master_status")
      .eq("anio", anio);
    if (rErr && String(rErr.message || "").includes("master_status")) {
      const { data: rFallback } = await supabase
        .from("ranking_jugadores")
        .select("jugador_id, puntos, torneo_id, categoria_id, instancia")
        .eq("anio", anio);
      ranking = rFallback ?? [];
    } else {
      ranking = rData ?? [];
    }

    const cuposMap = new Map<string, number>();
    (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) =>
      cuposMap.set(c.categoria_id, c.cupos)
    );

    const activeCats = (cats ?? []) as Categoria[];
    const { ascendidosDesde, obtenerMetricasMasterJugador } =
      construirContextoAscensosYTorneos({
        categorias: activeCats,
        ascensos: (ascensos ?? []) as any[],
        rankingRows: ranking,
      });

    // Agrupar puntos por categoria + jugador (excluyendo categorías origen de ascenso)
    const puntosPorCat = new Map<
      string,
      Map<string, { ptsTorneos: number; ptsAscenso: number }>
    >();

    (ranking ?? []).forEach((r) => {
      if (!r.categoria_id) return;
      const catAscendidos = ascendidosDesde.get(r.categoria_id);
      if (catAscendidos && catAscendidos.has(r.jugador_id)) {
        return; // skip
      }
      if (!puntosPorCat.has(r.categoria_id)) {
        puntosPorCat.set(r.categoria_id, new Map());
      }
      const m = puntosPorCat.get(r.categoria_id)!;
      const cur = m.get(r.jugador_id) ?? { ptsTorneos: 0, ptsAscenso: 0 };
      if (isAscenso(r.instancia)) {
        cur.ptsAscenso = Math.max(cur.ptsAscenso, r.puntos);
      } else {
        cur.ptsTorneos += r.puntos;
      }
      m.set(r.jugador_id, cur);
    });

    // Cargar todos los jugadores que aparecen
    const todosIds = new Set<string>();
    puntosPorCat.forEach((m) => m.forEach((_, id) => todosIds.add(id)));
    let jugadores: {
      id: string;
      nombre: string;
      apellido: string;
      club: string | null;
    }[] = [];
    if (todosIds.size > 0) {
      const idsArray = Array.from(todosIds);
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < idsArray.length; i += chunkSize) {
        chunks.push(idsArray.slice(i, i + chunkSize));
      }
      try {
        const results = await Promise.all(
          chunks.map((chunk) =>
            supabase
              .from("jugadores_publicos" as any)
              .select("id, nombre, apellido, club")
              .in("id", chunk)
          )
        );
        for (const res of results) {
          if (res.data) {
            jugadores = [...jugadores, ...res.data];
          }
        }
      } catch (err) {
        console.error("Error fetching jugadores in chunks:", err);
      }
    }
    const jugadorMap = new Map(jugadores.map((j) => [j.id, j] as const));

    const result: CategoriaMaster[] = activeCats.map((cat) => {
      const defCupo = getCupoDefaultCategoria(cat.nombre);
      const cuposCount = cuposMap.get(cat.id) ?? defCupo;
      const puntos = puntosPorCat.get(cat.id);
      let clasificados: ClasificadoRow[] = [];
      let suplentes: ClasificadoRow[] = [];

      if (puntos) {
        const baseRows = Array.from(puntos.entries())
          .map(([jugador_id, pObj]) => {
            const j = jugadorMap.get(jugador_id);
            const metricas = obtenerMetricasMasterJugador(jugador_id, cat.id);
            return {
              jugador_id,
              apellido: j?.apellido ?? "?",
              nombre: j?.nombre ?? "?",
              club: j?.club ?? null,
              puntos: pObj.ptsTorneos + pObj.ptsAscenso,
              torneos_jugados: metricas.torneos_jugados,
              master_status: metricas.master_status,
            };
          })
          .sort((a, b) => b.puntos - a.puntos)
          .map((item, idx) => ({
            ...item,
            posicion_general: idx + 1,
          }));

        const evaluados = aplicarReglasMaster(baseRows, cuposCount);
        clasificados = evaluados
          .filter((e) => e.clasifica_master)
          .map((e) => ({
            ...e,
            posicion_master: e.posicion_master ?? e.posicion_general,
          }));
        suplentes = evaluados
          .filter((e) => e.es_suplente_master)
          .map((e) => ({
            ...e,
            posicion_master: e.posicion_master ?? e.posicion_general,
            orden_suplente: e.orden_suplente,
          }));
      }

      return { categoria: cat, cupos: cuposCount, clasificados, suplentes };
    });

    setData(result);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalClasificados = useMemo(
    () => data.reduce((acc, d) => acc + d.clasificados.length, 0),
    [data]
  );

  const exportarPDF = async () => {
    setExporting(true);
    try {
      const jspdfMod = await import("jspdf");
      const jsPDF = jspdfMod.jsPDF;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 12;
      const marginTop = 14;
      const headerOffset = 22;
      const marginBottom = 16;
      const colGap = 6;
      const colW = (pageW - marginX * 2 - colGap) / 2;
      const rowH = 5.2;
      const headerH = 9;

      let logoData: string | null = null;
      try {
        logoData = await loadImageAsDataURL(clubBrand.logoUrl ?? padelIdLogo);
      } catch (err) {
        console.warn("No se pudo cargar el logo", err);
      }

      const drawHeaderFooter = () => {
        if (logoData) {
          const logoH = 14;
          const logoW = 14;
          pdf.addImage(logoData, "PNG", marginX, marginTop - 4, logoW, logoH);
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.setTextColor(0);
        pdf.text(`Clasificados al Master ${anio}`, pageW / 2, marginTop + 2, {
          align: "center",
        });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(120);
        pdf.text(
          `Generado el ${new Date().toLocaleDateString("es-AR")} · ${totalClasificados} clasificados elegibles (4+ torneos) en ${data.length} categorías`,
          pageW / 2,
          marginTop + 7,
          { align: "center" }
        );
        pdf.setTextColor(0);

        pdf.setDrawColor(220);
        pdf.setLineWidth(0.3);
        pdf.line(marginX, marginTop + 11, pageW - marginX, marginTop + 11);

        const footerY = pageH - 8;
        pdf.setDrawColor(230);
        pdf.line(marginX, footerY - 5, pageW - marginX, footerY - 5);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(227, 6, 19);
        pdf.text(clubBrand.nombre.toUpperCase(), marginX, footerY);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(120);
        pdf.text("Padel ID · Torneos y rankings", pageW / 2, footerY, { align: "center" });
        const pageNum = pdf.getCurrentPageInfo().pageNumber;
        const totalPages = pdf.getNumberOfPages();
        pdf.text(`Página ${pageNum} de ${totalPages}`, pageW - marginX, footerY, {
          align: "right",
        });
        pdf.setTextColor(0);
      };

      let col = 0;
      const startY = marginTop + headerOffset - 8;
      const colY = [startY, startY];

      const drawCategoria = (d: CategoriaMaster) => {
        const titulo = `${labelGenero(d.categoria.genero)} — ${d.categoria.nombre}`;
        const filas = d.clasificados.length;
        const altoCard = headerH + (filas === 0 ? 8 : filas * rowH) + 6;

        if (colY[col] + altoCard > pageH - marginBottom) {
          col += 1;
          if (col > 1) {
            pdf.addPage();
            col = 0;
            colY[0] = startY;
            colY[1] = startY;
          }
        }

        const x = marginX + col * (colW + colGap);
        const y = colY[col];

        pdf.setDrawColor(220);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, colW, altoCard, 1.5, 1.5);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(titulo, x + 3, y + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        const cuposText = `${filas}/${d.cupos}`;
        pdf.text(cuposText, x + colW - 3, y + 6, { align: "right" });
        pdf.setTextColor(0);

        pdf.setDrawColor(230);
        pdf.line(x + 3, y + headerH - 1, x + colW - 3, y + headerH - 1);

        if (filas === 0) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(8);
          pdf.setTextColor(140);
          pdf.text("Sin clasificados con 4+ torneos aún.", x + 3, y + headerH + 4);
          pdf.setTextColor(0);
        } else {
          pdf.setFontSize(8.5);
          d.clasificados.forEach((c, idx) => {
            const ry = y + headerH + 3 + idx * rowH;
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(140);
            pdf.text(`${idx + 1}.`, x + 3, ry, { align: "left" });
            pdf.setTextColor(0);
            pdf.setFont("helvetica", "bold");
            const nombre = `${c.apellido}, ${c.nombre} (${c.torneos_jugados}/7)`;
            const maxNombreW = colW - 18;
            const nombreFit = pdf.splitTextToSize(nombre, maxNombreW)[0];
            pdf.text(nombreFit, x + 8, ry);
            pdf.setFont("helvetica", "bold");
            pdf.text(String(c.puntos), x + colW - 3, ry, { align: "right" });
          });
        }

        colY[col] += altoCard + 4;
      };

      data.forEach(drawCategoria);

      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        drawHeaderFooter();
      }

      pdf.save(`Master-${anio}.pdf`);
      toast.success("PDF descargado");
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" />
            Master de Diciembre {anio}
          </h1>
          <p className="text-sm text-muted-foreground">
            Clasificados al Master según puntaje acumulado y requisito mínimo de{" "}
            {TORNEOS_REQUERIDOS_MASTER}/{TORNEOS_TOTALES_ANIO} torneos en el año.
          </p>
        </div>
        <Button
          onClick={exportarPDF}
          disabled={exporting || loading || totalClasificados === 0}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Descargar PDF
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <div className="space-y-4 bg-background p-4 rounded-md">
          <div className="text-center pb-2 border-b">
            <h2 className="text-xl font-bold">Clasificados al Master {anio}</h2>
            <p className="text-xs text-muted-foreground">
              Generado el {new Date().toLocaleDateString("es-AR")} · {totalClasificados}{" "}
              jugadores clasificados en {data.length} categorías
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((d) => {
              const esSuma = isCategoriaSuma(d.categoria.nombre);
              return (
                <Card key={d.categoria.id} className="break-inside-avoid flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {labelGenero(d.categoria.genero)} — {d.categoria.nombre}
                        </CardTitle>
                        {esSuma && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5 flex items-center gap-1">
                            <Users className="h-3 w-3" />8 titulares + compañero/a (Suma 8)
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {d.clasificados.length}/{d.cupos}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col justify-between gap-3">
                    {d.clasificados.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">
                        Sin jugadores que cumplan los {TORNEOS_REQUERIDOS_MASTER}+ torneos aún.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <ol className="space-y-1 text-sm">
                          {d.clasificados.map((c, idx) => (
                            <li
                              key={c.jugador_id}
                              className="flex items-center gap-2 py-1 border-b border-border/40 last:border-0"
                            >
                              <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
                                {idx + 1}.
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {c.apellido}, {c.nombre}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {c.torneos_jugados}/{TORNEOS_TOTALES_ANIO} torneos
                                  {c.club ? ` · ${c.club}` : ""}
                                </div>
                              </div>
                              <span className="font-bold text-primary text-sm shrink-0">
                                {c.puntos}
                              </span>
                            </li>
                          ))}
                        </ol>

                        {d.suplentes.length > 0 && (
                          <div className="pt-1.5 border-t border-dashed">
                            <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 mb-1">
                              Suplentes (Top 2)
                            </p>
                            {d.suplentes.slice(0, 2).map((s, sIdx) => (
                              <div
                                key={s.jugador_id}
                                className="flex items-center justify-between text-xs text-muted-foreground py-0.5"
                              >
                                <span className="truncate">
                                  S{sIdx + 1}. {s.apellido}, {s.nombre}
                                </span>
                                <span className="font-semibold ml-2">{s.puntos} pts</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5 text-xs font-bold mt-2"
                      onClick={() => setPlacaCat(d)}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Generar Placa Master
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {placaCat && (
        <MasterPlacaModal
          open={Boolean(placaCat)}
          onOpenChange={(o) => {
            if (!o) setPlacaCat(null);
          }}
          categoriaNombre={placaCat.categoria.nombre}
          categoriaGenero={placaCat.categoria.genero}
          anio={anio}
          cupo={placaCat.cupos}
          clasificados={placaCat.clasificados as PlacaJugadorItem[]}
          suplentes={placaCat.suplentes as PlacaJugadorItem[]}
          clubNombre={clubBrand.nombre}
          clubLogoUrl={clubBrand.logoUrl}
        />
      )}
    </div>
  );
}
