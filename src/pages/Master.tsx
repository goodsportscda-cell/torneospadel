import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { activeTenant } from "@/lib/tenant";

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
};

type CategoriaMaster = {
  categoria: Categoria;
  cupos: number;
  clasificados: ClasificadoRow[];
};

const CUPO_DEFAULT = 16;
const CUPO_SUMA7 = 8;

const labelGenero = (g: string) =>
  g === "caballeros" ? "Caballeros" : g === "damas" ? "Damas" : "Mixto";

export default function Master() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<CategoriaMaster[]>([]);
  const anio = new Date().getFullYear();

  const cargar = async () => {
    setLoading(true);
    const [{ data: cats }, { data: cupos }, { data: ranking }, { data: ascensos }] = await Promise.all([
      supabase
        .from("categorias")
        .select("id, nombre, genero, orden")
        .eq("activa", true)
        .order("orden"),
      supabase.from("cupos_master").select("categoria_id, cupos"),
      supabase
        .from("ranking_jugadores")
        .select("jugador_id, puntos, categoria_id")
        .eq("anio", anio),
      supabase
        .from("ascensos")
        .select("jugador_id, puntos_transferidos, categoria_destino_id, categoria_origen_id")
        .eq("anio", anio),
    ]);

    const cuposMap = new Map<string, number>();
    (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) =>
      cuposMap.set(c.categoria_id, c.cupos)
    );

    // Mapear ascensos para exclusión de origen y adición en destino
    const ascendidosDesde = new Map<string, Set<string>>(); // cat_id -> Set<jugador_id>
    const ascensoMapByCat = new Map<string, Map<string, number>>(); // cat_id -> jugador_id -> puntos_transferidos

    (ascensos ?? []).forEach((a) => {
      // Destino: registrar puntos a transferir
      if (!ascensoMapByCat.has(a.categoria_destino_id)) {
        ascensoMapByCat.set(a.categoria_destino_id, new Map());
      }
      const m = ascensoMapByCat.get(a.categoria_destino_id)!;
      m.set(a.jugador_id, (m.get(a.jugador_id) ?? 0) + a.puntos_transferidos);

      // Origen: registrar exclusión
      if (!ascendidosDesde.has(a.categoria_origen_id)) {
        ascendidosDesde.set(a.categoria_origen_id, new Set());
      }
      ascendidosDesde.get(a.categoria_origen_id)!.add(a.jugador_id);
    });

    // Agrupar puntos por categoria + jugador
    const puntosPorCat = new Map<string, Map<string, number>>();
    (ranking ?? []).forEach((r) => {
      if (!r.categoria_id) return;
      // Si el jugador ascendió desde esta categoría, excluir sus puntos de ella
      const catAscendidos = ascendidosDesde.get(r.categoria_id);
      if (catAscendidos && catAscendidos.has(r.jugador_id)) {
        return; // skip
      }
      if (!puntosPorCat.has(r.categoria_id)) {
        puntosPorCat.set(r.categoria_id, new Map());
      }
      const m = puntosPorCat.get(r.categoria_id)!;
      m.set(r.jugador_id, (m.get(r.jugador_id) ?? 0) + r.puntos);
    });

    // Agregar puntos por ascenso en la categoría destino
    ascensoMapByCat.forEach((jugadorMap, catId) => {
      if (!puntosPorCat.has(catId)) {
        puntosPorCat.set(catId, new Map());
      }
      const m = puntosPorCat.get(catId)!;
      jugadorMap.forEach((pts, jId) => {
        m.set(jId, (m.get(jId) ?? 0) + pts);
      });
    });

    // Cargar todos los jugadores que aparecen
    const todosIds = new Set<string>();
    puntosPorCat.forEach((m) => m.forEach((_, id) => todosIds.add(id)));
    let jugadores: { id: string; nombre: string; apellido: string; club: string | null }[] = [];
    if (todosIds.size > 0) {
      const idsArray = Array.from(todosIds);
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < idsArray.length; i += chunkSize) {
        chunks.push(idsArray.slice(i, i + chunkSize));
      }
      try {
        const results = await Promise.all(
          chunks.map(chunk => 
            supabase
              .from("jugadores")
              .select("id, nombre, apellido, club")
              .in("id", chunk)
          )
        );
        for (const res of results) {
          if (res.error) {
            console.error("Error fetching chunk of jugadores:", res.error);
          }
          if (res.data) {
            jugadores = [...jugadores, ...res.data];
          }
        }
      } catch (err) {
        console.error("Error fetching jugadores in chunks:", err);
      }
    }
    const jugadorMap = new Map(
      jugadores.map((j) => [j.id, j] as const)
    );

    const result: CategoriaMaster[] = (cats ?? []).map((cat) => {
      const defCupo = cat.nombre.toLowerCase().includes("suma 7")
        ? CUPO_SUMA7
        : CUPO_DEFAULT;
      const cupos = cuposMap.get(cat.id) ?? defCupo;
      const puntos = puntosPorCat.get(cat.id);
      let clasificados: ClasificadoRow[] = [];
      if (puntos) {
        clasificados = Array.from(puntos.entries())
          .map(([jugador_id, p]) => {
            const j = jugadorMap.get(jugador_id);
            return {
              jugador_id,
              apellido: j?.apellido ?? "?",
              nombre: j?.nombre ?? "?",
              club: j?.club ?? null,
              puntos: p,
            };
          })
          .sort((a, b) => b.puntos - a.puntos)
          .slice(0, cupos);
      }
      return { categoria: cat as Categoria, cupos, clasificados };
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
      const headerOffset = 22; // espacio reservado para el logo + título
      const marginBottom = 16; // espacio reservado para el pie
      const colGap = 6;
      const colW = (pageW - marginX * 2 - colGap) / 2;
      const rowH = 5.2;
      const headerH = 9;

      // Cargar logo Good Padel
      let logoData: string | null = null;
      try {
        logoData = await loadImageAsDataURL(activeTenant.logo);
      } catch (err) {
        console.warn("No se pudo cargar el logo", err);
      }

      const drawHeaderFooter = () => {
        // Logo arriba a la izquierda
        if (logoData) {
          const logoH = 14;
          const logoW = 14; // logo cuadrado
          pdf.addImage(logoData, "PNG", marginX, marginTop - 4, logoW, logoH);
        }

        // Título centrado
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
          `Generado el ${new Date().toLocaleDateString("es-AR")} · ${totalClasificados} clasificados en ${data.length} categorías`,
          pageW / 2,
          marginTop + 7,
          { align: "center" }
        );
        pdf.setTextColor(0);

        // Línea divisoria bajo el header
        pdf.setDrawColor(220);
        pdf.setLineWidth(0.3);
        pdf.line(marginX, marginTop + 11, pageW - marginX, marginTop + 11);

        // Pie de página
        const footerY = pageH - 8;
        pdf.setDrawColor(230);
        pdf.line(marginX, footerY - 5, pageW - marginX, footerY - 5);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(227, 6, 19); // color de marca
        pdf.text(activeTenant.name.toUpperCase(), marginX, footerY);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(120);
        pdf.text(activeTenant.instagram || activeTenant.subtext, pageW / 2, footerY, { align: "center" });
        const pageNum = pdf.getCurrentPageInfo().pageNumber;
        const totalPages = pdf.getNumberOfPages();
        pdf.text(`Página ${pageNum} de ${totalPages}`, pageW - marginX, footerY, {
          align: "right",
        });
        pdf.setTextColor(0);
      };

      // Layout: 2 columnas, posición Y por columna
      let col = 0;
      const startY = marginTop + headerOffset - 8;
      const colY = [startY, startY];

      const drawCategoria = (d: CategoriaMaster) => {
        const titulo = `${labelGenero(d.categoria.genero)} — ${d.categoria.nombre}`;
        const filas = d.clasificados.length;
        const altoCard =
          headerH + (filas === 0 ? 8 : filas * rowH) + 6;

        // Si no entra, salta de columna o página
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

        // Caja de la card
        pdf.setDrawColor(220);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, colW, altoCard, 1.5, 1.5);

        // Header (título + cupos)
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(titulo, x + 3, y + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        const cuposText = `${filas}/${d.cupos}`;
        pdf.text(cuposText, x + colW - 3, y + 6, { align: "right" });
        pdf.setTextColor(0);

        // Línea separadora
        pdf.setDrawColor(230);
        pdf.line(x + 3, y + headerH - 1, x + colW - 3, y + headerH - 1);

        // Filas
        if (filas === 0) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(8);
          pdf.setTextColor(140);
          pdf.text("Sin puntos registrados aún.", x + 3, y + headerH + 4);
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
            // Truncar nombre si muy largo
            const nombre = `${c.apellido}, ${c.nombre}`;
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

      // Dibujar header + footer en todas las páginas (al final, ya conocemos el total)
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
            Master {anio}
          </h1>
          <p className="text-sm text-muted-foreground">
            Clasificados al Master según el ranking acumulado del año.
          </p>
        </div>
        <Button onClick={exportarPDF} disabled={exporting || loading || totalClasificados === 0}>
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
              Generado el {new Date().toLocaleDateString("es-AR")} · {totalClasificados} jugadores
              clasificados en {data.length} categorías
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((d) => (
              <Card key={d.categoria.id} className="break-inside-avoid">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {labelGenero(d.categoria.genero)} — {d.categoria.nombre}
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0">
                      {d.clasificados.length}/{d.cupos}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {d.clasificados.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                      Sin puntos registrados aún en esta categoría.
                    </p>
                  ) : (
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
                            {c.club && (
                              <div className="text-xs text-muted-foreground truncate">
                                {c.club}
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-primary text-sm shrink-0">
                            {c.puntos}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
