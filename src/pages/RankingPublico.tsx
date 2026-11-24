import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
  Trophy,
  Medal,
  Star,
  Search,
  Filter,
  Loader2,
  Award,
  Share2,
  Check,
  Sparkles,
  Users,
  AlertCircle,
  Ban,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { useClubRanking, type RankingRowUnified } from "@/hooks/useClubRanking";
import { DesglosePuntosModal } from "@/components/ranking/DesglosePuntosModal";
import { MasterPlacaModal, type PlacaJugadorItem } from "@/components/ranking/MasterPlacaModal";
import {
  getCupoDefaultCategoria,
  isCategoriaSuma,
  getNumeroSumaCategoria,
  formatSumaModalidadLabel,
  normalizarFiltroTorneoParam,
  TORNEOS_REQUERIDOS_MASTER,
  TORNEOS_TOTALES_ANIO,
  formatTorneosMasterBadge,
} from "@/lib/ranking";
import { toast } from "sonner";
import PublicFooter from "@/components/PublicFooter";

type Categoria = { id: string; nombre: string; genero: string };

const GENEROS = [
  { value: "todos", label: "Todos los géneros" },
  { value: "caballeros", label: "Caballeros" },
  { value: "damas", label: "Damas" },
  { value: "mixto", label: "Mixto" },
];

