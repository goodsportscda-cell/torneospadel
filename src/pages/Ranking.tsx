import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trophy, Settings, Save, Medal, Star, Eye, ArrowUpCircle, Trash2, Share2, Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { INSTANCIA_LABEL, type Instancia, recalcularTodosLosAscensos } from "@/lib/ranking";
import { activeTenant } from "@/lib/tenant";
import { useClubRanking, type RankingRowUnified } from "@/hooks/useClubRanking";
import { DesglosePuntosModal } from "@/components/ranking/DesglosePuntosModal";

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

type DetalleTorneo = {
  torneo_id: string;
  torneo_nombre: string;
  fecha: string;
  numero_fecha: number | null;
  instancia: Instancia;
  puntos: number;
  multiplicador: number;
  puntos_base: number;
};

type RankingRow = {
  jugador_id: string;
  puntos: number;
  puntos_ascenso: number;
  torneos: number;
  jugador_nombre: string;
  jugador_apellido: string;
  jugador_club: string | null;
};

type Ascenso = {
  id: string;
  jugador_id: string;
  categoria_origen_id: string;
  categoria_destino_id: string;
  puntos_origen: number;
  puntos_transferidos: number;
  anio: number;
  fecha: string;
  notas: string | null;
};

type Categoria = { id: string; nombre: string; genero: string; orden?: number | null };

const GENEROS = [
  { value: "todos", label: "Todos" },
  { value: "caballeros", label: "Caballeros" },
  { value: "damas", label: "Damas" },
  { value: "mixto", label: "Mixto" },
];

const CUPO_DEFAULT = 16;

