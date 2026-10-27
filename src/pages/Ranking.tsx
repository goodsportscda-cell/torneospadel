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
import {
  Trophy,
  Settings,
  Save,
  Medal,
  Star,
  Eye,
  ArrowUpCircle,
  Trash2,
  Share2,
  Check,
  Download,
  Loader2,
  Sparkles,
  Users,
  Ban,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import {
  INSTANCIA_LABEL,
  type Instancia,
  recalcularTodosLosAscensos,
  isAscenso,
  construirContextoAscensosYTorneos,
  aplicarReglasMaster,
  getCupoDefaultCategoria,
  isCategoriaSuma,
  actualizarMasterStatusJugador,
  TORNEOS_REQUERIDOS_MASTER,
  TORNEOS_TOTALES_ANIO,
  type MasterStatus,
} from "@/lib/ranking";
import { type RankingRowUnified } from "@/hooks/useClubRanking";
import { MasterPlacaModal, type PlacaJugadorItem } from "@/components/ranking/MasterPlacaModal";
import { useAuth } from "@/hooks/useAuth";
import { useClubBrand } from "@/hooks/useClubBrand";
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

export default function Ranking() {
  const { clubId } = useAuth();
  const clubBrand = useClubBrand();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankingRowUnified[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aniosDisp, setAniosDisp] = useState<number[]>([]);
  const [cuposMaster, setCuposMaster] = useState<Record<string, number>>({});

  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroGenero, setFiltroGenero] = useState<string>("todos");
  const [vistaModo, setVistaModo] = useState<"general" | "master">("general");
  const [busqueda, setBusqueda] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [placaOpen, setPlacaOpen] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const copiarEnlacePublico = async () => {
    if (!clubId) return toast.error("Elegí un club antes de compartir el ranking.");
    const { data: club, error } = await supabase
      .from("clubes")
      .select("slug")
      .eq("id", clubId)
      .maybeSingle();
    if (error || !club)
      return toast.error("No se pudo identificar el club para compartir el ranking.");
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
    if (vistaModo === "master") {
      params.set("vista", "master");
    }
    const queryString = params.toString();
    const ruta =
      club.slug === "goodsports"
        ? "/ranking-publico"
        : `/c/${club.slug}/ranking-publico`;
    const url = `${window.location.origin}${ruta}${queryString ? "?" + queryString : ""}`;
    navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("¡Enlace del ranking público copiado! Listo para compartir en WhatsApp.");
    setTimeout(() => setCopiado(false), 2000);
  };

  const [exportingMaster, setExportingMaster] = useState(false);

  const exportarPDFMaster = async () => {
    if (!clubId) return;
    setExportingMaster(true);
    try {
      const [{ data: allCats }, { data: cupos }, { data: ascData }] = await Promise.all([
        supabase
          .from("categorias")
          .select("id, nombre, genero, orden")
          .eq("activa", true)
          .eq("club_id", clubId)
          .order("orden"),
        supabase.from("cupos_master").select("categoria_id, cupos"),
        supabase
          .from("ascensos")
          .select("jugador_id, categoria_origen_id, categoria_destino_id, created_at, fecha")
          .eq("anio", filtroAnio),
      ]);

      const cuposMap = new Map<string, number>();
      (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) =>
        cuposMap.set(c.categoria_id, c.cupos)
      );

      const masterCats = (allCats ?? []) as Categoria[];
      const catIds = masterCats.map((c) => c.id);

      let rankingAll: any[] = [];
      if (catIds.length > 0) {
        const { data: rData, error: rErr } = await (supabase as any)
          .from("ranking_jugadores")
          .select("jugador_id, puntos, torneo_id, categoria_id, instancia, master_status")
          .eq("anio", filtroAnio)
          .in("categoria_id", catIds);
        if (rErr && String(rErr.message || "").includes("master_status")) {
          const { data: rFallback } = await supabase
            .from("ranking_jugadores")
            .select("jugador_id, puntos, torneo_id, categoria_id, instancia")
            .eq("anio", filtroAnio)
            .in("categoria_id", catIds);
          rankingAll = rFallback ?? [];
        } else {
          rankingAll = rData ?? [];
        }
      }

      const { ascendidosDesde, obtenerMetricasMasterJugador } = construirContextoAscensosYTorneos({
        categorias: masterCats,
        ascensos: (ascData ?? []) as any[],
        rankingRows: rankingAll,
      });

      type ClasificadoRowData = {
        jugador_id: string;
        apellido: string;
        nombre: string;
        club: string | null;
        puntos: number;
        torneos_jugados: number;
      };

      type CatMasterData = {
        categoria: Categoria;
        cupos: number;
        clasificados: ClasificadoRowData[];
      };

      // Obtener datos de jugadores involucrados
      const allJugIds = Array.from(new Set(rankingAll.map((r) => r.jugador_id)));
      const jugMap = new Map<string, { id: string; nombre: string; apellido: string; club: string | null }>();
      for (let i = 0; i < allJugIds.length; i += 100) {
        const chunk = allJugIds.slice(i, i + 100);
        const { data: jugData } = await supabase
          .from("jugadores_publicos" as any)
          .select("id, nombre, apellido, club")
          .in("id", chunk);
        (jugData ?? []).forEach((j: any) => jugMap.set(j.id, j));
      }

      const masterData: CatMasterData[] = [];

      for (const cat of masterCats) {
        const defCupo = getCupoDefaultCategoria(cat.nombre);
        const cuposCount = cuposMap.get(cat.id) ?? defCupo;

        const catRows = rankingAll.filter((r) => r.categoria_id === cat.id);
        const ascendidosCat = ascendidosDesde.get(cat.id) ?? new Set<string>();

        const puntosMap = new Map<string, { ptsTorneos: number; ptsAscenso: number }>();
        catRows.forEach((r) => {
          if (ascendidosCat.has(r.jugador_id)) return;
          const cur = puntosMap.get(r.jugador_id) ?? { ptsTorneos: 0, ptsAscenso: 0 };
          if (isAscenso(r.instancia)) {
            cur.ptsAscenso = Math.max(cur.ptsAscenso, r.puntos);
          } else {
            cur.ptsTorneos += r.puntos;
          }
          puntosMap.set(r.jugador_id, cur);
        });

        const candidatos = Array.from(puntosMap.entries())
          .map(([jId, ptsObj]) => {
            const j = jugMap.get(jId);
            const m = obtenerMetricasMasterJugador(jId, cat.id);
            return {
              jugador_id: jId,
              apellido: j?.apellido ?? "?",
              nombre: j?.nombre ?? "?",
              club: j?.club ?? null,
              puntos: ptsObj.ptsTorneos + ptsObj.ptsAscenso,
              torneos_jugados: m.torneos_jugados,
              master_status: m.master_status,
            };
          })
          .sort((a, b) => b.puntos - a.puntos);

        const evaluados = aplicarReglasMaster(candidatos, cuposCount);
        const clasificados = evaluados.filter((e) => e.clasifica_master);

        if (clasificados.length > 0) {
          masterData.push({
            categoria: cat,
            cupos: cuposCount,
            clasificados,
          });
        }
      }

      const totalClasificados = masterData.reduce((acc, d) => acc + d.clasificados.length, 0);
      if (totalClasificados === 0) {
        toast.error(
          "No hay clasificados elegibles (mín. 4 torneos) para el año seleccionado."
        );
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
        pdf.text(`Clasificados al Master ${filtroAnio}`, pageW / 2, marginTop + 2, {
          align: "center",
        });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(120);
        pdf.text(
          `Generado el ${new Date().toLocaleDateString("es-AR")} · ${totalClasificados} clasificados elegibles (4+ torneos) en ${masterData.length} categorías`,
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
          pdf.text("Sin clasificados aún.", x + 3, y + headerH + 4);
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

  const [puntosCfg, setPuntosCfg] = useState<
    { instancia: Instancia; puntos: number; orden: number }[]
  >([]);
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
  const [ascensoJugadores, setAscensoJugadores] = useState<
    {
      id: string;
      nombre: string;
      apellido: string;
      categoria_id: string | null;
      cat_nombre?: string;
    }[]
  >([]);
  const [ascensoJugadorId, setAscensoJugadorId] = useState<string>("");
  const [ascensoCatOrigen, setAscensoCatOrigen] = useState<string>("");
  const [ascensoCatDestino, setAscensoCatDestino] = useState<string>("");
  const [ascensoPuntosOrigen, setAscensoPuntosOrigen] = useState<number>(0);
  const [ascensoNotas, setAscensoNotas] = useState("");
  const [savingAscenso, setSavingAscenso] = useState(false);
  const [ascensosList, setAscensosList] = useState<
    (Ascenso & { jugador_nombre?: string; jugador_apellido?: string })[]
  >([]);

  const cargarTodo = async () => {
    if (!clubId) return;
    setLoading(true);
    const [{ data: cats }, { data: cfg }, { data: anios }, { data: cupos }] =
      await Promise.all([
        supabase
          .from("categorias")
          .select("id, nombre, genero, orden")
          .eq("activa", true)
          .eq("club_id", clubId),
        (supabase as any)
          .from("puntos_ranking")
          .select("instancia, puntos, orden")
          .eq("club_id", clubId)
          .order("orden"),
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
      { nombre: "Suma 8", genero: "caballeros", orden: 10 },
      { nombre: "1ra", genero: "damas", orden: 11 },
      { nombre: "2da", genero: "damas", orden: 12 },
      { nombre: "3ra", genero: "damas", orden: 13 },
      { nombre: "4ta", genero: "damas", orden: 14 },
      { nombre: "5ta", genero: "damas", orden: 15 },
      { nombre: "6ta", genero: "damas", orden: 16 },
      { nombre: "7ma", genero: "damas", orden: 17 },
      { nombre: "8va", genero: "damas", orden: 18 },
      { nombre: "Suma 8", genero: "damas", orden: 19 },
    ];

    const categoriesToInsert = [];
    const categoriesToUpdate = [];

    for (const ec of expectedCats) {
      const existing = loadedCats.find(
        (lc) =>
          lc.nombre.toLowerCase() === ec.nombre.toLowerCase() && lc.genero === ec.genero
      );
      if (!existing) {
        categoriesToInsert.push({ ...ec, club_id: clubId });
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

      const idx = loadedCats.findIndex((lc) => lc.id === item.id);
      if (idx !== -1) {
        loadedCats[idx].orden = item.orden;
      }
    }

    loadedCats.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    setCategorias(loadedCats);
    setPuntosCfg(
      (cfg ?? []) as { instancia: Instancia; puntos: number; orden: number }[]
    );
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

  // Cupos al Master en la categoría filtrada (si aplica)
  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === filtroCategoria) ?? null,
    [categorias, filtroCategoria]
  );

  const cupoActual = useMemo(() => {
    if (!categoriaSeleccionada) return null;
    const def = getCupoDefaultCategoria(categoriaSeleccionada.nombre);
    return cuposMaster[filtroCategoria] ?? def;
  }, [filtroCategoria, categoriaSeleccionada, cuposMaster]);

  const esSuma8 = useMemo(
    () => isCategoriaSuma(categoriaSeleccionada?.nombre),
    [categoriaSeleccionada]
  );

  const cargarRanking = async () => {
    if (!clubId) return;
    const [{ data: clubCategories }, { data: clubTournaments }] = await Promise.all([
      supabase.from("categorias").select("id, nombre, genero").eq("club_id", clubId),
      supabase.from("torneos").select("id").eq("club_id", clubId),
    ]);
    const categoriasClub = (clubCategories ?? []) as Categoria[];
    const categoryIds = new Set(categoriasClub.map((category) => category.id));
    const tournamentIds = new Set(
      (clubTournaments ?? []).map((tournament) => tournament.id)
    );

    // Traemos todas las filas del año para poder contar torneos de categoría origen en ascensos
    let rankingData: any[] = [];
    let isFetchingRanking = true;
    let rankingOffset = 0;
    const step = 1000;
    let includeMasterStatus = true;

    while (isFetchingRanking) {
      const cols = includeMasterStatus
        ? "jugador_id, puntos, torneo_id, categoria_id, genero, anio, instancia, master_status"
        : "jugador_id, puntos, torneo_id, categoria_id, genero, anio, instancia";

      const { data, error } = await (supabase as any)
        .from("ranking_jugadores")
        .select(cols)
        .eq("anio", filtroAnio)
        .order("id")
        .range(rankingOffset, rankingOffset + step - 1);

      if (error) {
        if (includeMasterStatus && String(error.message || "").includes("master_status")) {
          includeMasterStatus = false;
          continue;
        }
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

    const allClubRankingData = rankingData.filter((row) =>
      isAscenso(row.instancia)
        ? categoryIds.has(row.categoria_id)
        : Boolean(row.torneo_id && tournamentIds.has(row.torneo_id))
    );

    // Cargar todos los ascensos del año para deduplicar y calcular exclusión + torneos previos
    const { data: ascensosAllData } = await supabase
      .from("ascensos")
      .select(
        "jugador_id, categoria_origen_id, categoria_destino_id, created_at, fecha"
      )
      .eq("anio", filtroAnio);

    const validAscensos = (ascensosAllData ?? []).filter(
      (a) =>
        categoryIds.has(a.categoria_origen_id) &&
        categoryIds.has(a.categoria_destino_id)
    );

    const { ascendidosDesde, obtenerMetricasMasterJugador } =
      construirContextoAscensosYTorneos({
        categorias: categoriasClub,
        ascensos: validAscensos,
        rankingRows: allClubRankingData,
      });

    // Filtrar para la vista seleccionada
    const data = allClubRankingData.filter((r) => {
      if (filtroCategoria !== "todas" && r.categoria_id !== filtroCategoria) return false;
      if (filtroGenero !== "todos" && r.genero !== filtroGenero) return false;
      return true;
    });

    // Agrupar por jugador, excluyendo puntos de categorías desde las que ascendieron
    const map = new Map<
      string,
      {
        puntos: number;
        ptsAscenso: number;
        primaryCatId: string | null;
        ptsPorCat: Map<string, number>;
      }
    >();

    (data ?? []).forEach((r) => {
      const catAscendidos = ascendidosDesde.get(r.categoria_id);
      if (catAscendidos && catAscendidos.has(r.jugador_id)) {
        return; // skip — ya ascendió de esta categoría
      }

      const cur = map.get(r.jugador_id) ?? {
        puntos: 0,
        ptsAscenso: 0,
        primaryCatId: r.categoria_id ?? null,
        ptsPorCat: new Map<string, number>(),
      };

      if (r.categoria_id) {
        cur.ptsPorCat.set(
          r.categoria_id,
          (cur.ptsPorCat.get(r.categoria_id) ?? 0) + r.puntos
        );
      }

      if (isAscenso(r.instancia)) {
        cur.ptsAscenso = Math.max(cur.ptsAscenso, r.puntos);
      } else {
        cur.puntos += r.puntos;
      }
      map.set(r.jugador_id, cur);
    });

    const ids = Array.from(map.keys());
    if (ids.length === 0) {
      setRows([]);
      return;
    }

    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }

    let jugadores: {
      id: string;
      nombre: string;
      apellido: string;
      club: string | null;
      categoria_id: string | null;
    }[] = [];
    try {
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from("jugadores_publicos" as any)
            .select("id, nombre, apellido, club, categoria_id")
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

    const { data: playerCategories } = await (supabase as any)
      .from("jugador_categorias_publicas")
      .select("jugador_id, categoria_id, categoria_nombre, genero")
      .eq("club_id", clubId)
      .in("jugador_id", ids);
    const playerCategoryById = new Map<string, any>(
      (playerCategories ?? []).map((row: any) => [row.jugador_id, row])
    );

    const baseResult: RankingRowUnified[] = ids.map((id) => {
      const j = jugadores?.find((x) => x.id === id);
      const m = map.get(id)!;
      const playerCategory = playerCategoryById.get(id);

      let evalCatId: string | null =
        filtroCategoria !== "todas" ? filtroCategoria : m.primaryCatId;
      if (filtroCategoria === "todas" && m.ptsPorCat.size > 0) {
        let bestPts = -1;
        m.ptsPorCat.forEach((pts, cId) => {
          if (pts > bestPts) {
            bestPts = pts;
            evalCatId = cId;
          }
        });
      }

      const metricasMaster = obtenerMetricasMasterJugador(id, evalCatId);

      return {
        posicion: 0,
        jugador_id: id,
        puntos_totales: m.puntos + m.ptsAscenso,
        puntos_torneos: m.puntos,
        puntos_ascenso: m.ptsAscenso,
        torneos_jugados: metricasMaster.torneos_jugados,
        torneos_en_categoria: metricasMaster.torneos_en_categoria,
        torneos_categoria_anterior: metricasMaster.torneos_categoria_anterior,
        es_ascendido: metricasMaster.es_ascendido,
        master_status: metricasMaster.master_status,
        categoria_ranking_id: evalCatId,
        jugador_nombre: j?.nombre ?? "?",
        jugador_apellido: j?.apellido ?? "?",
        jugador_club: j?.club ?? null,
        jugador_categoria_id: playerCategory?.categoria_id ?? null,
        jugador_categoria_nombre: playerCategory?.categoria_nombre ?? null,
        jugador_categoria_genero: playerCategory?.genero ?? null,
        desglose: [],
      };
    });

    baseResult.sort((a, b) => b.puntos_totales - a.puntos_totales);
    baseResult.forEach((r, i) => {
      r.posicion = i + 1;
    });

    const cupoEfectivo =
      cupoActual ?? getCupoDefaultCategoria(categoriaSeleccionada?.nombre ?? null);
    const result = aplicarReglasMaster(baseResult, cupoEfectivo);

    setRows(result);
  };

  useEffect(() => {
    if (!clubId) return;
    setRows([]);
    setCategorias([]);
    setAscensosList([]);
    setLoading(true);
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    if (!loading) cargarRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio, filtroCategoria, filtroGenero, loading, clubId, cupoActual]);

  const handleCambiarMasterStatus = async (
    row: RankingRowUnified,
    newStatus: MasterStatus
  ) => {
    const catId =
      filtroCategoria !== "todas"
        ? filtroCategoria
        : row.categoria_ranking_id ?? row.jugador_categoria_id;
    if (!catId) {
      toast.error(
        "Seleccioná una categoría en el filtro superior para cambiar el estado del Master de este jugador."
      );
      return;
    }

    setUpdatingStatusId(row.jugador_id);
    const res = await actualizarMasterStatusJugador({
      jugadorId: row.jugador_id,
      categoriaId: catId,
      anio: filtroAnio,
      status: newStatus,
    });
    setUpdatingStatusId(null);

    if (!res.ok) {
      if (String(res.error || "").includes("master_status")) {
        toast.error(
          "Falta agregar la columna master_status en Supabase. Ejecutá el script SQL indicado."
        );
      } else {
        toast.error("No se pudo actualizar el estado: " + res.error);
      }
      return;
    }

    toast.success("Estado de Master actualizado");
    cargarRanking();
  };

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

  const clasificadosMaster = useMemo(
    () => filtradas.filter((r) => r.clasifica_master),
    [filtradas]
  );

  const suplentesMaster = useMemo(
    () => filtradas.filter((r) => r.es_suplente_master),
    [filtradas]
  );

  const placaClasificados: PlacaJugadorItem[] = useMemo(
    () =>
      rows
        .filter((r) => r.clasifica_master)
        .map((r) => ({
          jugador_id: r.jugador_id,
          nombre: r.jugador_nombre,
          apellido: r.jugador_apellido,
          club: r.jugador_club,
          puntos: r.puntos_totales,
          torneos_jugados: r.torneos_jugados,
          posicion_general: r.posicion,
          posicion_master: r.posicion_master ?? r.posicion,
        })),
    [rows]
  );

  const placaSuplentes: PlacaJugadorItem[] = useMemo(
    () =>
      rows
        .filter((r) => r.es_suplente_master)
        .map((r) => ({
          jugador_id: r.jugador_id,
          nombre: r.jugador_nombre,
          apellido: r.jugador_apellido,
          club: r.jugador_club,
          puntos: r.puntos_totales,
          torneos_jugados: r.torneos_jugados,
          posicion_general: r.posicion,
          posicion_master: r.posicion_master ?? r.posicion,
          orden_suplente: r.orden_suplente,
        })),
    [rows]
  );

  const handleAbrirPlaca = () => {
    if (filtroCategoria === "todas") {
      if (categorias.length > 0) {
        setFiltroCategoria(categorias[0].id);
        toast.info("Seleccionamos la primera categoría para generar la placa.");
      } else {
        toast.error("Seleccioná una categoría primero para generar la placa.");
        return;
      }
    }
    setPlacaOpen(true);
  };

  const guardarPuntos = async () => {
    setSavingCfg(true);
    try {
      for (const p of puntosCfg) {
        const { error } = await (supabase as any)
          .from("puntos_ranking")
          .update({ puntos: p.puntos })
          .eq("instancia", p.instancia)
          .eq("club_id", clubId);
        if (error) throw error;
      }
      toast.success(
        "Puntos actualizados. Recalculá los torneos finalizados para aplicar."
      );
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
      .upsert(
        { categoria_id: filtroCategoria, cupos: num },
        { onConflict: "categoria_id" }
      );
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
      const { data: playerAscensos } = await (supabase as any)
        .from("ascensos")
        .select("categoria_origen_id, categoria_destino_id, notas")
        .eq("jugador_id", jugador.jugador_id)
        .eq("anio", filtroAnio)
        .in(
          "categoria_origen_id",
          categorias.map((c) => c.id)
        )
        .in(
          "categoria_destino_id",
          categorias.map((c) => c.id)
        );
      const ascendidosDesdeIds = new Set(
        (playerAscensos ?? []).map((a: any) => a.categoria_origen_id)
      );
      const activeAscensos = (playerAscensos ?? []).filter((a: any) => {
        const isSuperseded = (playerAscensos ?? []).some(
          (b: any) => b.categoria_origen_id === a.categoria_destino_id
        );
        if (isSuperseded) return false;
        if (filtroCategoria !== "todas" && a.categoria_destino_id !== filtroCategoria)
          return false;
        return true;
      });
      const notasList = activeAscensos.map((a: any) => a.notas).filter(Boolean);
      setDetalleAscensoNotas(notasList.length > 0 ? notasList.join(" | ") : null);

      let q = supabase
        .from("ranking_jugadores")
        .select("torneo_id, instancia, puntos, categoria_id")
        .eq("jugador_id", jugador.jugador_id)
        .eq("anio", filtroAnio)
        .in(
          "categoria_id",
          categorias.map((c) => c.id)
        );
      if (filtroCategoria !== "todas") q = q.eq("categoria_id", filtroCategoria);
      if (filtroGenero !== "todos") q = q.eq("genero", filtroGenero);
      const { data: rj, error } = await q;
      if (error) throw error;

      const rjFiltrados = (rj ?? []).filter((r) => {
        return !ascendidosDesdeIds.has(r.categoria_id) && !isAscenso(r.instancia);
      });

      const torneoIds = Array.from(new Set(rjFiltrados.map((r) => r.torneo_id)));
      let torneos: Array<{
        id: string;
        nombre: string;
        fecha_inicio: string | null;
        numero_fecha: number | null;
        multiplicador_puntos: number | null;
      }> = [];
      if (torneoIds.length > 0) {
        const { data: tData } = await supabase
          .from("torneos")
          .select("id, nombre, fecha_inicio, numero_fecha, multiplicador_puntos")
          .in("id", torneoIds)
          .eq("club_id", clubId);
        if (tData) torneos = tData;
      }

      const { data: puntosCfgData } = await (supabase as any)
        .from("puntos_ranking")
        .select("instancia, puntos")
        .eq("club_id", clubId);
      const puntosBaseMap = new Map<string, number>();
      (puntosCfgData ?? []).forEach((p: any) => puntosBaseMap.set(p.instancia, p.puntos));

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
    if (q.length < 2) {
      setAscensoJugadores([]);
      return;
    }
    const { data } = await (supabase as any)
      .from("jugadores_publicos")
      .select("id, nombre, apellido, categoria_id")
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
      .limit(10);
    if (!data || data.length === 0) {
      setAscensoJugadores([]);
      return;
    }
    const catIds = [
      ...new Set(
        (data as any[]).filter((j) => j.categoria_id).map((j) => j.categoria_id!)
      ),
    ];
    const { data: catsJ } =
      catIds.length > 0
        ? await (supabase as any)
            .from("categorias_jugadores")
            .select("id, nombre")
            .in("id", catIds)
        : { data: [] };
    const catMap = new Map(((catsJ as any[]) ?? []).map((c) => [c.id, c.nombre]));
    setAscensoJugadores(
      (data as any[]).map((j) => ({
        ...j,
        cat_nombre: j.categoria_id ? catMap.get(j.categoria_id) ?? undefined : undefined,
      }))
    );
  };

  const seleccionarJugadorAscenso = async (j: {
    id: string;
    nombre: string;
    apellido: string;
    categoria_id: string | null;
  }) => {
    setAscensoJugadorId(j.id);
    setAscensoJugadorBusqueda(`${j.apellido}, ${j.nombre}`);
    setAscensoJugadores([]);

    const { data: rankData } = await supabase
      .from("ranking_jugadores")
      .select("categoria_id, puntos")
      .eq("jugador_id", j.id)
      .eq("anio", filtroAnio)
      .in(
        "categoria_id",
        categorias.map((category) => category.id)
      );

    const puntosXCat = new Map<string, number>();
    (rankData ?? []).forEach((r) => {
      if (!r.categoria_id) return;
      puntosXCat.set(r.categoria_id, (puntosXCat.get(r.categoria_id) ?? 0) + r.puntos);
    });

    const { data: ascPrev } = await supabase
      .from("ascensos")
      .select("categoria_destino_id, puntos_transferidos")
      .eq("jugador_id", j.id)
      .eq("anio", filtroAnio)
      .in(
        "categoria_destino_id",
        categorias.map((category) => category.id)
      );
    (ascPrev ?? []).forEach((a) => {
      puntosXCat.set(
        a.categoria_destino_id,
        (puntosXCat.get(a.categoria_destino_id) ?? 0) + a.puntos_transferidos
      );
    });

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

    await recalcularTodosLosAscensos(filtroAnio, clubId);

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
    if (!clubId || categorias.length === 0) {
      setAscensosList([]);
      return;
    }
    const { data } = await (supabase as any)
      .from("ascensos")
      .select("*")
      .eq("anio", filtroAnio)
      .in(
        "categoria_origen_id",
        categorias.map((c) => c.id)
      )
      .in(
        "categoria_destino_id",
        categorias.map((c) => c.id)
      )
      .order("fecha", { ascending: false });
    if (!data || (data as any[]).length === 0) {
      setAscensosList([]);
      return;
    }
    const jugIds = Array.from(new Set((data as any[]).map((a: any) => a.jugador_id)));
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < jugIds.length; i += chunkSize) {
      chunks.push(jugIds.slice(i, i + chunkSize));
    }

    let jugs: { id: string; nombre: string; apellido: string }[] = [];
    try {
      const results = await Promise.all(
        chunks.map((chunk) =>
          (supabase as any)
            .from("jugadores_publicos")
            .select("id, nombre, apellido")
            .in("id", chunk)
        )
      );

      for (const res of results) {
        if (res.data) {
          jugs = [...jugs, ...res.data];
        }
      }
    } catch (err) {
      console.error("Error fetching jugadores in chunks for ascensos:", err);
    }

    setAscensosList(
      (data as any[]).map((a: any) => {
        const j = jugs?.find((x) => x.id === a.jugador_id);
        return { ...a, jugador_nombre: j?.nombre, jugador_apellido: j?.apellido };
      })
    );
  };

  const eliminarAscenso = async (id: string) => {
    const { error } = await supabase.from("ascensos").delete().eq("id", id);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    await recalcularTodosLosAscensos(filtroAnio, clubId);
    toast.success("Ascenso eliminado");
    cargarAscensos();
    cargarRanking();
  };

  useEffect(() => {
    if (!loading) cargarAscensos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio, loading, clubId, categorias]);

  const categoriasOrigenGenero = useMemo(() => {
    if (!ascensoCatOrigen) return categorias;
    const catOrigen = categorias.find((c) => c.id === ascensoCatOrigen);
    if (!catOrigen) return categorias;
    return categorias.filter((c) => c.genero === catOrigen.genero);
  }, [ascensoCatOrigen, categorias]);

  const renderBadgeEstadoMaster = (r: RankingRowUnified) => {
    const cupoLabel = cupoActual ?? (esSuma8 ? 8 : 16);
    if (r.estado_master_tipo === "baja") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] border-destructive/40 text-destructive bg-destructive/5 gap-1"
        >
          <Ban className="h-2.5 w-2.5" />
          Baja Master
        </Badge>
      );
    }
    if (r.estado_master_tipo === "clasificando" && r.posicion_master != null) {
      return (
        <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white border-none gap-1">
          <Star className="h-2.5 w-2.5 fill-current" />
          Clasificado #{r.posicion_master}/{cupoLabel}
        </Badge>
      );
    }
    if (r.estado_master_tipo === "suplente") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
        >
          Suplente #{r.orden_suplente ?? ""}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Faltan torneos ({Math.min(r.torneos_jugados, TORNEOS_REQUERIDOS_MASTER)}/
        {TORNEOS_REQUERIDOS_MASTER})
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Ranking y Carrera al Master
          </h1>
          <p className="text-sm text-muted-foreground">
            Puntaje acumulado por jugador y gestión de clasificación al Master de Diciembre (mín.{" "}
            {TORNEOS_REQUERIDOS_MASTER} de {TORNEOS_TOTALES_ANIO} torneos).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={handleAbrirPlaca}
            className="gap-1.5 font-bold"
          >
            <Sparkles className="h-4 w-4" />
            Generar Placa Master
          </Button>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetAscensoForm();
              setAscensoOpen(true);
            }}
          >
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

      {/* Toggle de Vista: Ranking General vs Clasificados al Master */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex p-1 rounded-xl bg-muted border">
          <Button
            type="button"
            size="sm"
            variant={vistaModo === "general" ? "default" : "ghost"}
            className="text-xs font-bold rounded-lg"
            onClick={() => setVistaModo("general")}
          >
            <Trophy className="h-3.5 w-3.5 mr-1.5" />
            Ranking General
          </Button>
          <Button
            type="button"
            size="sm"
            variant={vistaModo === "master" ? "default" : "ghost"}
            className="text-xs font-bold rounded-lg"
            onClick={() => {
              if (filtroCategoria === "todas" && categorias.length > 0) {
                setFiltroCategoria(categorias[0].id);
              }
              setVistaModo("master");
            }}
          >
            <Star className="h-3.5 w-3.5 mr-1.5" />
            Clasificados al Master
          </Button>
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
            <Select
              value={String(filtroAnio)}
              onValueChange={(v) => setFiltroAnio(Number(v))}
            >
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
                    {c.genero === "caballeros"
                      ? "Cab."
                      : c.genero === "damas"
                      ? "Dam."
                      : "Mix."}{" "}
                    {c.nombre}
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
          <CardContent className="py-3 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-primary" />
                <span>
                  Clasifican al <strong>Master de Diciembre</strong> los primeros{" "}
                  <strong>{cupoActual}</strong> jugadores elegibles de esta categoría (mínimo{" "}
                  <strong>
                    {TORNEOS_REQUERIDOS_MASTER}/{TORNEOS_TOTALES_ANIO} torneos
                  </strong>{" "}
                  jugados en el año).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" onClick={handleAbrirPlaca} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Generar Placa Master
                </Button>
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
                        ¿Cuántos jugadores elegibles de esta categoría clasifican al Master? Por
                        defecto son 16 en Categorías Puras y 8 en Suma 8 / Suma 7.
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
              </div>
            </div>
            {esSuma8 && (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 pt-1 border-t border-primary/10">
                <Users className="h-4 w-4 shrink-0" />
                <span>
                  Regla Suma 8: Los 8 clasificados titulares eligen compañero/a respetando la suma
                  de categoría = 8.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {vistaModo === "general" ? (
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
                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                    <TableHead className="text-center">Torneos (X/7)</TableHead>
                    <TableHead>Estado Master (Admin)</TableHead>
                    <TableHead className="text-right">Puntos</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((r, idx) => {
                    const clasifica = Boolean(r.clasifica_master);
                    return (
                      <TableRow
                        key={r.jugador_id}
                        className={clasifica ? "bg-primary/5" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {medalla(idx)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium flex items-center gap-1.5 flex-wrap">
                            {r.jugador_apellido}, {r.jugador_nombre}
                            {clasifica && (
                              <Star className="h-3 w-3 text-primary fill-primary" />
                            )}
                          </div>
                          {r.jugador_club && (
                            <div className="text-xs text-muted-foreground">
                              {r.jugador_club}
                            </div>
                          )}
                          <div className="mt-1">{renderBadgeEstadoMaster(r)}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {r.jugador_categoria_nombre ? (
                            <Badge variant="secondary" className="shrink-0">
                              {r.jugador_categoria_genero === "caballeros"
                                ? "Cab."
                                : r.jugador_categoria_genero === "damas"
                                ? "Dam."
                                : "Mix."}{" "}
                              {r.jugador_categoria_nombre}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex flex-col items-center">
                            <Badge
                              variant="outline"
                              className={`font-mono ${
                                r.torneos_jugados >= TORNEOS_REQUERIDOS_MASTER
                                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                                  : ""
                              }`}
                            >
                              {r.torneos_jugados}/{TORNEOS_TOTALES_ANIO}
                            </Badge>
                            {(r.torneos_categoria_anterior ?? 0) > 0 && (
                              <span
                                className="text-[10px] text-muted-foreground mt-0.5"
                                title="Incluye torneos de su categoría anterior antes del ascenso"
                              >
                                ({r.torneos_en_categoria} + {r.torneos_categoria_anterior} ant.)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={r.master_status ?? "auto"}
                            disabled={updatingStatusId === r.jugador_id}
                            onValueChange={(val) =>
                              handleCambiarMasterStatus(r, val as MasterStatus)
                            }
                          >
                            <SelectTrigger className="h-8 w-[170px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="ascendido_habilitado">
                                Ascendido (Habilitar)
                              </SelectItem>
                              <SelectItem value="clasificado_manual">
                                Forzar Clasificado
                              </SelectItem>
                              <SelectItem value="baja_master">
                                Baja / No Juega
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {r.puntos_totales}
                          {r.puntos_ascenso > 0 && (
                            <span
                              className="text-xs text-primary ml-1"
                              title="Incluye puntos por ascenso"
                            >
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
      ) : (
        /* VISTA ADMIN: CLASIFICADOS AL MASTER + SUPLENTES */
        <div className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary fill-primary" />
                  Clasificados Titulares ({clasificadosMaster.length}/{cupoActual ?? 16})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Jugadores habilitados dentro del cupo de la categoría sin alterar sus puntos del
                  Ranking General.
                </p>
              </div>
              <Button size="sm" onClick={handleAbrirPlaca} className="gap-1.5 font-bold">
                <Sparkles className="h-4 w-4" />
                Generar Placa Master
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {clasificadosMaster.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Aún no hay jugadores clasificados en esta selección.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Cupo</TableHead>
                      <TableHead>Jugador</TableHead>
                      <TableHead className="text-center">Puesto Gral.</TableHead>
                      <TableHead className="text-center">Torneos</TableHead>
                      <TableHead>Estado Master</TableHead>
                      <TableHead className="text-right">Puntos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clasificadosMaster.map((r, idx) => (
                      <TableRow key={r.jugador_id} className="bg-primary/5">
                        <TableCell className="text-center">
                          <Badge className="font-black">
                            #{r.posicion_master ?? idx + 1}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold">
                            {r.jugador_apellido}, {r.jugador_nombre}
                          </div>
                          {esSuma8 && (
                            <Badge
                              variant="outline"
                              className="mt-1 text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400"
                            >
                              + Compañero/a a confirmar (Suma 8)
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          #{r.posicion}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">
                            {r.torneos_jugados}/{TORNEOS_TOTALES_ANIO}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={r.master_status ?? "auto"}
                            disabled={updatingStatusId === r.jugador_id}
                            onValueChange={(val) =>
                              handleCambiarMasterStatus(r, val as MasterStatus)
                            }
                          >
                            <SelectTrigger className="h-8 w-[170px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="ascendido_habilitado">
                                Ascendido (Habilitar)
                              </SelectItem>
                              <SelectItem value="clasificado_manual">
                                Forzar Clasificado
                              </SelectItem>
                              <SelectItem value="baja_master">
                                Baja / No Juega
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-black text-primary">
                          {r.puntos_totales}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                Suplentes Oficiales ({suplentesMaster.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {suplentesMaster.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground italic">
                  Sin suplentes habilitados en esta categoría.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 text-center">Orden</TableHead>
                      <TableHead>Jugador</TableHead>
                      <TableHead className="text-center">Torneos</TableHead>
                      <TableHead className="text-right">Puntos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suplentesMaster.map((r, idx) => (
                      <TableRow key={r.jugador_id}>
                        <TableCell className="text-center">
                          <Badge variant="outline">
                            Sup. #{r.orden_suplente ?? idx + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.jugador_apellido}, {r.jugador_nombre}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">
                            {r.torneos_jugados}/{TORNEOS_TOTALES_ANIO}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {r.puntos_totales}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
                      {detalleAscensoNotas && (
                        <span className="block mt-1 font-medium text-primary">
                          Nota: {detalleAscensoNotas}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-bold text-base">{detalleJugador.puntos_ascenso}</div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t font-semibold">
                <span>Total</span>
                <span>
                  {detalleData.reduce((acc, d) => acc + d.puntos, 0) +
                    (detalleJugador?.puntos_ascenso ?? 0)}{" "}
                  pts
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Ascenso */}
      <Dialog
        open={ascensoOpen}
        onOpenChange={(o) => {
          setAscensoOpen(o);
          if (!o) resetAscensoForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5" />
              Registrar ascenso
            </DialogTitle>
            <DialogDescription>
              El jugador sube de categoría y se transfiere la mitad de sus puntos a la nueva
              categoría. Sus torneos jugados en la categoría anterior sumarán para el mínimo de 4/7
              del Master.
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
                        <span>
                          {j.apellido}, {j.nombre}
                        </span>
                        {catLabel && (
                          <span className="text-muted-foreground text-xs">{catLabel}</span>
                        )}
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
                  <Select
                    value={ascensoCatOrigen}
                    onValueChange={async (catId) => {
                      setAscensoCatOrigen(catId);
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
                      const totalA = (ap ?? []).reduce(
                        (acc, a) => acc + a.puntos_transferidos,
                        0
                      );
                      setAscensoPuntosOrigen(totalT + totalA);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.genero === "caballeros"
                            ? "Cab."
                            : c.genero === "damas"
                            ? "Dam."
                            : "Mix."}{" "}
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Categoría destino (a la que asciende)
                  </label>
                  <Select value={ascensoCatDestino} onValueChange={setAscensoCatDestino}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasOrigenGenero
                        .filter((c) => c.id !== ascensoCatOrigen)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.genero === "caballeros"
                              ? "Cab."
                              : c.genero === "damas"
                              ? "Dam."
                              : "Mix."}{" "}
                            {c.nombre}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">
                      Puntos en categoría origen (Editables)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={ascensoPuntosOrigen}
                      onChange={(e) =>
                        setAscensoPuntosOrigen(Number(e.target.value) || 0)
                      }
                      className="h-8 font-bold text-sm bg-background"
                    />
                  </div>
                  <div className="flex justify-between text-sm text-primary font-medium border-t pt-1.5">
                    <span>Puntos transferidos a nueva categoría (50%)</span>
                    <span className="font-bold">
                      {Math.floor(ascensoPuntosOrigen / 2)} pts
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notas (opcional)</label>
                  <Input
                    value={ascensoNotas}
                    onChange={(e) => setAscensoNotas(e.target.value)}
                    placeholder="Ej: Ascenso por decisión del comité"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAscensoOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={guardarAscenso}
              disabled={savingAscenso || !ascensoJugadorId}
            >
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
                  const catOr = categorias.find((c) => c.id === a.categoria_origen_id);
                  const catDe = categorias.find((c) => c.id === a.categoria_destino_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.jugador_apellido}, {a.jugador_nombre}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {catOr?.nombre ?? "?"}
                      </TableCell>
                      <TableCell className="text-sm">{catDe?.nombre ?? "?"}</TableCell>
                      <TableCell className="text-right font-bold">
                        {a.puntos_transferidos}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => eliminarAscenso(a.id)}
                        >
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

      <MasterPlacaModal
        open={placaOpen}
        onOpenChange={setPlacaOpen}
        categoriaNombre={categoriaSeleccionada?.nombre ?? "Categoría"}
        categoriaGenero={categoriaSeleccionada?.genero ?? "caballeros"}
        anio={filtroAnio}
        cupo={cupoActual ?? (esSuma8 ? 8 : 16)}
        clasificados={placaClasificados}
        suplentes={placaSuplentes}
        clubNombre={clubBrand.nombre}
        clubLogoUrl={clubBrand.logoUrl}
      />
    </div>
  );
}