export default function RankingPublico() {
  const { clubSlug } = useParams<{ clubSlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeClubSlug = clubSlug || searchParams.get("club") || "goodsports";
  const clubIdFromUrl = searchParams.get("club_id");
  const [loadingFiltros, setLoadingFiltros] = useState(true);

  const [jugadorModal, setJugadorModal] = useState<RankingRowUnified | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [placaOpen, setPlacaOpen] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aniosDisp, setAniosDisp] = useState<number[]>([]);
  const [cuposMaster, setCuposMaster] = useState<Record<string, number>>({});
  const [clubId, setClubId] = useState<string | null>(() => searchParams.get("club_id"));
  const [resolvedSlug, setResolvedSlug] = useState<string>(activeClubSlug);
  const [clubNombre, setClubNombre] = useState<string>("GOOD PADEL");
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);

  const [vistaModo, setVistaModo] = useState<"general" | "master">(() => {
    return searchParams.get("vista") === "master" ? "master" : "general";
  });

  const [filtroAnio, setFiltroAnio] = useState<number>(() => {
    const yr = searchParams.get("anio");
    return yr ? parseInt(yr, 10) : new Date().getFullYear();
  });
  const [filtroTorneo, setFiltroTorneo] = useState<string>(() => {
    const rawTorneo = searchParams.get("torneo");
    if (rawTorneo) return normalizarFiltroTorneoParam(rawTorneo);
    const rawCat = searchParams.get("categoria");
    if (rawCat && isCategoriaSuma(rawCat)) {
      return normalizarFiltroTorneoParam(rawCat);
    }
    return "todos";
  });
  const [filtroCategoria, setFiltroCategoria] = useState<string>(() => {
    const rawTorneo = searchParams.get("torneo");
    const normTorneo = normalizarFiltroTorneoParam(rawTorneo);
    if (normTorneo.startsWith("modalidad:") && normTorneo.includes("suma")) {
      return "todas";
    }
    const rawCat = searchParams.get("categoria");
    if (!rawCat || isCategoriaSuma(rawCat)) return "todas";
    return rawCat;
  });
  const [filtroGenero, setFiltroGenero] = useState<string>(() => {
    return (searchParams.get("genero") ?? "todos").toLowerCase();
  });
  const [busqueda, setBusqueda] = useState("");
  const [copiado, setCopiado] = useState(false);

  const esFiltroTorneoSuma = useMemo(() => {
    const norm = normalizarFiltroTorneoParam(filtroTorneo);
    if (norm.startsWith("modalidad:") && norm.toLowerCase().includes("suma")) {
      return true;
    }
    if (norm.startsWith("cat_torneo:")) {
      const cId = norm.slice("cat_torneo:".length);
      const cat = categorias.find((c) => c.id === cId);
      if (cat && isCategoriaSuma(cat.nombre)) return true;
    }
    return false;
  }, [filtroTorneo, categorias]);

  useEffect(() => {
    if (esFiltroTorneoSuma && filtroCategoria !== "todas") {
      setFiltroCategoria("todas");
    }
  }, [esFiltroTorneoSuma, filtroCategoria]);

  const {
    rankingRows: rows,
    torneosDisponibles,
    loading: rankingLoading,
  } = useClubRanking(
    clubId,
    esFiltroTorneoSuma ? "todas" : filtroCategoria,
    filtroGenero,
    filtroAnio,
    null,
    filtroTorneo
  );

  const categoriaSeleccionada = useMemo(() => {
    const normTorneo = normalizarFiltroTorneoParam(filtroTorneo);
    if (!esFiltroTorneoSuma && filtroCategoria !== "todas") {
      return categorias.find((c) => c.id === filtroCategoria) ?? null;
    }
    if (normTorneo && normTorneo !== "todos") {
      if (normTorneo.startsWith("modalidad:")) {
        const modKey = normTorneo.slice("modalidad:".length).toLowerCase().trim();
        const catIdsConTorneos = new Set(
          torneosDisponibles.map((t) => t.categoria_id).filter(Boolean) as string[]
        );
        const candidates = categorias.filter(
          (c) =>
            c.nombre.toLowerCase().trim().includes(modKey) &&
            (filtroGenero === "todos" || c.genero === filtroGenero)
        );
        return (
          candidates.find((c) => catIdsConTorneos.has(c.id)) ??
          candidates.find((c) => c.genero === "caballeros") ??
          candidates[0] ??
          categorias.find((c) => c.nombre.toLowerCase().trim().includes(modKey)) ??
          null
        );
      }
      if (normTorneo.startsWith("cat_torneo:")) {
        const cId = normTorneo.slice("cat_torneo:".length);
        return categorias.find((c) => c.id === cId) ?? null;
      }
      if (normTorneo.startsWith("torneo:")) {
        const tId = normTorneo.slice("torneo:".length);
        const tObj = torneosDisponibles.find((t) => t.id === tId);
        if (tObj?.categoria_id) {
          return categorias.find((c) => c.id === tObj.categoria_id) ?? null;
        }
      }
    }
    if (filtroCategoria !== "todas") {
      return categorias.find((c) => c.id === filtroCategoria) ?? null;
    }
    return null;
  }, [categorias, filtroCategoria, filtroTorneo, filtroGenero, esFiltroTorneoSuma, torneosDisponibles]);

  const esSuma8 = useMemo(
    () => isCategoriaSuma(categoriaSeleccionada?.nombre) || esFiltroTorneoSuma,
    [categoriaSeleccionada, esFiltroTorneoSuma]
  );

  const sumaLabelActiva = useMemo(() => {
    const normTorneo = normalizarFiltroTorneoParam(filtroTorneo);
    if (normTorneo.startsWith("modalidad:")) {
      return formatSumaModalidadLabel(normTorneo.slice("modalidad:".length));
    }
    if (categoriaSeleccionada?.nombre && isCategoriaSuma(categoriaSeleccionada.nombre)) {
      return formatSumaModalidadLabel(categoriaSeleccionada.nombre);
    }
    return "Suma 7";
  }, [filtroTorneo, categoriaSeleccionada]);

  const numeroSumaActivo = useMemo(
    () => getNumeroSumaCategoria(sumaLabelActiva) ?? 7,
    [sumaLabelActiva]
  );

  const nombreCategoriaPlaca = useMemo(() => {
    if (esSuma8) return sumaLabelActiva;
    return categoriaSeleccionada?.nombre ?? "Categoría";
  }, [esSuma8, sumaLabelActiva, categoriaSeleccionada]);

  const cupoActual = useMemo(() => {
    if (esSuma8) {
      if (categoriaSeleccionada && cuposMaster[categoriaSeleccionada.id]) {
        return Math.min(cuposMaster[categoriaSeleccionada.id], 8);
      }
      return 8;
    }
    if (!categoriaSeleccionada) return null;
    const def = getCupoDefaultCategoria(categoriaSeleccionada.nombre);
    return cuposMaster[categoriaSeleccionada.id] ?? def;
  }, [categoriaSeleccionada, cuposMaster, esSuma8]);

  const loading = loadingFiltros || rankingLoading;

  const construirUrlPublicaCompartir = (): string => {
    const slug = resolvedSlug || activeClubSlug || "goodsports";
    const params = new URLSearchParams();
    if (clubId) {
      params.set("club_id", clubId);
    }
    if (filtroAnio !== new Date().getFullYear()) {
      params.set("anio", String(filtroAnio));
    }
    if (!esFiltroTorneoSuma && filtroCategoria !== "todas") {
      params.set("categoria", filtroCategoria);
    }
    const normTorneo = normalizarFiltroTorneoParam(filtroTorneo);
    if (normTorneo !== "todos") {
      params.set("torneo", normTorneo);
    }
    if (filtroGenero !== "todos") {
      params.set("genero", filtroGenero);
    }
    if (vistaModo === "master") {
      params.set("vista", "master");
    }
    const qs = params.toString();
    return `${window.location.origin}/c/${slug}/ranking-publico${qs ? `?${qs}` : ""}`;
  };

  const copiarEnlace = () => {
    const url = construirUrlPublicaCompartir();
    navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("¡Enlace copiado al portapapeles! Listo para compartir en WhatsApp.");
    setTimeout(() => setCopiado(false), 2000);
  };

  const cargarFiltros = async () => {
    setLoadingFiltros(true);
    try {
      let clubQuery = supabase
        .from("clubes")
        .select("id, nombre, slug, logo_url");
      if (clubIdFromUrl) {
        clubQuery = clubQuery.eq("id", clubIdFromUrl);
      } else {
        clubQuery = clubQuery.eq("slug", activeClubSlug);
      }
      let { data: club } = await clubQuery.maybeSingle();
      if (!club && clubIdFromUrl) {
        const fallback = await supabase
          .from("clubes")
          .select("id, nombre, slug, logo_url")
          .eq("slug", activeClubSlug)
          .maybeSingle();
        club = fallback.data;
      }
      if (!club) {
        setCategorias([]);
        setLoadingFiltros(false);
        return;
      }
      setClubId(club.id);
      if (club.slug) setResolvedSlug(club.slug);
      if (club.nombre) setClubNombre(club.nombre);
      setClubLogoUrl(club.logo_url ?? null);

      const { data: cats } = await supabase
        .from("categorias")
        .select("id, nombre, genero")
        .eq("activa", true)
        .eq("club_id", club.id)
        .order("orden");
      const activeCats = (cats ?? []) as Categoria[];
      setCategorias(activeCats);

      const categoryIds = activeCats.map((category) => category.id);
      const { data: cupos } = categoryIds.length
        ? await supabase
          .from("cupos_master")
          .select("categoria_id, cupos")
          .in("categoria_id", categoryIds)
        : { data: [] as { categoria_id: string; cupos: number }[] };

      const anioSet = new Set<number>([new Date().getFullYear()]);
      setAniosDisp(Array.from(anioSet).sort((a, b) => b - a));

      const cuposMap: Record<string, number> = {};
      (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) => {
        cuposMap[c.categoria_id] = c.cupos;
      });
      setCuposMaster(cuposMap);

      // Resolver categoria si viene de la URL como texto o uuid (y no hay modalidad Suma activa)
      const catParam = searchParams.get("categoria");
      const genParam = searchParams.get("genero");
      const rawTorneoParam = searchParams.get("torneo");
      const normTorneoParam = normalizarFiltroTorneoParam(rawTorneoParam);

      if (normTorneoParam.startsWith("modalidad:") && normTorneoParam.includes("suma")) {
        setFiltroTorneo(normTorneoParam);
        setFiltroCategoria("todas");
      } else if (catParam && catParam !== "todas") {
        if (isCategoriaSuma(catParam)) {
          setFiltroTorneo(normalizarFiltroTorneoParam(catParam));
          setFiltroCategoria("todas");
        } else {
          const matchById = activeCats.find((c) => c.id === catParam);
          if (matchById) {
            setFiltroCategoria(matchById.id);
          } else {
            const normalized = catParam.toLowerCase().trim().replace(/[-_]/g, " ");
            let matches = activeCats.filter((c) => c.nombre.toLowerCase().includes(normalized));
            if (genParam && genParam !== "todos") {
              matches = matches.filter((c) => c.genero === genParam.toLowerCase());
            }
            if (matches.length > 0) {
              setFiltroCategoria(matches[0].id);
              if (!genParam) {
                setFiltroGenero(matches[0].genero);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error cargando filtros de ranking público:", err);
    } finally {
      setLoadingFiltros(false);
    }
  };

  useEffect(() => {
    cargarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubSlug, clubIdFromUrl]);

  useEffect(() => {
    // Sincronizar filtros con la URL sin generar bucle de re-renderizado
    const params = new URLSearchParams();
    if (clubIdFromUrl) {
      params.set("club_id", clubIdFromUrl);
    }
    if (filtroAnio !== new Date().getFullYear()) {
      params.set("anio", filtroAnio.toString());
    }
    let catName = "";
    const normTorneo = normalizarFiltroTorneoParam(filtroTorneo);
    if (!esFiltroTorneoSuma && filtroCategoria !== "todas") {
      params.set("categoria", filtroCategoria);
      const cat = categorias.find((c) => c.id === filtroCategoria);
      if (cat) {
        const gen =
          cat.genero === "caballeros"
            ? "Cab"
            : cat.genero === "damas"
              ? "Damas"
              : cat.genero;
        catName = ` - ${cat.nombre} ${gen}`;
      }
    }
    if (normTorneo !== "todos") {
      params.set("torneo", normTorneo);
      if (esFiltroTorneoSuma) {
        catName = ` - ${sumaLabelActiva}`;
      }
    }
    if (filtroGenero !== "todos") {
      params.set("genero", filtroGenero);
    }
    if (vistaModo === "master") {
      params.set("vista", "master");
    }
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    document.title = `Ranking${catName} | Padel ID`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio, filtroCategoria, filtroTorneo, filtroGenero, vistaModo, esFiltroTorneoSuma, sumaLabelActiva]);

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
          torneos_en_categoria: r.torneos_en_categoria,
          torneos_categoria_superior: r.torneos_categoria_superior,
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
          torneos_en_categoria: r.torneos_en_categoria,
          torneos_categoria_superior: r.torneos_categoria_superior,
          posicion_general: r.posicion,
          posicion_master: r.posicion_master ?? r.posicion,
          orden_suplente: r.orden_suplente,
        })),
    [rows]
  );

  const elegirCategoriaConTorneosPorDefecto = (): string | null => {
    const catIdsConTorneos = new Set(
      torneosDisponibles.map((t) => t.categoria_id).filter(Boolean) as string[]
    );
    const catConTorneos = categorias.find((c) => catIdsConTorneos.has(c.id));
    if (catConTorneos) return catConTorneos.id;
    return categorias[0]?.id ?? null;
  };

  const handleActivarVistaMaster = () => {
    if (filtroCategoria === "todas" && filtroTorneo === "todos") {
      const defaultCatId = elegirCategoriaConTorneosPorDefecto();
      if (defaultCatId) setFiltroCategoria(defaultCatId);
    }
    setVistaModo("master");
  };

  const handleAbrirPlaca = () => {
    if (filtroCategoria === "todas" && filtroTorneo === "todos") {
      const defaultCatId = elegirCategoriaConTorneosPorDefecto();
      if (defaultCatId) {
        setFiltroCategoria(defaultCatId);
        toast.info("Seleccionamos la primera categoría activa para generar la placa del Master.");
      } else {
        toast.error("Seleccioná una categoría o modalidad primero para generar la placa.");
        return;
      }
    }
    setPlacaOpen(true);
  };

  const medalla = (pos: number) => {
    if (pos === 0) return <Medal className="h-5 w-5 text-yellow-500" />;
    if (pos === 1) return <Medal className="h-5 w-5 text-slate-400" />;
    if (pos === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-xs font-bold text-muted-foreground">{pos + 1}</span>;
  };

  const renderBadgeEstadoMaster = (r: RankingRowUnified) => {
    const cupoLabel = cupoActual ?? (esSuma8 ? 8 : 16);
    if (r.estado_master_tipo === "baja") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] border-destructive/40 text-destructive bg-destructive/5 gap-1 font-semibold"
        >
          <Ban className="h-2.5 w-2.5" />
          Baja Master
        </Badge>
      );
    }
    if (r.estado_master_tipo === "clasificando" && r.posicion_master != null) {
      return (
        <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white border-none gap-1 font-bold">
          <Star className="h-2.5 w-2.5 fill-current" />
          Clasificando al Master (#{r.posicion_master} de {cupoLabel})
        </Badge>
      );
    }
    if (r.estado_master_tipo === "suplente") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold"
        >
          Suplente Master #{r.orden_suplente ?? ""}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-[10px] text-muted-foreground border-border bg-muted/40 font-medium"
      >
        Faltan torneos ({Math.min(r.torneos_jugados, TORNEOS_REQUERIDOS_MASTER)}/
        {TORNEOS_REQUERIDOS_MASTER})
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-1.5 rounded-lg">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">Padel ID</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">
                Ranking Oficial · Carrera al Master
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Link
              to="/auth"
              className="text-xs font-medium hover:text-primary transition-colors"
            >
              Mi Perfil / Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl border dark:border-primary/20 bg-gradient-to-br from-primary/10 dark:from-primary/20 via-background to-background p-6 sm:p-10 shadow-sm mb-6 mt-2">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-primary/20 dark:bg-primary/30 blur-3xl pointer-events-none"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="default"
                className="bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary-foreground hover:bg-primary/30 border-none px-3 py-1 text-[10px] uppercase tracking-widest font-black"
              >
                Oficial
              </Badge>
              <Badge
                variant="outline"
                className="border-primary/20 dark:border-primary/40 px-3 py-1 text-[10px] uppercase font-bold shadow-sm"
              >
                Temporada {filtroAnio}
              </Badge>
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 text-[10px] uppercase font-bold"
              >
                Mínimo {TORNEOS_REQUERIDOS_MASTER}/{TORNEOS_TOTALES_ANIO} torneos para el Master
              </Badge>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tighter bg-gradient-to-br from-foreground to-muted-foreground dark:from-foreground dark:to-foreground/60 bg-clip-text text-transparent pb-1">
              {vistaModo === "master"
                ? "Carrera al Master de Diciembre"
                : "Ranking General"}
            </h2>

            <p className="text-sm font-medium text-muted-foreground pt-1 max-w-2xl">
              Tabla oficial de posiciones. Clasifican al Master de Diciembre los mejores{" "}
              <strong>16 jugadores elegibles</strong> en Categorías Puras y los mejores{" "}
              <strong>8 titulares elegibles</strong> en modalidades Suma (con al menos{" "}
              <strong>{TORNEOS_REQUERIDOS_MASTER} de los {TORNEOS_TOTALES_ANIO} torneos</strong>{" "}
              del año jugados).
            </p>

            {/* Toggle Ranking General vs Clasificados al Master */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex p-1 rounded-xl bg-muted/70 border">
                <Button
                  type="button"
                  size="sm"
                  variant={vistaModo === "general" ? "default" : "ghost"}
                  className="font-bold text-xs rounded-lg"
                  onClick={() => setVistaModo("general")}
                >
                  <Trophy className="h-3.5 w-3.5 mr-1.5" />
                  Ranking General
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={vistaModo === "master" ? "default" : "ghost"}
                  className="font-bold text-xs rounded-lg"
                  onClick={handleActivarVistaMaster}
                >
                  <Star className="h-3.5 w-3.5 mr-1.5" />
                  Clasificados al Master
                </Button>
              </div>

              {(vistaModo === "master" || filtroCategoria !== "todas" || filtroTorneo !== "todos") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAbrirPlaca}
                  className="font-bold text-xs gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <Sparkles className="h-4 w-4" />
                  Generar Placa Master
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> Categoría del jugador
              </label>
              <Select
                value={esFiltroTorneoSuma ? "todas" : filtroCategoria}
                disabled={esFiltroTorneoSuma}
                onValueChange={(v) => {
                  setFiltroCategoria(v);
                  if (v !== "todas" && filtroTorneo !== "todos") {
                    setFiltroTorneo("todos");
                  }
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {categorias
                    .filter((c) => !isCategoriaSuma(c.nombre))
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
                  {categorias
                    .filter((c) => isCategoriaSuma(c.nombre))
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
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Trophy className="h-3 w-3" /> Torneo / Modalidad
              </label>
              <Select
                value={normalizarFiltroTorneoParam(filtroTorneo)}
                onValueChange={(v) => {
                  const norm = normalizarFiltroTorneoParam(v);
                  setFiltroTorneo(norm);
                  if (norm !== "todos" && filtroCategoria !== "todas") {
                    setFiltroCategoria("todas");
                  }
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Todos los torneos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los torneos</SelectItem>
                  <SelectItem value="modalidad:suma 6">Modalidad: Suma 6</SelectItem>
                  <SelectItem value="modalidad:suma 7">Modalidad: Suma 7</SelectItem>
                  <SelectItem value="modalidad:suma 8">Modalidad: Suma 8</SelectItem>
                  {torneosDisponibles.map((t) => (
                    <SelectItem key={t.id} value={`torneo:${t.id}`}>
                      {t.nombre}
                      {t.categoria_nombre ? ` (${t.categoria_nombre})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> Género
              </label>
              <Select value={filtroGenero} onValueChange={setFiltroGenero}>
                <SelectTrigger className="bg-background">
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
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Search className="h-3 w-3" /> Buscar
              </label>
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, apellido o club..."
                className="bg-background"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t dark:border-primary/10">
            <p className="text-xs text-muted-foreground">
              Tocá sobre un jugador para ver su desglose de torneos y puntos por ascenso.
            </p>
            <Button
              onClick={copiarEnlace}
              size="sm"
              className="w-full sm:w-auto font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-primary/5"
            >
              {copiado ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copiado ? "¡Enlace Copiado!" : "Copiar Enlace para Compartir"}
            </Button>
          </div>
        </div>

        {/* Banner informativo de Cupos y Regla Suma 8 */}
        {cupoActual !== null && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap p-5 rounded-2xl border dark:border-primary/20 bg-gradient-to-r from-primary/10 to-transparent text-sm">
              <div className="flex items-center gap-4">
                <div className="bg-primary p-2.5 rounded-xl shadow-lg shadow-primary/20">
                  <Award className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-bold text-base">
                    Carrera al Master · {nombreCategoriaPlaca}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Clasifican los mejores{" "}
                    <span className="text-primary font-black text-sm">{cupoActual}</span>{" "}
                    jugadores elegibles (mínimo {TORNEOS_REQUERIDOS_MASTER}/
                    {TORNEOS_TOTALES_ANIO} torneos jugados en el año). Si alguien no cumple el
                    mínimo, el cupo corre al siguiente elegible.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAbrirPlaca}
                className="gap-1.5 font-bold"
              >
                <Sparkles className="h-4 w-4" />
                Generar Placa Master
              </Button>
            </div>

            {esSuma8 && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-semibold">
                <Users className="h-5 w-5 shrink-0 text-amber-500" />
                <span>
                  Regla {sumaLabelActiva}: Los {cupoActual ?? 8} clasificados titulares eligen/invitan a su compañero/a respetando que la suma de ambas categorías dé {numeroSumaActivo}.
                </span>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Cargando ranking oficial...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <Trophy className="h-10 w-10 mx-auto opacity-20" />
              <p>No se encontraron registros para esta selección.</p>
            </CardContent>
          </Card>
        ) : vistaModo === "general" ? (
          /* VISTA 1: RANKING GENERAL (ORDEN REAL POR PUNTOS) */
          <Card className="overflow-hidden border-none shadow-xl bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead>Jugador / Estado Master</TableHead>
                  <TableHead className="text-center">Torneos</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((r, idx) => {
                  const clasifica = Boolean(r.clasifica_master);
                  return (
                    <TableRow
                      key={r.jugador_id}
                      onClick={() => {
                        setJugadorModal(r);
                        setModalOpen(true);
                      }}
                      className={`cursor-pointer group transition-colors ${clasifica ? "bg-primary/[0.03] hover:bg-primary/[0.07]" : "hover:bg-muted/40"
                        }`}
                    >
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center h-8">
                          {medalla(idx)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold ${clasifica ? "text-primary" : ""}`}>
                              {r.jugador_apellido}, {r.jugador_nombre}
                            </span>
                            {r.es_ascendido && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1.5 py-0 h-4 font-semibold"
                              >
                                Ascendido
                              </Badge>
                            )}
                          </div>
                          {r.jugador_club && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {r.jugador_club}
                            </span>
                          )}
                          <div className="pt-0.5">{renderBadgeEstadoMaster(r)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex flex-col items-center">
                          <Badge
                            variant="outline"
                            className={`font-mono text-xs ${r.torneos_jugados >= TORNEOS_REQUERIDOS_MASTER
                              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                              : ""
                              }`}
                          >
                            {formatTorneosMasterBadge(r, TORNEOS_TOTALES_ANIO)} torneos
                          </Badge>
                          {(r.torneos_categoria_superior ?? 0) > 0 && (
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                              ({r.torneos_en_categoria} + {r.torneos_categoria_superior} cat. sup.)
                            </span>
                          )}
                          {(r.torneos_categoria_anterior ?? 0) > 0 && (
                            <span className="text-[9px] text-muted-foreground mt-0.5">
                              ({r.torneos_en_categoria} + {r.torneos_categoria_anterior} ant.)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-lg font-black tracking-tight text-primary">
                          {r.puntos_totales}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        ) : (
          /* VISTA 2: CLASIFICADOS AL MASTER + SECCIÓN SUPLENTES */
          <div className="space-y-6">
            {filtroCategoria === "todas" && filtroTorneo === "todos" && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  Seleccioná una categoría o modalidad específica arriba para ver los cupos exactos
                  (16 en Categorías Puras / 8 en modalidades Suma) y generar la placa oficial.
                </span>
              </div>
            )}

            <Card className="overflow-hidden border-primary/20 shadow-xl bg-card">
              <CardHeader className="bg-primary/5 border-b pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                    Clasificados Titulares al Master (
                    {clasificadosMaster.length}/{cupoActual ?? 16})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Numerados del #1 al #{cupoActual ?? 16} únicamente entre jugadores que
                    cumplen el requisito de {TORNEOS_REQUERIDOS_MASTER}/
                    {TORNEOS_TOTALES_ANIO} torneos.
                  </p>
                </div>
                <Button size="sm" variant="default" onClick={handleAbrirPlaca} className="gap-1.5 font-bold">
                  <Sparkles className="h-4 w-4" />
                  Generar Placa Master
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {clasificadosMaster.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm px-4">
                    Aún no hay jugadores que alcancen los {TORNEOS_REQUERIDOS_MASTER} torneos
                    mínimos requeridos en esta categoría.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-16 text-center">Cupo</TableHead>
                        <TableHead>Jugador Clasificado</TableHead>
                        <TableHead className="text-center hidden sm:table-cell">
                          Puesto Gral.
                        </TableHead>
                        <TableHead className="text-center">Torneos</TableHead>
                        <TableHead className="text-right">Puntos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clasificadosMaster.map((r, idx) => (
                        <TableRow
                          key={r.jugador_id}
                          onClick={() => {
                            setJugadorModal(r);
                            setModalOpen(true);
                          }}
                          className="cursor-pointer bg-primary/[0.02] hover:bg-primary/[0.06]"
                        >
                          <TableCell className="text-center">
                            <Badge className="bg-primary text-primary-foreground font-black">
                              #{r.posicion_master ?? idx + 1}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-primary">
                                {r.jugador_apellido}, {r.jugador_nombre}
                              </span>
                              {r.jugador_club && (
                                <span className="text-[10px] text-muted-foreground uppercase">
                                  {r.jugador_club}
                                </span>
                              )}
                              {esSuma8 && (
                                <Badge
                                  variant="outline"
                                  className="w-fit text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                >
                                  + Compañero/a a confirmar ({sumaLabelActiva})
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center hidden sm:table-cell text-xs text-muted-foreground font-mono">
                            #{r.posicion}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex flex-col items-center">
                              <Badge variant="outline" className="font-mono text-xs">
                                {formatTorneosMasterBadge(r, TORNEOS_TOTALES_ANIO)}
                              </Badge>
                              {(r.torneos_categoria_superior ?? 0) > 0 && (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                                  ({r.torneos_en_categoria} + {r.torneos_categoria_superior} cat. sup.)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-lg font-black text-primary">
                              {r.puntos_totales}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Sección inferior de Suplentes */}
            <Card className="overflow-hidden border-dashed">
              <CardHeader className="bg-muted/30 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  Suplentes Oficiales del Master ({suplentesMaster.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Jugadores que cumplen los {TORNEOS_REQUERIDOS_MASTER}+ torneos y entran en
                  orden ante cualquier baja de los titulares.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {suplentesMaster.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground italic">
                    No hay suplentes registrados con {TORNEOS_REQUERIDOS_MASTER}+ torneos por el
                    momento.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 text-center">Suplente</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead className="text-center">Torneos</TableHead>
                        <TableHead className="text-right">Puntos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suplentesMaster.map((r, idx) => (
                        <TableRow
                          key={r.jugador_id}
                          onClick={() => {
                            setJugadorModal(r);
                            setModalOpen(true);
                          }}
                          className="cursor-pointer hover:bg-muted/40"
                        >
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold"
                            >
                              Sup. #{r.orden_suplente ?? idx + 1}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">
                              {r.jugador_apellido}, {r.jugador_nombre}
                            </div>
                            {r.jugador_club && (
                              <div className="text-[10px] text-muted-foreground uppercase">
                                {r.jugador_club}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex flex-col items-center">
                              <Badge variant="outline" className="font-mono text-xs">
                                {formatTorneosMasterBadge(r, TORNEOS_TOTALES_ANIO)}
                              </Badge>
                              {(r.torneos_categoria_superior ?? 0) > 0 && (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                                  ({r.torneos_en_categoria} + {r.torneos_categoria_superior} cat. sup.)
                                </span>
                              )}
                            </div>
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
      </main>

      <DesglosePuntosModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        jugador={jugadorModal}
        clubId={clubId}
      />

      <MasterPlacaModal
        open={placaOpen}
        onOpenChange={setPlacaOpen}
        categoriaNombre={nombreCategoriaPlaca}
        categoriaGenero={
          categoriaSeleccionada?.genero ??
          (filtroGenero !== "todos" ? filtroGenero : "caballeros")
        }
        anio={filtroAnio}
        cupo={cupoActual ?? (esSuma8 ? 8 : 16)}
        clasificados={placaClasificados}
        suplentes={placaSuplentes}
        clubNombre={clubNombre}
        clubLogoUrl={clubLogoUrl}
      />

      <PublicFooter clubId={clubId} />
    </div>
  );
}