export default function Ranking() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankingRowUnified[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aniosDisp, setAniosDisp] = useState<number[]>([]);
  const [cuposMaster, setCuposMaster] = useState<Record<string, number>>({});

  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroGenero, setFiltroGenero] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [copiado, setCopiado] = useState(false);

  const copiarEnlacePublico = () => {
    const params = new URLSearchParams();
    if (filtroAnio !== new Date().getFullYear()) {
      params.set("anio", String(filtroAnio));
    }
    if (filtroCategoria !== "todas") {
      params.set("categoria", filtroCategoria);
    }
    if (filtroGenero !== "todos") {
      params.set("genero", filtroGenero);
    }
    const queryString = params.toString();
    const url = `${window.location.origin}/ranking-publico${queryString ? "?" + queryString : ""}`;
    navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("¡Enlace del ranking público copiado! Listo para compartir en WhatsApp.");
    setTimeout(() => setCopiado(false), 2000);
  };

  const [exportingMaster, setExportingMaster] = useState(false);

  const exportarPDFMaster = async () => {
    setExportingMaster(true);
    try {
      const [{ data: allCats }, { data: cupos }] = await Promise.all([
        supabase
          .from("categorias")
          .select("id, nombre, genero, orden")
          .eq("activa", true)
          .order("orden"),
        supabase.from("cupos_master").select("categoria_id, cupos"),
      ]);

      const cuposMap = new Map<string, number>();
      (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) =>
        cuposMap.set(c.categoria_id, c.cupos)
      );

      const MASTER_CATEGORIES_CONFIG = [
        { nombre: "8va", genero: "damas" },
        { nombre: "7ma", genero: "damas" },
        { nombre: "6ta", genero: "damas" },
        { nombre: "8va", genero: "caballeros" },
        { nombre: "7ma", genero: "caballeros" },
        { nombre: "6ta", genero: "caballeros" },
        { nombre: "5ta", genero: "caballeros" },
        { nombre: "Suma 7", genero: "caballeros" },
      ];

      const masterCats: Categoria[] = [];
      for (const cfg of MASTER_CATEGORIES_CONFIG) {
        const found = (allCats ?? []).find(
          (c) =>
            c.nombre.toLowerCase().trim() === cfg.nombre.toLowerCase().trim() &&
            c.genero === cfg.genero
        );
        if (found) {
          masterCats.push(found as Categoria);
        }
      }

      type ClasificadoRowData = {
        jugador_id: string;
        apellido: string;
        nombre: string;
        club: string | null;
        puntos: number;
      };

      type CatMasterData = {
        categoria: Categoria;
        cupos: number;
        clasificados: ClasificadoRowData[];
      };

      const masterData: CatMasterData[] = [];

      for (const cat of masterCats) {
        const defCupo = cat.nombre.toLowerCase().includes("suma 7") ? 8 : 16;
        const cuposCount = cuposMap.get(cat.id) ?? defCupo;

        const [{ data: ranking }, { data: ascDestino }, { data: ascOrigen }] = await Promise.all([
          supabase
            .from("ranking_jugadores")
            .select("jugador_id, puntos")
            .eq("anio", filtroAnio)
            .eq("categoria_id", cat.id),
          supabase
            .from("ascensos")
            .select("jugador_id, puntos_transferidos")
            .eq("anio", filtroAnio)
            .eq("categoria_destino_id", cat.id),
          supabase
            .from("ascensos")
            .select("jugador_id")
            .eq("anio", filtroAnio)
            .eq("categoria_origen_id", cat.id),
        ]);

        const ascendidosDesde = new Set((ascOrigen ?? []).map((a) => a.jugador_id));
        const ascensoMap = new Map<string, number>();
        (ascDestino ?? []).forEach((a) => {
          ascensoMap.set(a.jugador_id, (ascensoMap.get(a.jugador_id) ?? 0) + a.puntos_transferidos);
        });

        const puntosMap = new Map<string, number>();
        (ranking ?? []).forEach((r) => {
          if (ascendidosDesde.has(r.jugador_id)) return;
          puntosMap.set(r.jugador_id, (puntosMap.get(r.jugador_id) ?? 0) + r.puntos);
        });

        for (const [jId, pts] of ascensoMap.entries()) {
          puntosMap.set(jId, (puntosMap.get(jId) ?? 0) + pts);
        }

        const sortedEntries = Array.from(puntosMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, cuposCount);

        let clasificados: ClasificadoRowData[] = [];
        if (sortedEntries.length > 0) {
          const ids = sortedEntries.map(([id]) => id);
          const { data: jugData } = await supabase
            .from("jugadores")
            .select("id, nombre, apellido, club")
            .in("id", ids);

          const jugMap = new Map((jugData ?? []).map((j) => [j.id, j]));

          clasificados = sortedEntries.map(([jId, pts]) => {
            const j = jugMap.get(jId);
            return {
              jugador_id: jId,
              apellido: j?.apellido ?? "?",
              nombre: j?.nombre ?? "?",
              club: j?.club ?? null,
              puntos: pts,
            };
          });
        }

        masterData.push({
          categoria: cat,
          cupos: cuposCount,
          clasificados,
        });
      }

      const totalClasificados = masterData.reduce((acc, d) => acc + d.clasificados.length, 0);
      if (totalClasificados === 0) {
        toast.error("No hay clasificados con puntos registrados para el año seleccionado.");
        return;
      }

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
        logoData = await loadImageAsDataURL(activeTenant.logo);
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
        pdf.text(`Clasificados al Master ${filtroAnio}`, pageW / 2, marginTop + 2, {
          align: "center",
        });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(120);
        pdf.text(
          `Generado el ${new Date().toLocaleDateString("es-AR")} · ${totalClasificados} clasificados en ${masterData.length} categorías`,
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

      let col = 0;
      const startY = marginTop + headerOffset - 8;
      const colY = [startY, startY];

      const labelGenero = (g: string) =>
        g === "caballeros" ? "Caballeros" : g === "damas" ? "Damas" : "Mixto";

      const drawCategoria = (d: CatMasterData) => {
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

      masterData.forEach(drawCategoria);

      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        drawHeaderFooter();
      }

      pdf.save(`Master-${filtroAnio}.pdf`);
      toast.success("PDF del Master descargado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el PDF del Master");
    } finally {
      setExportingMaster(false);
    }
  };

  const [puntosCfg, setPuntosCfg] = useState<{ instancia: Instancia; puntos: number; orden: number }[]>([]);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);

  const [cupoOpen, setCupoOpen] = useState(false);
  const [cupoEdit, setCupoEdit] = useState<string>("");

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleJugador, setDetalleJugador] = useState<RankingRowUnified | null>(null);
  const [detalleData, setDetalleData] = useState<DetalleTorneo[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [detalleAscensoNotas, setDetalleAscensoNotas] = useState<string | null>(null);

  // Ascensos
  const [ascensoOpen, setAscensoOpen] = useState(false);
  const [ascensoJugadorBusqueda, setAscensoJugadorBusqueda] = useState("");
  const [ascensoJugadores, setAscensoJugadores] = useState<{ id: string; nombre: string; apellido: string; categoria_id: string | null; cat_nombre?: string }[]>([]);
  const [ascensoJugadorId, setAscensoJugadorId] = useState<string>("");
  const [ascensoCatOrigen, setAscensoCatOrigen] = useState<string>("");
  const [ascensoCatDestino, setAscensoCatDestino] = useState<string>("");
  const [ascensoPuntosOrigen, setAscensoPuntosOrigen] = useState<number>(0);
  const [ascensoNotas, setAscensoNotas] = useState("");
  const [savingAscenso, setSavingAscenso] = useState(false);
  const [ascensosList, setAscensosList] = useState<(Ascenso & { jugador_nombre?: string; jugador_apellido?: string })[]>([]);

  const cargarTodo = async () => {
    setLoading(true);
    const [{ data: cats }, { data: cfg }, { data: anios }, { data: cupos }] = await Promise.all([
      supabase.from("categorias").select("id, nombre, genero, orden").eq("activa", true),
      supabase.from("puntos_ranking").select("instancia, puntos, orden").order("orden"),
      supabase.from("ranking_jugadores").select("anio"),
      supabase.from("cupos_master").select("categoria_id, cupos"),
    ]);
    
    let loadedCats = (cats ?? []) as Categoria[];
    
    const expectedCats = [
      { nombre: "1ra", genero: "caballeros", orden: 1 },
      { nombre: "2da", genero: "caballeros", orden: 2 },
      { nombre: "3ra", genero: "caballeros", orden: 3 },
      { nombre: "4ta", genero: "caballeros", orden: 4 },
      { nombre: "5ta", genero: "caballeros", orden: 5 },
      { nombre: "6ta", genero: "caballeros", orden: 6 },
      { nombre: "7ma", genero: "caballeros", orden: 7 },
      { nombre: "8va", genero: "caballeros", orden: 8 },
      { nombre: "Suma 7", genero: "caballeros", orden: 9 },
      { nombre: "1ra", genero: "damas", orden: 11 },
      { nombre: "2da", genero: "damas", orden: 12 },
      { nombre: "3ra", genero: "damas", orden: 13 },
      { nombre: "4ta", genero: "damas", orden: 14 },
      { nombre: "5ta", genero: "damas", orden: 15 },
      { nombre: "6ta", genero: "damas", orden: 16 },
      { nombre: "7ma", genero: "damas", orden: 17 },
      { nombre: "8va", genero: "damas", orden: 18 }
    ];

    const categoriesToInsert = [];
    const categoriesToUpdate = [];

    for (const ec of expectedCats) {
      const existing = loadedCats.find(
        lc => lc.nombre.toLowerCase() === ec.nombre.toLowerCase() && lc.genero === ec.genero
      );
      if (!existing) {
        categoriesToInsert.push(ec);
      } else if (existing.orden !== ec.orden) {
        categoriesToUpdate.push({ id: existing.id, orden: ec.orden });
      }
    }

    if (categoriesToInsert.length > 0) {
      const { data: inserted } = await (supabase as any)
        .from("categorias")
        .insert(categoriesToInsert)
        .select("id, nombre, genero, orden");
      if (inserted) {
        loadedCats = [...loadedCats, ...inserted];
      }
    }

    for (const item of categoriesToUpdate) {
      await (supabase as any)
        .from("categorias")
        .update({ orden: item.orden })
        .eq("id", item.id);
      
      const idx = loadedCats.findIndex(lc => lc.id === item.id);
      if (idx !== -1) {
        loadedCats[idx].orden = item.orden;
      }
    }

    loadedCats.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    setCategorias(loadedCats);
    setPuntosCfg((cfg ?? []) as { instancia: Instancia; puntos: number; orden: number }[]);
    const anioSet = new Set<number>();
    (anios ?? []).forEach((a: { anio: number }) => anioSet.add(a.anio));
    anioSet.add(new Date().getFullYear());
    setAniosDisp(Array.from(anioSet).sort((a, b) => b - a));
    const cuposMap: Record<string, number> = {};
    (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) => {
      cuposMap[c.categoria_id] = c.cupos;
    });
    setCuposMaster(cuposMap);
    setLoading(false);
  };

  const cargarRanking = async () => {
    let rankingData: any[] = [];
    let isFetchingRanking = true;
    let rankingOffset = 0;
    const step = 1000;

    while (isFetchingRanking) {
      let query = supabase
        .from("ranking_jugadores")
        .select("jugador_id, puntos, torneo_id, categoria_id, genero, anio")
        .eq("anio", filtroAnio)
        .order("id")
        .range(rankingOffset, rankingOffset + step - 1);

      if (filtroCategoria !== "todas") {
        query = query.eq("categoria_id", filtroCategoria);
      }
      if (filtroGenero !== "todos") {
        query = query.eq("genero", filtroGenero);
      }
      
      const { data, error } = await query;
      if (error) {
        toast.error("Error cargando ranking");
        return;
      }
      
      if (data && data.length > 0) {
        rankingData = rankingData.concat(data);
      }
      
      if (!data || data.length < step) {
        isFetchingRanking = false;
      } else {
        rankingOffset += step;
      }
    }
    
    // Asignar los datos completos para seguir con el resto de la función
    const data = rankingData;

    // Cargar todos los ascensos del año para deduplicar y calcular coherencia
    const { data: ascensosAllData } = await supabase
      .from("ascensos")
      .select("id, jugador_id, puntos_origen, puntos_transferidos, categoria_origen_id, categoria_destino_id, created_at, fecha")
      .eq("anio", filtroAnio);

    // Sumar puntos de torneos por (jugador_id, categoria_id)
    const torneosPtsMap = new Map<string, Map<string, number>>();
    (data ?? []).forEach((r) => {
      if (!r.categoria_id) return;
      if (!torneosPtsMap.has(r.jugador_id)) torneosPtsMap.set(r.jugador_id, new Map());
      const cMap = torneosPtsMap.get(r.jugador_id)!;
      cMap.set(r.categoria_id, (cMap.get(r.categoria_id) ?? 0) + r.puntos);
    });

    // Deduplicar ascensos por (jugador_id, categoria_origen_id, categoria_destino_id)
    const ascensosDeduplicados = new Map<string, any>();
    (ascensosAllData ?? []).forEach((a) => {
      const key = `${a.jugador_id}_${a.categoria_origen_id}_${a.categoria_destino_id}`;
      const existing = ascensosDeduplicados.get(key);
      if (!existing || new Date(a.created_at || a.fecha).getTime() > new Date(existing.created_at || existing.fecha).getTime()) {
        ascensosDeduplicados.set(key, a);
      }
    });

    const ascendidosDesde = new Map<string, Set<string>>();
    const ascensoMap = new Map<string, number>();

    ascensosDeduplicados.forEach((a) => {
      if (!ascendidosDesde.has(a.categoria_origen_id)) {
        ascendidosDesde.set(a.categoria_origen_id, new Set());
      }
      ascendidosDesde.get(a.categoria_origen_id)!.add(a.jugador_id);

      // Si este ascenso fue superado por un ascenso posterior (ej: 7ma -> 6ta y luego 6ta -> 5ta),
      // los puntos de 7ma -> 6ta ya se tomaron en cuenta al calcular el 50% de 6ta -> 5ta.
      const isSuperseded = Array.from(ascensosDeduplicados.values()).some(
        (b: any) => b.jugador_id === a.jugador_id && b.categoria_origen_id === a.categoria_destino_id
      );
      if (isSuperseded) return;

      if (filtroCategoria === "todas" || a.categoria_destino_id === filtroCategoria) {
        const ptsTorneosOrigen = torneosPtsMap.get(a.jugador_id)?.get(a.categoria_origen_id) ?? 0;
        const ptsCalc = Math.floor(ptsTorneosOrigen / 2);
        const ptsFinales = Math.max(a.puntos_transferidos || 0, ptsCalc);

        ascensoMap.set(a.jugador_id, (ascensoMap.get(a.jugador_id) ?? 0) + ptsFinales);
      }
    });

    // Agrupar por jugador, excluyendo puntos de categorías desde las que ascendieron
    const map = new Map<string, { puntos: number; torneos: number }>();
    (data ?? []).forEach((r) => {
      // Si el jugador ascendió desde esta categoría, excluir sus puntos de ella
      const catAscendidos = ascendidosDesde.get(r.categoria_id);
      if (catAscendidos && catAscendidos.has(r.jugador_id)) {
        return; // skip — ya ascendió de esta categoría
      }
      const cur = map.get(r.jugador_id) ?? { puntos: 0, torneos: 0 };
      cur.puntos += r.puntos;
      cur.torneos += 1;
      map.set(r.jugador_id, cur);
    });

    // Incluir jugadores que solo tienen puntos de ascenso
    for (const jId of ascensoMap.keys()) {
      if (!map.has(jId)) {
        map.set(jId, { puntos: 0, torneos: 0 });
      }
    }

    const ids = Array.from(map.keys());
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    // Chunk ids array to avoid URL length limit in Supabase (.in with many elements)
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }
    
    let jugadores: { id: string; nombre: string; apellido: string; club: string | null }[] = [];
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

    const result: RankingRowUnified[] = ids.map((id) => {
      const j = jugadores?.find((x) => x.id === id);
      const m = map.get(id)!;
      const ptsAscenso = ascensoMap.get(id) ?? 0;
      return {
        posicion: 0,
        jugador_id: id,
        puntos_totales: m.puntos + ptsAscenso,
        puntos_torneos: m.puntos,
        puntos_ascenso: ptsAscenso,
        torneos_jugados: m.torneos,
        jugador_nombre: j?.nombre ?? "?",
        jugador_apellido: j?.apellido ?? "?",
        jugador_club: j?.club ?? null,
        desglose: [],
      };
    });
    result.sort((a, b) => b.puntos_totales - a.puntos_totales);
    result.forEach((r, i) => { r.posicion = i + 1; });
    setRows(result);
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  useEffect(() => {
    if (!loading) cargarRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio, filtroCategoria, filtroGenero, loading]);

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return rows;
    const q = busqueda.toLowerCase();
    return rows.filter(
      (r) =>
        r.jugador_nombre.toLowerCase().includes(q) ||
        r.jugador_apellido.toLowerCase().includes(q) ||
        (r.jugador_club ?? "").toLowerCase().includes(q)
    );
  }, [rows, busqueda]);

  // Cupos al Master en la categoría filtrada (si aplica)
  const cupoActual = useMemo(() => {
    if (filtroCategoria === "todas") return null;
    const cat = categorias.find((c) => c.id === filtroCategoria);
    if (!cat) return null;
    const def = cat.nombre.toLowerCase().includes("suma 7") ? 8 : CUPO_DEFAULT;
    return cuposMaster[filtroCategoria] ?? def;
  }, [filtroCategoria, categorias, cuposMaster]);

  const guardarPuntos = async () => {
    setSavingCfg(true);
    try {
      for (const p of puntosCfg) {
        const { error } = await (supabase as any)
          .from("puntos_ranking")
          .update({ puntos: p.puntos })
          .eq("instancia", p.instancia);
        if (error) throw error;
      }
      toast.success("Puntos actualizados. Recalculá los torneos finalizados para aplicar.");
      setCfgOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar puntos");
    } finally {
      setSavingCfg(false);
    }
  };

  const updatePunto = (instancia: Instancia, valor: string) => {
    const num = parseInt(valor, 10);
    setPuntosCfg((prev) =>
      prev.map((p) =>
        p.instancia === instancia ? { ...p, puntos: isNaN(num) ? 0 : num } : p
      )
    );
  };

  const guardarCupo = async () => {
    if (filtroCategoria === "todas") return;
    const num = parseInt(cupoEdit, 10);
    if (isNaN(num) || num < 1) {
      toast.error("Ingresá un número válido");
      return;
    }
    const { error } = await (supabase as any)
      .from("cupos_master")
      .upsert({ categoria_id: filtroCategoria, cupos: num }, { onConflict: "categoria_id" });
    if (error) {
      toast.error("Error al guardar: " + error.message);
      return;
    }
    setCuposMaster((prev) => ({ ...prev, [filtroCategoria]: num }));
    toast.success("Cupos al Master actualizados");
    setCupoOpen(false);
  };

  const abrirDetalle = async (jugador: RankingRowUnified) => {
    setDetalleJugador(jugador);
    setDetalleOpen(true);
    setLoadingDetalle(true);
    setDetalleData([]);
    setDetalleAscensoNotas(null);
    try {
      // 1. Obtener ascensos del jugador para identificar categorías de origen excluidas
      const { data: playerAscensos } = await (supabase as any)
        .from("ascensos")
        .select("categoria_origen_id, categoria_destino_id, notas")
        .eq("jugador_id", jugador.jugador_id)
        .eq("anio", filtroAnio);
      const ascendidosDesdeIds = new Set((playerAscensos ?? []).map((a: any) => a.categoria_origen_id));
      const activeAscensos = (playerAscensos ?? []).filter((a: any) => {
        const isSuperseded = (playerAscensos ?? []).some(
          (b: any) => b.categoria_origen_id === a.categoria_destino_id
        );
        if (isSuperseded) return false;
        if (filtroCategoria !== "todas" && a.categoria_destino_id !== filtroCategoria) return false;
        return true;
      });
      const notasList = activeAscensos.map((a: any) => a.notas).filter(Boolean);
      setDetalleAscensoNotas(notasList.length > 0 ? notasList.join(" | ") : null);

      let q = supabase
        .from("ranking_jugadores")
        .select("torneo_id, instancia, puntos, categoria_id")
        .eq("jugador_id", jugador.jugador_id)
        .eq("anio", filtroAnio);
      if (filtroCategoria !== "todas") q = q.eq("categoria_id", filtroCategoria);
      if (filtroGenero !== "todos") q = q.eq("genero", filtroGenero);
      const { data: rj, error } = await q;
      if (error) throw error;

      // Filtrar registros que pertenecen a una categoría de origen de la que el jugador ya ascendió
      const rjFiltrados = (rj ?? []).filter((r) => !ascendidosDesdeIds.has(r.categoria_id));

      const torneoIds = Array.from(new Set(rjFiltrados.map((r) => r.torneo_id)));
      let torneos: Array<{ id: string; nombre: string; fecha_inicio: string | null; numero_fecha: number | null; multiplicador_puntos: number | null }> = [];
      if (torneoIds.length > 0) {
        const { data: tData } = await supabase
          .from("torneos")
          .select("id, nombre, fecha_inicio, numero_fecha, multiplicador_puntos")
          .in("id", torneoIds);
        if (tData) torneos = tData;
      }

      const { data: puntosCfg } = await supabase
        .from("puntos_ranking")
        .select("instancia, puntos");
      const puntosBaseMap = new Map<string, number>();
      (puntosCfg ?? []).forEach((p) => puntosBaseMap.set(p.instancia, p.puntos));

      const detalle: DetalleTorneo[] = rjFiltrados.map((r) => {
        const t = torneos?.find((x) => x.id === r.torneo_id);
        const mult = Number(t?.multiplicador_puntos ?? 1) || 1;
        return {
          torneo_id: r.torneo_id,
          torneo_nombre: t?.nombre ?? "Torneo",
          fecha: t?.fecha_inicio ?? "",
          numero_fecha: t?.numero_fecha ?? null,
          instancia: r.instancia as Instancia,
          puntos: r.puntos,
          multiplicador: mult,
          puntos_base: puntosBaseMap.get(r.instancia) ?? 0,
        };
      });
      detalle.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      setDetalleData(detalle);
    } catch (e) {
      console.error(e);
      toast.error("Error cargando el detalle");
    } finally {
      setLoadingDetalle(false);
    }
  };

  const medalla = (pos: number) => {
    if (pos === 0) return <Medal className="h-4 w-4 text-primary" />;
    if (pos === 1) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (pos === 2) return <Medal className="h-4 w-4 text-accent-foreground" />;
    return <span className="text-xs text-muted-foreground w-4 text-center">{pos + 1}</span>;
  };

  // --- Ascensos ---
  const buscarJugadoresAscenso = async (q: string) => {
    setAscensoJugadorBusqueda(q);
    if (q.length < 2) { setAscensoJugadores([]); return; }
    const { data } = await (supabase as any)
      .from("jugadores")
      .select("id, nombre, apellido, categoria_id")
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
      .limit(10);
    if (!data || data.length === 0) { setAscensoJugadores([]); return; }
    const catIds = [...new Set((data as any[]).filter(j => j.categoria_id).map(j => j.categoria_id!))];
    const { data: catsJ } = catIds.length > 0
      ? await (supabase as any).from("categorias_jugadores").select("id, nombre").in("id", catIds)
      : { data: [] };
    const catMap = new Map(((catsJ as any[]) ?? []).map(c => [c.id, c.nombre]));
    setAscensoJugadores((data as any[]).map(j => ({
      ...j,
      cat_nombre: j.categoria_id ? catMap.get(j.categoria_id) ?? undefined : undefined,
    })));
  };

  const seleccionarJugadorAscenso = async (j: { id: string; nombre: string; apellido: string; categoria_id: string | null }) => {
    setAscensoJugadorId(j.id);
    setAscensoJugadorBusqueda(`${j.apellido}, ${j.nombre}`);
    setAscensoJugadores([]);

    // Buscar categorías de torneo donde el jugador tiene puntos
    const { data: rankData } = await supabase
      .from("ranking_jugadores")
      .select("categoria_id, puntos")
      .eq("jugador_id", j.id)
      .eq("anio", filtroAnio);

    // Agrupar puntos por categoría de torneo
    const puntosXCat = new Map<string, number>();
    (rankData ?? []).forEach((r) => {
      if (!r.categoria_id) return;
      puntosXCat.set(r.categoria_id, (puntosXCat.get(r.categoria_id) ?? 0) + r.puntos);
    });

    // Sumar ascensos previos a cada categoría
    const { data: ascPrev } = await supabase
      .from("ascensos")
      .select("categoria_destino_id, puntos_transferidos")
      .eq("jugador_id", j.id)
      .eq("anio", filtroAnio);
    (ascPrev ?? []).forEach((a) => {
      puntosXCat.set(a.categoria_destino_id, (puntosXCat.get(a.categoria_destino_id) ?? 0) + a.puntos_transferidos);
    });

    // Auto-seleccionar la categoría con más puntos como origen
    let mejorCat = "";
    let mejorPts = 0;
    for (const [catId, pts] of puntosXCat) {
      if (pts > mejorPts) {
        mejorCat = catId;
        mejorPts = pts;
      }
    }

    if (mejorCat) {
      setAscensoCatOrigen(mejorCat);
      setAscensoPuntosOrigen(mejorPts);
    } else {
      // Sin puntos en ranking, intentar mapear por nombre de categoría del jugador
      setAscensoCatOrigen("");
      setAscensoPuntosOrigen(0);
    }
  };

  const guardarAscenso = async () => {
    if (!ascensoJugadorId || !ascensoCatOrigen || !ascensoCatDestino) {
      toast.error("Completá todos los campos");
      return;
    }
    if (ascensoCatOrigen === ascensoCatDestino) {
      toast.error("La categoría destino debe ser diferente a la origen");
      return;
    }
    setSavingAscenso(true);
    const ptsTransferidos = Math.floor(ascensoPuntosOrigen / 2);

    // Buscar si ya existe un registro de ascenso para este jugador en las mismas categorías
    const { data: ascExistente } = await (supabase as any)
      .from("ascensos")
      .select("id")
      .eq("jugador_id", ascensoJugadorId)
      .eq("categoria_origen_id", ascensoCatOrigen)
      .eq("categoria_destino_id", ascensoCatDestino)
      .eq("anio", filtroAnio)
      .maybeSingle();

    let error = null;
    if (ascExistente) {
      const res = await (supabase as any)
        .from("ascensos")
        .update({
          puntos_origen: ascensoPuntosOrigen,
          puntos_transferidos: ptsTransferidos,
          notas: ascensoNotas || null,
        })
        .eq("id", (ascExistente as any).id);
      error = res.error;
    } else {
      const res = await (supabase as any).from("ascensos").insert({
        jugador_id: ascensoJugadorId,
        categoria_origen_id: ascensoCatOrigen,
        categoria_destino_id: ascensoCatDestino,
        puntos_origen: ascensoPuntosOrigen,
        puntos_transferidos: ptsTransferidos,
        anio: filtroAnio,
        notas: ascensoNotas || null,
      });
      error = res.error;
    }

    if (error) {
      toast.error("Error al guardar: " + error.message);
      setSavingAscenso(false);
      return;
    }

    // Buscar equivalente en categorias_jugadores
    const catDestinoTorneo = categorias.find(c => c.id === ascensoCatDestino);
    if (catDestinoTorneo) {
      const { data: catJug } = await (supabase as any)
        .from("categorias_jugadores")
        .select("id")
        .eq("nombre", catDestinoTorneo.nombre)
        .eq("genero", catDestinoTorneo.genero)
        .maybeSingle();
      if ((catJug as any)?.id) {
        await (supabase as any).from("jugadores").update({ categoria_id: (catJug as any).id }).eq("id", ascensoJugadorId);
      }
    }

    // Recalcular todos los ascensos del año para garantizar coherencia
    await recalcularTodosLosAscensos(filtroAnio);
    
    toast.success(`Ascenso guardado. ${ptsTransferidos} puntos transferidos.`);
    setSavingAscenso(false);
    setAscensoOpen(false);
    resetAscensoForm();
    cargarRanking();
    cargarAscensos();
  };

  const resetAscensoForm = () => {
    setAscensoJugadorId("");
    setAscensoCatOrigen("");
    setAscensoCatDestino("");
    setAscensoPuntosOrigen(0);
    setAscensoNotas("");
    setAscensoJugadorBusqueda("");
    setAscensoJugadores([]);
  };

  const cargarAscensos = async () => {
    const { data } = await (supabase as any)
      .from("ascensos")
      .select("*")
      .eq("anio", filtroAnio)
      .order("fecha", { ascending: false });
    if (!data || (data as any[]).length === 0) { setAscensosList([]); return; }
    const jugIds = Array.from(new Set((data as any[]).map((a: any) => a.jugador_id)));
    // Chunk jugIds array to avoid URL length limit in Supabase (.in with many elements)
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < jugIds.length; i += chunkSize) {
      chunks.push(jugIds.slice(i, i + chunkSize));
    }
    
    let jugs: { id: string; nombre: string; apellido: string }[] = [];
    try {
      const results = await Promise.all(
        chunks.map(chunk => 
          (supabase as any)
            .from("jugadores")
            .select("id, nombre, apellido")
            .in("id", chunk)
        )
      );
      
      for (const res of results) {
        if (res.error) {
          console.error("Error fetching chunk of jugadores in ascensos:", res.error);
        }
        if (res.data) {
          jugs = [...jugs, ...res.data];
        }
      }
    } catch (err) {
      console.error("Error fetching jugadores in chunks for ascensos:", err);
    }

    setAscensosList((data as any[]).map((a: any) => {
      const j = jugs?.find((x) => x.id === a.jugador_id);
      return { ...a, jugador_nombre: j?.nombre, jugador_apellido: j?.apellido };
    }));
  };

  const eliminarAscenso = async (id: string) => {
    const { error } = await supabase.from("ascensos").delete().eq("id", id);
    if (error) { toast.error("Error: " + error.message); return; }
    await recalcularTodosLosAscensos(filtroAnio);
    toast.success("Ascenso eliminado");
    cargarAscensos();
    cargarRanking();
  };

  useEffect(() => {
    if (!loading) cargarAscensos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio, loading]);

  // Categorías del mismo género para ascensos
  const categoriasOrigenGenero = useMemo(() => {
    if (!ascensoCatOrigen) return categorias;
    const catOrigen = categorias.find(c => c.id === ascensoCatOrigen);
    if (!catOrigen) return categorias;
    return categorias.filter(c => c.genero === catOrigen.genero);
  }, [ascensoCatOrigen, categorias]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Ranking
          </h1>
          <p className="text-sm text-muted-foreground">
            Puntaje acumulado por jugador. Define quiénes clasifican al Master de fin de año.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={exportarPDFMaster}
            disabled={exportingMaster}
          >
            {exportingMaster ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar PDF Master
          </Button>
          <Button variant="outline" size="sm" onClick={() => { resetAscensoForm(); setAscensoOpen(true); }}>
            <ArrowUpCircle className="h-4 w-4" />
            Registrar ascenso
          </Button>
          <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
                Tabla de puntos
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Puntos por instancia</DialogTitle>
                <DialogDescription>
                  Define cuántos puntos otorga cada instancia alcanzada en un torneo. La 4ta fecha
                  multiplica los puntos x2 (configurable por torneo). Después de cambiar los valores,
                  recalculá los torneos finalizados para aplicar la nueva tabla.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {puntosCfg.map((p) => (
                  <div key={p.instancia} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{INSTANCIA_LABEL[p.instancia]}</span>
                    <Input
                      type="number"
                      min="0"
                      value={p.puntos}
                      onChange={(e) => updatePunto(p.instancia, e.target.value)}
                      className="w-24 h-8 text-right"
                    />
                    <span className="text-xs text-muted-foreground w-10">pts</span>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCfgOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarPuntos} disabled={savingCfg}>
                  <Save className="h-4 w-4" />
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Filtros</CardTitle>
          <Button
            onClick={copiarEnlacePublico}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-all active:scale-95"
          >
            {copiado ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copiado ? "¡Enlace Copiado!" : "Copiar Enlace Público para Compartir"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Año</label>
            <Select value={String(filtroAnio)} onValueChange={(v) => setFiltroAnio(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aniosDisp.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Categoría</label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Género</label>
            <Select value={filtroGenero} onValueChange={setFiltroGenero}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENEROS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Buscar jugador</label>
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, apellido o club"
            />
          </div>
        </CardContent>
      </Card>

      {cupoActual !== null && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-primary" />
              <span>
                Clasifican al <strong>Master</strong> los primeros{" "}
                <strong>{cupoActual}</strong> jugadores de esta categoría.
              </span>
            </div>
            <Dialog
              open={cupoOpen}
              onOpenChange={(o) => {
                setCupoOpen(o);
                if (o) setCupoEdit(String(cupoActual));
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Settings className="h-3.5 w-3.5" />
                  Editar cupos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cupos al Master</DialogTitle>
                  <DialogDescription>
                    ¿Cuántos jugadores de esta categoría clasifican al Master? Por defecto son 16,
                    salvo Suma 7 que son 8.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  type="number"
                  min="1"
                  value={cupoEdit}
                  onChange={(e) => setCupoEdit(e.target.value)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCupoOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={guardarCupo}>
                    <Save className="h-4 w-4" />
                    Guardar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando...</p>
          ) : filtradas.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay puntos cargados con esos filtros. Finalizá un torneo y recalculá su ranking
              desde la página de Torneos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Jugador</TableHead>
                  <TableHead className="hidden sm:table-cell">Club</TableHead>
                  <TableHead className="text-center">Torneos</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((r, idx) => {
                  const clasifica = cupoActual !== null && idx < cupoActual && !busqueda.trim();
                  return (
                    <TableRow key={r.jugador_id} className={clasifica ? "bg-primary/5" : ""}>
                      <TableCell>
                        <div className="flex items-center justify-center">{medalla(idx)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          {r.jugador_apellido}, {r.jugador_nombre}
                          {clasifica && <Star className="h-3 w-3 text-primary fill-primary" />}
                        </div>
                        {r.jugador_club && (
                          <div className="sm:hidden text-xs text-muted-foreground">{r.jugador_club}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {r.jugador_club ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{r.torneos_jugados}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {r.puntos_totales}
                        {r.puntos_ascenso > 0 && (
                          <span className="text-xs text-primary ml-1" title="Incluye puntos por ascenso">
                            (+{r.puntos_ascenso})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => abrirDetalle(r)}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detalleJugador
                ? `${detalleJugador.jugador_apellido}, ${detalleJugador.jugador_nombre}`
                : "Detalle"}
            </DialogTitle>
            <DialogDescription>
              Desglose de puntos por torneo en {filtroAnio}
              {detalleJugador?.jugador_club ? ` · ${detalleJugador.jugador_club}` : ""}
            </DialogDescription>
          </DialogHeader>
          {loadingDetalle ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>
          ) : detalleData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay torneos cargados para este jugador con los filtros actuales.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {detalleData.map((d, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{d.torneo_nombre}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      {d.fecha && <span>{new Date(d.fecha).toLocaleDateString()}</span>}
                      {d.numero_fecha && (
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">
                          Fecha {d.numero_fecha}
                        </Badge>
                      )}
                      <span>· {INSTANCIA_LABEL[d.instancia]}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-base">{d.puntos}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {d.puntos_base}
                      {d.multiplicador !== 1 && ` × ${d.multiplicador}`}
                    </div>
                  </div>
                </div>
              ))}
              {detalleJugador && detalleJugador.puntos_ascenso > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      <ArrowUpCircle className="h-3.5 w-3.5 text-primary" />
                      Puntos por ascenso
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Transferidos de categoría anterior (50%)
                      {detalleAscensoNotas && <span className="block mt-1 font-medium text-primary">Nota: {detalleAscensoNotas}</span>}
                    </div>
                  </div>
                  <div className="font-bold text-base">{detalleJugador.puntos_ascenso}</div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t font-semibold">
                <span>Total</span>
                <span>{(detalleData.reduce((acc, d) => acc + d.puntos, 0) + (detalleJugador?.puntos_ascenso ?? 0))} pts</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Ascenso */}
      <Dialog open={ascensoOpen} onOpenChange={(o) => { setAscensoOpen(o); if (!o) resetAscensoForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5" />
              Registrar ascenso
            </DialogTitle>
            <DialogDescription>
              El jugador sube de categoría y se transfiere la mitad de sus puntos a la nueva categoría.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Buscar jugador</label>
              <Input
                value={ascensoJugadorBusqueda}
                onChange={(e) => buscarJugadoresAscenso(e.target.value)}
                placeholder="Nombre o apellido..."
              />
              {ascensoJugadores.length > 0 && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                  {ascensoJugadores.map((j) => {
                    const catLabel = j.cat_nombre;
                    return (
                      <button
                        key={j.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between"
                        onClick={() => seleccionarJugadorAscenso(j)}
                      >
                        <span>{j.apellido}, {j.nombre}</span>
                        {catLabel && <span className="text-muted-foreground text-xs">{catLabel}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {ascensoJugadorId && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Categoría origen</label>
                  <Select value={ascensoCatOrigen} onValueChange={async (catId) => {
                    setAscensoCatOrigen(catId);
                    // Recalcular puntos para la categoría seleccionada
                    const { data: rd } = await supabase
                      .from("ranking_jugadores")
                      .select("puntos")
                      .eq("jugador_id", ascensoJugadorId)
                      .eq("categoria_id", catId)
                      .eq("anio", filtroAnio);
                    const totalT = (rd ?? []).reduce((acc, r) => acc + r.puntos, 0);
                    const { data: ap } = await supabase
                      .from("ascensos")
                      .select("puntos_transferidos")
                      .eq("jugador_id", ascensoJugadorId)
                      .eq("categoria_destino_id", catId)
                      .eq("anio", filtroAnio);
                    const totalA = (ap ?? []).reduce((acc, a) => acc + a.puntos_transferidos, 0);
                    setAscensoPuntosOrigen(totalT + totalA);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Categoría destino (a la que asciende)</label>
                  <Select value={ascensoCatDestino} onValueChange={setAscensoCatDestino}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {categoriasOrigenGenero.filter(c => c.id !== ascensoCatOrigen).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Puntos en categoría origen (Editables)</label>
                    <Input
                      type="number"
                      min="0"
                      value={ascensoPuntosOrigen}
                      onChange={(e) => setAscensoPuntosOrigen(Number(e.target.value) || 0)}
                      className="h-8 font-bold text-sm bg-background"
                    />
                  </div>
                  <div className="flex justify-between text-sm text-primary font-medium border-t pt-1.5">
                    <span>Puntos transferidos a nueva categoría (50%)</span>
                    <span className="font-bold">{Math.floor(ascensoPuntosOrigen / 2)} pts</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notas (opcional)</label>
                  <Input value={ascensoNotas} onChange={(e) => setAscensoNotas(e.target.value)} placeholder="Ej: Ascenso por decisión del comité" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAscensoOpen(false)}>Cancelar</Button>
            <Button onClick={guardarAscenso} disabled={savingAscenso || !ascensoJugadorId}>
              <Save className="h-4 w-4" />
              Confirmar ascenso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista de ascensos */}
      {ascensosList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Ascensos registrados ({filtroAnio})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>A</TableHead>
                  <TableHead className="text-right">Pts transferidos</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ascensosList.map((a) => {
                  const catOr = categorias.find(c => c.id === a.categoria_origen_id);
                  const catDe = categorias.find(c => c.id === a.categoria_destino_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.jugador_apellido}, {a.jugador_nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{catOr?.nombre ?? "?"}</TableCell>
                      <TableCell className="text-sm">{catDe?.nombre ?? "?"}</TableCell>
                      <TableCell className="text-right font-bold">{a.puntos_transferidos}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => eliminarAscenso(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
